import type { CreateUserBody, ResetPasswordBody, UpdateUserBody, UserDto, UserListQuery } from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import type { Prisma } from '../../infra/db.js';
import { logActivity } from '../../lib/activity.js';
import { toUserDto } from '../../lib/dto.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { decodeCursor, pageOf } from '../../lib/pagination.js';
import { hashPassword } from '../auth/service.js';

interface Actor {
  id: string;
  ip: string | null;
}

export async function listUsers(ctx: AppContext, q: UserListQuery) {
  const cursor = decodeCursor(q.cursor);
  const where: Prisma.UserWhereInput = {
    ...(q.role ? { role: q.role } : {}),
    ...(q.active !== undefined ? { isActive: q.active } : {}),
    ...(q.q
      ? {
          OR: [
            { staffId: { contains: q.q, mode: 'insensitive' } },
            { fullName: { contains: q.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const rows = await ctx.db.user.findMany({
    where,
    orderBy: { id: 'desc' },
    take: q.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = pageOf(rows, q.limit);
  return { items: page.items.map(toUserDto), nextCursor: page.nextCursor };
}

export async function getUser(ctx: AppContext, id: string): Promise<UserDto> {
  const user = await ctx.db.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('User');
  return toUserDto(user);
}

export async function createUser(ctx: AppContext, input: CreateUserBody, actor: Actor): Promise<UserDto> {
  const exists = await ctx.db.user.findUnique({ where: { staffId: input.staffId }, select: { id: true } });
  if (exists) throw new ConflictError('That staff ID is already in use', 'staff_id_taken');
  const passwordHash = await hashPassword(input.temporaryPassword);
  const user = await ctx.db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        staffId: input.staffId,
        fullName: input.fullName,
        role: input.role,
        passwordHash,
        mustChangePassword: true,
      },
    });
    await logActivity(tx, {
      actorId: actor.id,
      action: 'user.created',
      entityType: 'user',
      entityId: u.id,
      ip: actor.ip,
      data: { staffId: u.staffId, role: u.role },
    });
    return u;
  });
  return toUserDto(user);
}

export async function updateUser(ctx: AppContext, id: string, input: UpdateUserBody, actor: Actor): Promise<UserDto> {
  const current = await ctx.db.user.findUnique({ where: { id } });
  if (!current) throw new NotFoundError('User');

  if (id === actor.id && (input.isActive === false || (input.role && input.role !== current.role))) {
    throw new BadRequestError('You cannot change your own role or deactivate yourself', 'self_change');
  }

  // Never leave the system without an active admin.
  const losingAdmin =
    current.role === 'ADMIN' && current.isActive && (input.isActive === false || (input.role && input.role !== 'ADMIN'));
  if (losingAdmin) {
    const admins = await ctx.db.user.count({ where: { role: 'ADMIN', isActive: true } });
    if (admins <= 1) throw new BadRequestError('There must be at least one active admin', 'last_admin');
  }

  const user = await ctx.db.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id }, data: input });
    if (input.isActive === false) {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await logActivity(tx, {
      actorId: actor.id,
      action: 'user.updated',
      entityType: 'user',
      entityId: id,
      ip: actor.ip,
      data: { changes: input },
    });
    return u;
  });

  if (input.isActive === false) ctx.broadcaster.disconnectUser(id);
  return toUserDto(user);
}

/** Sets a new temporary password, clears any lock and signs the person out everywhere. */
export async function resetPassword(ctx: AppContext, id: string, input: ResetPasswordBody, actor: Actor): Promise<UserDto> {
  const current = await ctx.db.user.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw new NotFoundError('User');
  const passwordHash = await hashPassword(input.temporaryPassword);
  const now = new Date();
  const user = await ctx.db.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordChangedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
    await logActivity(tx, {
      actorId: actor.id,
      action: 'user.password_reset',
      entityType: 'user',
      entityId: id,
      ip: actor.ip,
    });
    return u;
  });
  ctx.broadcaster.disconnectUser(id);
  return toUserDto(user);
}

export async function unlockUser(ctx: AppContext, id: string, actor: Actor): Promise<UserDto> {
  const user = await ctx.db.user.update({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await logActivity(ctx.db, { actorId: actor.id, action: 'user.unlocked', entityType: 'user', entityId: id, ip: actor.ip });
  return toUserDto(user);
}
