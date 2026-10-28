import argon2 from 'argon2';
import type { AuthResponse, ChangePasswordBody, ClientKind, LoginBody, Me } from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import type { Prisma } from '../../infra/db.js';
import { logActivity } from '../../lib/activity.js';
import { randomToken, sha256Hex } from '../../lib/crypto.js';
import { BadRequestError, LockedError, UnauthorizedError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { addDays, addSeconds } from '../../lib/time.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
/** Two requests refreshing with the same token this close together are treated as a race, not theft. */
const REFRESH_GRACE_MS = 15_000;

// OWASP minimum for argon2id: 19 MiB memory, 2 passes, 1 lane.
const ARGON_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON_OPTIONS);
}

let dummyHash: Promise<string> | null = null;
/** Used when the staff ID does not exist, so a wrong ID takes as long as a wrong password. */
function getDummyHash(): Promise<string> {
  dummyHash ??= argon2.hash('not a real password, only for timing', ARGON_OPTIONS);
  return dummyHash;
}

export interface RequestMeta {
  ip: string | null;
  deviceLabel?: string | null;
}

/** Signs an access token. `passwordVersion` ties the token to the current password. */
export type SignAccess = (user: { id: string; passwordChangedAt: Date | null }, sessionId: string) => { token: string; expiresAt: Date };

export function passwordVersion(passwordChangedAt: Date | null): number {
  return passwordChangedAt ? passwordChangedAt.getTime() : 0;
}

export interface IssuedTokens {
  response: AuthResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}

type UserRow = Prisma.UserGetPayload<object>;

export function toMe(u: Pick<UserRow, 'id' | 'staffId' | 'fullName' | 'role' | 'mustChangePassword'>): Me {
  return { id: u.id, staffId: u.staffId, fullName: u.fullName, role: u.role, mustChangePassword: u.mustChangePassword };
}

async function issueTokens(
  ctx: AppContext,
  sign: SignAccess,
  user: UserRow,
  client: ClientKind,
  familyId: string,
  meta: RequestMeta,
  db: Pick<Prisma.TransactionClient, 'refreshToken'> = ctx.db,
): Promise<IssuedTokens & { tokenId: string }> {
  const access = sign(user, familyId);
  const refreshToken = randomToken(32);
  const refreshExpiresAt = addDays(new Date(), ctx.env.REFRESH_TOKEN_TTL_DAYS);
  const tokenId = newId();
  await db.refreshToken.create({
    data: {
      id: tokenId,
      userId: user.id,
      familyId,
      tokenHash: sha256Hex(refreshToken),
      expiresAt: refreshExpiresAt,
      deviceLabel: meta.deviceLabel ?? null,
      ip: meta.ip,
    },
  });
  return {
    tokenId,
    refreshToken,
    refreshExpiresAt,
    response: {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      ...(client === 'mobile' ? { refreshToken } : {}),
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      user: toMe(user),
    },
  };
}

export async function login(ctx: AppContext, sign: SignAccess, input: LoginBody, meta: RequestMeta): Promise<IssuedTokens> {
  const user = await ctx.db.user.findUnique({ where: { staffId: input.staffId } });

  if (!user) {
    await argon2.verify(await getDummyHash(), input.password).catch(() => false);
    await logActivity(ctx.db, {
      actorId: null,
      action: 'auth.login_failed',
      entityType: 'user',
      ip: meta.ip,
      data: { staffId: input.staffId, reason: 'unknown_staff_id' },
    });
    throw new UnauthorizedError('Staff ID or password is not right', 'invalid_credentials');
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const until = user.lockedUntil.toISOString().slice(11, 16);
    throw new LockedError(`Too many wrong tries. Try again after ${until} UTC or ask an admin to unlock you.`);
  }

  const ok = await argon2.verify(user.passwordHash, input.password).catch(() => false);
  if (!ok || !user.isActive) {
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await ctx.db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failed,
          lockedUntil: lock ? addSeconds(now, LOCK_MINUTES * 60) : user.lockedUntil,
        },
      });
      await logActivity(ctx.db, {
        actorId: user.id,
        action: lock ? 'auth.locked' : 'auth.login_failed',
        entityType: 'user',
        entityId: user.id,
        ip: meta.ip,
        data: { reason: 'wrong_password', failed },
      });
    }
    throw new UnauthorizedError('Staff ID or password is not right', 'invalid_credentials');
  }

  // Upgrade old hashes silently if the settings ever change.
  const rehash = argon2.needsRehash(user.passwordHash, ARGON_OPTIONS);
  const updated = await ctx.db.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: now,
      ...(rehash ? { passwordHash: await hashPassword(input.password) } : {}),
    },
  });

  const tokens = await issueTokens(ctx, sign, updated, input.client, newId(), {
    ip: meta.ip,
    deviceLabel: input.deviceLabel ?? null,
  });
  await logActivity(ctx.db, {
    actorId: user.id,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    ip: meta.ip,
    data: { client: input.client, device: input.deviceLabel ?? null },
  });
  return tokens;
}

