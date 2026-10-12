import type {
  AuditDto,
  AuditListQuery,
  Bucket,
  CreateAuditBody,
  ExpectedResponse,
  ResultRow,
  SetAssigneesBody,
  UpdateAuditBody,
} from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import type { AuditStatus, Prisma } from '../../infra/db.js';
import { logActivity } from '../../lib/activity.js';
import { auditInclude, toAuditDto, toExpectedDto } from '../../lib/dto.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { decodeCursor, pageOf } from '../../lib/pagination.js';
import { iso } from '../../lib/time.js';
import type { Principal } from '../../plugins/auth.js';
import { loadAuditFor } from './access.js';

interface Actor {
  id: string;
  ip: string | null;
}

async function dto(ctx: AppContext, auditId: string): Promise<AuditDto> {
  const audit = await ctx.db.audit.findUnique({ where: { id: auditId }, include: auditInclude });
  if (!audit) throw new NotFoundError('Audit');
  return toAuditDto(audit, await ctx.progress.get(auditId));
}

export async function listAudits(ctx: AppContext, principal: Principal, q: AuditListQuery) {
  const cursor = decodeCursor(q.cursor);
  const onlyMine = principal.kind === 'user' && (principal.user.role === 'AUDITOR' || q.mine === true);
  const where: Prisma.AuditWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.sectionId ? { sectionId: q.sectionId } : {}),
    ...(onlyMine && principal.kind === 'user' ? { assignments: { some: { userId: principal.user.id } } } : {}),
  };
  const rows = await ctx.db.audit.findMany({
    where,
    include: auditInclude,
    orderBy: { id: 'desc' },
    take: q.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = pageOf(rows, q.limit);
  const counts = await ctx.progress.getMany(page.items.map((a) => a.id));
  return {
    items: page.items.map((a) => toAuditDto(a, counts.get(a.id)!)),
    nextCursor: page.nextCursor,
  };
}

export async function getAudit(ctx: AppContext, principal: Principal, auditId: string): Promise<AuditDto> {
  await loadAuditFor(ctx, auditId, principal, { scopes: ['audits:read', 'results:read'] });
  return dto(ctx, auditId);
}

export async function createAudit(ctx: AppContext, input: CreateAuditBody, actor: Actor): Promise<AuditDto> {
  const section = await ctx.db.section.findUnique({ where: { id: input.sectionId }, include: { facility: true } });
  if (!section || !section.isActive || !section.facility.isActive) throw new NotFoundError('Section');
  const audit = await ctx.db.$transaction(async (tx) => {
    const a = await tx.audit.create({
      data: { sectionId: input.sectionId, name: input.name, notes: input.notes ?? null, createdById: actor.id },
    });
    await logActivity(tx, {
      actorId: actor.id,
      action: 'audit.created',
      entityType: 'audit',
      entityId: a.id,
      ip: actor.ip,
      data: { name: a.name, sectionId: a.sectionId },
    });
    return a;
  });
  return dto(ctx, audit.id);
}

const OPEN: AuditStatus[] = ['DRAFT', 'ACTIVE'];

export async function updateAudit(ctx: AppContext, auditId: string, input: UpdateAuditBody, actor: Actor) {
  const audit = await ctx.db.audit.findUnique({ where: { id: auditId } });
  if (!audit) throw new NotFoundError('Audit');
  if (!OPEN.includes(audit.status)) throw new ConflictError('This audit is finished and cannot be changed', 'audit_finished');
  await ctx.db.audit.update({ where: { id: auditId }, data: input });
  await logActivity(ctx.db, {
    actorId: actor.id,
    action: 'audit.updated',
    entityType: 'audit',
    entityId: auditId,
    ip: actor.ip,
    data: { changes: input },
  });
  return dto(ctx, auditId);
}

/**
 * Moves an audit to a new status. The update only matches the allowed starting
 * statuses, so two people pressing the button at once cannot both win.
 */
async function transition(
  ctx: AppContext,
  auditId: string,
  from: AuditStatus[],
  to: AuditStatus,
  actor: Actor,
  extra: Prisma.AuditUncheckedUpdateManyInput,
): Promise<AuditDto> {
  const result = await ctx.db.audit.updateMany({
    where: { id: auditId, status: { in: from } },
    data: { status: to, ...extra },
  });
  if (result.count === 0) {
    const exists = await ctx.db.audit.findUnique({ where: { id: auditId }, select: { status: true } });
    if (!exists) throw new NotFoundError('Audit');
    throw new ConflictError(`This audit is ${exists.status.toLowerCase()} and cannot be moved to ${to.toLowerCase()}`, 'bad_status');
  }
  await logActivity(ctx.db, {
    actorId: actor.id,
    action: `audit.${to.toLowerCase()}`,
    entityType: 'audit',
    entityId: auditId,
    ip: actor.ip,
  });
  const at = new Date().toISOString();
  ctx.broadcaster.toAudit(auditId, 'audit:status', { auditId, status: to, at });
  ctx.broadcaster.toSupervisors('audit:status', { auditId, status: to, at });
  return dto(ctx, auditId);
}

export function startAudit(ctx: AppContext, auditId: string, actor: Actor) {
  return transition(ctx, auditId, ['DRAFT'], 'ACTIVE', actor, { startedAt: new Date() });
}

export function closeAudit(ctx: AppContext, auditId: string, actor: Actor) {
  return transition(ctx, auditId, ['ACTIVE'], 'CLOSED', actor, { closedAt: new Date(), closedById: actor.id });
}

export function cancelAudit(ctx: AppContext, auditId: string, actor: Actor) {
  return transition(ctx, auditId, ['DRAFT', 'ACTIVE'], 'CANCELLED', actor, { closedAt: new Date(), closedById: actor.id });
}

export async function setAssignees(ctx: AppContext, auditId: string, input: SetAssigneesBody, actor: Actor) {
  const audit = await ctx.db.audit.findUnique({ where: { id: auditId }, select: { status: true } });
  if (!audit) throw new NotFoundError('Audit');
  if (!OPEN.includes(audit.status)) throw new ConflictError('This audit is finished and cannot be changed', 'audit_finished');

  const ids = [...new Set(input.userIds)];
  if (ids.length > 0) {
    const valid = await ctx.db.user.count({
      where: { id: { in: ids }, isActive: true, role: { in: ['AUDITOR', 'SUPERVISOR'] } },
    });
    if (valid !== ids.length) {
      throw new BadRequestError('Only active crew and supervisors can be assigned', 'bad_assignee');
    }
  }

  await ctx.db.$transaction(async (tx) => {
    await tx.auditAssignment.deleteMany({ where: { auditId, userId: { notIn: ids } } });
    await tx.auditAssignment.createMany({ data: ids.map((userId) => ({ auditId, userId })), skipDuplicates: true });
    await logActivity(tx, {
      actorId: actor.id,
      action: 'audit.assignees_set',
      entityType: 'audit',
      entityId: auditId,
      ip: actor.ip,
      data: { userIds: ids },
    });
  });
  return dto(ctx, auditId);
}

/**
 * The expected list for phones. With sinceVersion, only rows changed after
 * that version come back (removed rows included, marked removed), so a phone
 * that already has the list downloads a few rows instead of thousands.
 */
export async function getExpected(
  ctx: AppContext,
  principal: Principal,
  auditId: string,
  sinceVersion: number | undefined,
): Promise<ExpectedResponse> {
  const audit = await loadAuditFor(ctx, auditId, principal, { scopes: ['audits:read', 'results:read'] });
  const full = sinceVersion === undefined || sinceVersion > audit.listVersion;
  const rows = await ctx.db.expectedContainer.findMany({
    where: full ? { auditId, removedAt: null } : { auditId, version: { gt: sinceVersion } },
    orderBy: { containerNumber: 'asc' },
  });
  return { auditId, listVersion: audit.listVersion, full, items: rows.map(toExpectedDto) };
}

const PRIMARY: Prisma.ScanWhereInput = { result: { not: 'DUPLICATE' }, reviewStatus: { not: 'REJECTED' } };

function scanBucketWhere(auditId: string, bucket: Exclude<Bucket, 'missing'>): Prisma.ScanWhereInput {
  switch (bucket) {
    case 'found':
      return { auditId, ...PRIMARY, result: 'MATCHED', reviewStatus: { notIn: ['REJECTED', 'PENDING'] } };
    case 'unexpected':
      return { auditId, ...PRIMARY, result: 'UNEXPECTED', reviewStatus: { notIn: ['REJECTED', 'PENDING'] } };
    case 'mismatched':
      return { auditId, result: { not: 'DUPLICATE' }, reviewStatus: 'PENDING' };
  }
}

/** One page of one bucket. Used by the dashboard, the integration API and reports. */
export async function getResultsPage(
  ctx: AppContext,
  auditId: string,
  bucket: Bucket,
  cursorParam: string | undefined,
  limit: number,
): Promise<{ items: ResultRow[]; nextCursor: string | null }> {
  const cursor = decodeCursor(cursorParam);
  const paging = { take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) };

  if (bucket === 'missing') {
    const rows = await ctx.db.expectedContainer.findMany({
      where: {
        auditId,
        removedAt: null,
        scans: { none: { result: 'MATCHED', reviewStatus: { not: 'REJECTED' } } },
      },
      orderBy: { id: 'asc' },
      ...paging,
    });
    const page = pageOf(rows, limit);
    return {
      nextCursor: page.nextCursor,
      items: page.items.map((e) => ({
        bucket,
        containerNumber: e.containerNumber,
        expectedContainerId: e.id,
        scanId: null,
        location: e.location,
        colour: null,
        scannedAt: null,
        scannedBy: null,
        flags: e.checkDigitValid ? [] : ['CHECK_DIGIT_FAILED'],
      })),
    };
  }

  const rows = await ctx.db.scan.findMany({
    where: scanBucketWhere(auditId, bucket),
    include: {
      auditor: { select: { fullName: true } },
      expectedContainer: { select: { location: true } },
    },
    orderBy: { id: 'asc' },
    ...paging,
  });
  const page = pageOf(rows, limit);
  return {
    nextCursor: page.nextCursor,
    items: page.items.map((s) => ({
      bucket,
      containerNumber: s.containerNumber,
      expectedContainerId: s.expectedContainerId,
      scanId: s.id,
      location: s.expectedContainer?.location ?? null,
      colour: s.colourChosen ?? s.colourSuggested,
      scannedAt: iso(s.capturedAt),
      scannedBy: s.auditor.fullName,
      flags: s.flags,
    })),
  };
}
