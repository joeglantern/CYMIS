import type { CreateShiftBody, ShiftDto, ShiftListQuery, UpdateShiftBody } from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import { Prisma } from '../../infra/db.js';
import { logActivity } from '../../lib/activity.js';
import { toUserSummary, userSummarySelect } from '../../lib/dto.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { iso } from '../../lib/time.js';

interface Actor {
  id: string;
  ip: string | null;
}

const shiftInclude = {
  audit: { select: { id: true, name: true, status: true, section: { select: { id: true, name: true } } } },
  assignments: { select: { user: { select: userSummarySelect } } },
} as const satisfies Prisma.ShiftInclude;

type ShiftWithRelations = Prisma.ShiftGetPayload<{ include: typeof shiftInclude }>;

function toShiftDto(s: ShiftWithRelations): ShiftDto {
  return {
    id: s.id,
    name: s.name,
    startsAt: iso(s.startsAt),
    endsAt: iso(s.endsAt),
    audit: s.audit,
    clerks: s.assignments.map((a) => toUserSummary(a.user)).sort((a, b) => a.fullName.localeCompare(b.fullName)),
    createdAt: iso(s.createdAt),
  };
}

async function dto(ctx: AppContext, shiftId: string): Promise<ShiftDto> {
  const shift = await ctx.db.shift.findUnique({ where: { id: shiftId }, include: shiftInclude });
  if (!shift) throw new NotFoundError('Shift');
  return toShiftDto(shift);
}

export async function listShifts(ctx: AppContext, q: ShiftListQuery) {
  const shifts = await ctx.db.shift.findMany({
    where: {
      ...(q.auditId ? { auditId: q.auditId } : {}),
      ...(q.endsFrom || q.endsBefore
        ? { endsAt: { ...(q.endsFrom ? { gte: new Date(q.endsFrom) } : {}), ...(q.endsBefore ? { lt: new Date(q.endsBefore) } : {}) } }
        : {}),
    },
    include: shiftInclude,
    orderBy: [{ startsAt: q.order }, { id: 'asc' }],
    take: q.limit,
  });
  return { items: shifts.map(toShiftDto) };
}

/** Holds the plan's row until commit, so a close or a second edit cannot slip in between the steps below. */
async function lockOpenPlan(tx: Prisma.TransactionClient, auditId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ status: string }[]>(Prisma.sql`SELECT status FROM audits WHERE id = ${auditId}::uuid FOR UPDATE`);
  const status = rows[0]?.status;
  if (!status) throw new NotFoundError('Yard plan');
  if (status !== 'DRAFT' && status !== 'ACTIVE') {
    throw new ConflictError('This yard plan is finished, so its shifts cannot change', 'audit_finished');
  }
}

/** The same people the Clerks step accepts. */
async function checkClerks(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const valid = await tx.user.count({ where: { id: { in: ids }, isActive: true, role: { in: ['AUDITOR', 'SUPERVISOR'] } } });
  if (valid !== ids.length) throw new BadRequestError('Only active clerks and supervisors can be assigned', 'bad_assignee');
}

/** Adding to a shift also adds to the plan. Someone already on the plan keeps the row they have. */
async function addClerks(tx: Prisma.TransactionClient, auditId: string, shiftId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await tx.shiftAssignment.createMany({ data: ids.map((userId) => ({ shiftId, userId })), skipDuplicates: true });
  const viaShiftAt = new Date();
  await tx.auditAssignment.createMany({ data: ids.map((userId) => ({ auditId, userId, viaShiftAt })), skipDuplicates: true });
}