/**
 * Swaps a refresh token for a new pair. Each refresh token works once. If an
 * old one comes back later, someone may have copied it, so the whole sign in
 * (the token family) is cut off.
 */
export async function refresh(
  ctx: AppContext,
  sign: SignAccess,
  token: string,
  client: ClientKind,
  meta: RequestMeta,
): Promise<IssuedTokens> {
  const found = await ctx.db.refreshToken.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { user: true },
  });
  if (!found) throw new UnauthorizedError();

  const now = new Date();
  if (found.expiresAt <= now) throw new UnauthorizedError('Your session has expired', 'session_expired');
  if (!found.user.isActive) throw new UnauthorizedError();

  if (found.revokedAt) {
    const withinGrace = found.replacedById !== null && now.getTime() - found.revokedAt.getTime() < REFRESH_GRACE_MS;
    if (!withinGrace) {
      await ctx.db.refreshToken.updateMany({
        where: { familyId: found.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      await logActivity(ctx.db, {
        actorId: found.userId,
        action: 'auth.refresh_reuse',
        entityType: 'user',
        entityId: found.userId,
        ip: meta.ip,
        data: { familyId: found.familyId },
      });
      throw new UnauthorizedError('Please sign in again', 'session_revoked');
    }
    // Two tabs or a retry raced each other. Give this one its own token in the same family.
    const familyStillLive = await ctx.db.refreshToken.count({
      where: { familyId: found.familyId, revokedAt: null, expiresAt: { gt: now } },
    });
    if (familyStillLive === 0) throw new UnauthorizedError('Please sign in again', 'session_revoked');
    return issueTokens(ctx, sign, found.user, client, found.familyId, { ip: meta.ip, deviceLabel: found.deviceLabel });
  }

  return ctx.db.$transaction(async (tx) => {
    // Claim the token. If another request got here first, count is 0.
    const claimed = await tx.refreshToken.updateMany({
      where: { id: found.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (claimed.count === 0) throw new UnauthorizedError('Please sign in again', 'session_revoked');
    const issued = await issueTokens(
      ctx,
      sign,
      found.user,
      client,
      found.familyId,
      { ip: meta.ip, deviceLabel: found.deviceLabel },
      tx,
    );
    await tx.refreshToken.update({ where: { id: found.id }, data: { replacedById: issued.tokenId } });
    return issued;
  });
}

/** Ends the sign in that this refresh token belongs to. Quietly does nothing for unknown tokens. */
export async function logout(ctx: AppContext, token: string | undefined, meta: RequestMeta): Promise<void> {
  if (!token) return;
  const found = await ctx.db.refreshToken.findUnique({ where: { tokenHash: sha256Hex(token) } });
  if (!found) return;
  await ctx.db.refreshToken.updateMany({
    where: { familyId: found.familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await logActivity(ctx.db, {
    actorId: found.userId,
    action: 'auth.logout',
    entityType: 'user',
    entityId: found.userId,
    ip: meta.ip,
  });
}

/** Changes the password, signs out every other device and returns fresh tokens for this one. */
export async function changePassword(
  ctx: AppContext,
  sign: SignAccess,
  userId: string,
  input: ChangePasswordBody,
  meta: RequestMeta,
): Promise<IssuedTokens> {
  const user = await ctx.db.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new UnauthorizedError();
  const ok = await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false);
  if (!ok) throw new BadRequestError('Current password is not right', 'wrong_password');

  const now = new Date();
  const updated = await ctx.db.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        mustChangePassword: false,
        passwordChangedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await logActivity(tx, {
      actorId: userId,
      action: 'auth.password_changed',
      entityType: 'user',
      entityId: userId,
      ip: meta.ip,
    });
    return u;
  });

  return issueTokens(ctx, sign, updated, input.client, newId(), meta);
}
