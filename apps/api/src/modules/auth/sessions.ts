import type { SessionDto } from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import { logActivity } from '../../lib/activity.js';
import { NotFoundError } from '../../lib/errors.js';
import { revokedSessionKey } from '../../plugins/auth.js';

// A session is one sign in on one device: every refresh token from that sign
// in shares a family id. The newest live token in a family tells us when the
// device was last active, because tokens rotate each time it refreshes.

export async function listSessions(ctx: AppContext, userId: string, currentId: string | undefined): Promise<SessionDto[]> {
  const now = new Date();
  const live = await ctx.db.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
    select: { familyId: true, deviceLabel: true, ip: true, createdAt: true },
  });

  const newest = new Map<string, (typeof live)[number]>();
  for (const t of live) if (!newest.has(t.familyId)) newest.set(t.familyId, t);
  if (newest.size === 0) return [];

  const started = await ctx.db.refreshToken.groupBy({
    by: ['familyId'],
    where: { familyId: { in: [...newest.keys()] } },
    _min: { createdAt: true },
  });
  const startedAt = new Map(started.map((s) => [s.familyId, s._min.createdAt]));

  return [...newest.values()]
    .map((t) => ({
      id: t.familyId,
      deviceLabel: t.deviceLabel,
      ip: t.ip,
      startedAt: (startedAt.get(t.familyId) ?? t.createdAt).toISOString(),
      lastActiveAt: t.createdAt.toISOString(),
      current: t.familyId === currentId,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || b.lastActiveAt.localeCompare(a.lastActiveAt));
}

/** Ends sessions: their refresh tokens stop working and live access tokens are refused at once. */
async function revoke(ctx: AppContext, userId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) return 0;
  const { count } = await ctx.db.refreshToken.updateMany({
    where: { userId, familyId: { in: sessionIds }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  // Access tokens live at most this long, so the mark can expire after it.
  const ttl = ctx.env.ACCESS_TOKEN_TTL_SECONDS + 60;
  const pipe = ctx.redis.multi();
  for (const id of sessionIds) pipe.set(revokedSessionKey(id), '1', 'EX', ttl);
  await pipe.exec();
  return count;
}

async function liveSessionIds(ctx: AppContext, userId: string) {
  const rows = await ctx.db.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { familyId: true },
    distinct: ['familyId'],
  });
  return rows.map((r) => r.familyId);
}

/** Someone signs out one of their own devices. */
export async function endSession(ctx: AppContext, userId: string, sessionId: string, ip: string | null) {
  const ids = await liveSessionIds(ctx, userId);
  if (!ids.includes(sessionId)) throw new NotFoundError('That device is already signed out');
  await revoke(ctx, userId, [sessionId]);
  await logActivity(ctx.db, { actorId: userId, action: 'auth.session_ended', entityType: 'user', entityId: userId, ip, data: { sessionId } });
}

/** Someone signs out every device except the one they are holding. */
export async function endOtherSessions(ctx: AppContext, userId: string, keep: string | undefined, ip: string | null) {
  const ids = (await liveSessionIds(ctx, userId)).filter((id) => id !== keep);
  await revoke(ctx, userId, ids);
  await logActivity(ctx.db, { actorId: userId, action: 'auth.sessions_ended', entityType: 'user', entityId: userId, ip, data: { count: ids.length } });
  return ids.length;
}

/** An admin signs a person out everywhere, for example after a lost phone. */
export async function endAllSessionsFor(ctx: AppContext, actorId: string, userId: string, ip: string | null) {
  const ids = await liveSessionIds(ctx, userId);
  await revoke(ctx, userId, ids);
  await logActivity(ctx.db, { actorId, action: 'user.signed_out_everywhere', entityType: 'user', entityId: userId, ip, data: { count: ids.length } });
  return ids.length;
}