/** Drops the plan too, but only for people on it through shifts alone with no shift left. Returns who was dropped. */
async function releasePlan(tx: Prisma.TransactionClient, auditId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const held = await tx.shiftAssignment.findMany({
    where: { userId: { in: ids }, shift: { auditId } },
    select: { userId: true },
    distinct: ['userId'],
  });
  const stay = new Set(held.map((h) => h.userId));
  const free = ids.filter((id) => !stay.has(id));
  if (free.length === 0) return [];
  const drop = await tx.auditAssignment.findMany({
    where: { auditId, userId: { in: free }, viaShiftAt: { not: null } },
    select: { userId: true },
  });
  const dropped = drop.map((d) => d.userId);
  if (dropped.length) await tx.auditAssignment.deleteMany({ where: { auditId, userId: { in: dropped } } });
  return dropped;
}

export async function createShift(ctx: AppContext, input: CreateShiftBody, actor: Actor): Promise<ShiftDto> {
  const clerkIds = [...new Set(input.clerkIds)];
  const shift = await ctx.db.$transaction(async (tx) => {
    await lockOpenPlan(tx, input.auditId);
    await checkClerks(tx, clerkIds);
    const s = await tx.shift.create({
      data: {
        auditId: input.auditId,
        name: input.name,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        createdById: actor.id,
      },
    });
    await addClerks(tx, input.auditId, s.id, clerkIds);
    await logActivity(tx, {
      actorId: actor.id,
      action: 'shift.created',
      entityType: 'shift',
      entityId: s.id,
      ip: actor.ip,
      data: { auditId: input.auditId, name: s.name, startsAt: input.startsAt, endsAt: input.endsAt, clerkIds },
    });
    return s;
  });
  return dto(ctx, shift.id);
}

export async function updateShift(ctx: AppContext, shiftId: string, input: UpdateShiftBody, actor: Actor): Promise<ShiftDto> {
  await ctx.db.$transaction(async (tx) => {
    const before = await tx.shift.findUnique({ where: { id: shiftId }, include: { assignments: { select: { userId: true } } } });
    if (!before) throw new NotFoundError('Shift');
    await lockOpenPlan(tx, before.auditId);

    const startsAt = input.startsAt ? new Date(input.startsAt) : before.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : before.endsAt;
    if (endsAt.getTime() <= startsAt.getTime()) throw new BadRequestError('A shift must end after it starts', 'bad_shift_times');

    const current = before.assignments.map((a) => a.userId);
    const next = input.clerkIds ? [...new Set(input.clerkIds)] : current;
    const added = next.filter((id) => !current.includes(id));
    const removed = current.filter((id) => !next.includes(id));
    await checkClerks(tx, added);

    await tx.shift.update({
      where: { id: shiftId },
      data: { ...(input.name ? { name: input.name } : {}), startsAt, endsAt },
    });
    await addClerks(tx, before.auditId, shiftId, added);
    if (removed.length) await tx.shiftAssignment.deleteMany({ where: { shiftId, userId: { in: removed } } });
    const leftPlan = await releasePlan(tx, before.auditId, removed);

    await logActivity(tx, {
      actorId: actor.id,
      action: 'shift.updated',
      entityType: 'shift',
      entityId: shiftId,
      ip: actor.ip,
      data: { auditId: before.auditId, changed: Object.keys(input), added, removed, leftPlan },
    });
  });
  return dto(ctx, shiftId);
}

export async function deleteShift(ctx: AppContext, shiftId: string, actor: Actor): Promise<void> {
  await ctx.db.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({ where: { id: shiftId }, include: { assignments: { select: { userId: true } } } });
    if (!shift) throw new NotFoundError('Shift');
    await lockOpenPlan(tx, shift.auditId);
    const clerkIds = shift.assignments.map((a) => a.userId);
    await tx.shift.delete({ where: { id: shiftId } });
    const leftPlan = await releasePlan(tx, shift.auditId, clerkIds);
    await logActivity(tx, {
      actorId: actor.id,
      action: 'shift.deleted',
      entityType: 'shift',
      entityId: shiftId,
      ip: actor.ip,
      data: { auditId: shift.auditId, name: shift.name, clerkIds, leftPlan },
    });
  });
}
