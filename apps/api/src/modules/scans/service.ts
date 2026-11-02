import { isValidContainerNumber } from '@cymis/iso6346';
import { sameLocation } from '@cymis/schemas';
import type {
  ReviewScanBody,
  ScanDto,
  ScanListQuery,
  SyncResultItem,
  SyncScanItem,
  SyncScansResponse,
} from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import { Prisma, type Audit, type ScanResult } from '../../infra/db.js';
import { logActivity } from '../../lib/activity.js';
import { scanInclude, toScanDto } from '../../lib/dto.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { decodeCursor, pageOf } from '../../lib/pagination.js';
import type { Principal, UserPrincipal } from '../../plugins/auth.js';
import { canSeeAudit, loadAuditFor } from '../audits/access.js';

type Tx = Prisma.TransactionClient;
type SyncUser = UserPrincipal['user'];

/** A phone clock more than a day ahead is wrong, and the scan time cannot be trusted. */
const MAX_FUTURE_MS = 24 * 3600 * 1000;

/** Serialises work on one container in one audit, across every API instance. */
async function lockContainer(tx: Tx, auditId: string, containerNumber: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${auditId}:${containerNumber}`}, 0))`);
}

const NOT_DUPLICATE_OR_REJECTED: Prisma.ScanWhereInput = {
  result: { not: 'DUPLICATE' },
  reviewStatus: { not: 'REJECTED' },
};

/** Works out MATCHED, UNEXPECTED or DUPLICATE for a container. Call inside the container lock. */
async function classify(
  tx: Tx,
  auditId: string,
  containerNumber: string,
  excludeScanId?: string,
): Promise<{ result: ScanResult; expectedContainerId: string | null; duplicateOfId: string | null }> {
  const expected = await tx.expectedContainer.findFirst({
    where: { auditId, containerNumber, removedAt: null },
    select: { id: true },
  });
  const primary = await tx.scan.findFirst({
    where: {
      auditId,
      containerNumber,
      ...NOT_DUPLICATE_OR_REJECTED,
      ...(excludeScanId ? { id: { not: excludeScanId } } : {}),
    },
    orderBy: { receivedAt: 'asc' },
    select: { id: true },
  });
  if (primary) return { result: 'DUPLICATE', expectedContainerId: expected?.id ?? null, duplicateOfId: primary.id };
  return { result: expected ? 'MATCHED' : 'UNEXPECTED', expectedContainerId: expected?.id ?? null, duplicateOfId: null };
}

/** A clerk's location only raises a flag on a box matched to a list row that has a different location. */
async function locationDiffers(tx: Tx, result: ScanResult, expectedContainerId: string | null, foundLocation: string | undefined): Promise<boolean> {
  if (!foundLocation || result !== 'MATCHED' || !expectedContainerId) return false;
  const row = await tx.expectedContainer.findUnique({ where: { id: expectedContainerId }, select: { location: true } });
  return !!row?.location && !sameLocation(row.location, foundLocation);
}

interface AuditCheck {
  audit: Audit | null;
  allowed: boolean;
}

function statusProblem(audit: Audit, capturedAt: Date): { code: string; reason: string } | null {
  switch (audit.status) {
    case 'ACTIVE':
      return null;
    case 'CLOSED':
      // Scans made before the close still count, even if the phone was offline until now.
      if (audit.closedAt && capturedAt <= audit.closedAt) return null;
      return { code: 'audit_closed', reason: 'This yard plan was closed before the scan was made' };
    case 'DRAFT':
      return { code: 'audit_not_started', reason: 'This yard plan has not been started yet' };
    case 'CANCELLED':
      return { code: 'audit_cancelled', reason: 'This yard plan was cancelled' };
  }
}

async function loadScanDto(ctx: AppContext | { db: Tx }, id: string): Promise<ScanDto | null> {
  const s = await ctx.db.scan.findUnique({ where: { id }, include: scanInclude });
  return s ? toScanDto(s) : null;
}

async function syncOne(
  ctx: AppContext,
  user: SyncUser,
  item: SyncScanItem,
  check: AuditCheck,
): Promise<{ result: SyncResultItem; created: boolean }> {
  const reject = (code: string, reason: string) => ({
    result: { id: item.id, status: 'rejected' as const, code, reason },
    created: false,
  });

  if (!check.audit || !check.allowed) return reject('audit_not_found', 'This yard plan is not available to you');
  const capturedAt = new Date(item.capturedAt);
  if (capturedAt.getTime() - Date.now() > MAX_FUTURE_MS) {
    return reject('bad_clock', 'The phone clock is wrong. Fix the date and time, then sync again');
  }

  const existing = await ctx.db.scan.findUnique({ where: { id: item.id }, select: { auditId: true, auditorId: true } });
  if (existing) {
    if (existing.auditId === item.auditId && existing.auditorId === user.id) {
      return { result: { id: item.id, status: 'unchanged', scan: (await loadScanDto(ctx, item.id))! }, created: false };
    }
    return reject('id_conflict', 'This scan id is already used');
  }

  const problem = statusProblem(check.audit, capturedAt);
  if (problem) return reject(problem.code, problem.reason);

  const audit = check.audit;
  const checkDigitValid = isValidContainerNumber(item.containerNumber);

  try {
    const created = await ctx.db.$transaction(async (tx) => {
      await lockContainer(tx, audit.id, item.containerNumber);
      if (await tx.scan.findUnique({ where: { id: item.id }, select: { id: true } })) return false;

      const c = await classify(tx, audit.id, item.containerNumber);
      const moved = await locationDiffers(tx, c.result, c.expectedContainerId, item.foundLocation);
      await tx.scan.create({
        data: {
          id: item.id,
          auditId: audit.id,
          auditorId: user.id,
          deviceId: item.deviceId,
          containerNumber: item.containerNumber,
          checkDigitValid,
          entryMethod: item.entryMethod,
          ocrRaw: item.ocrRaw ?? null,
          ocrConfidence: item.ocrConfidence ?? null,
          capturedAt,
          lat: item.location?.lat ?? null,
          lng: item.location?.lng ?? null,
          accuracyM: item.location?.accuracyM ?? null,
          colourChosen: item.colourChosen ?? null,
          result: c.result,
          expectedContainerId: c.expectedContainerId,
          duplicateOfId: c.duplicateOfId,
          foundLocation: item.foundLocation ?? null,
          flags: [...(checkDigitValid ? [] : (['CHECK_DIGIT_FAILED'] as const)), ...(moved ? (['LOCATION_MISMATCH'] as const) : [])],
          reviewStatus: checkDigitValid && !moved ? 'NONE' : 'PENDING',
        },
      });
      await tx.containerEvent.create({
        data: {
          containerNumber: item.containerNumber,
          type: 'AUDITED',
          source: 'SCAN',
          sectionId: audit.sectionId,
          auditId: audit.id,
          scanId: item.id,
          actorId: user.id,
          occurredAt: capturedAt,
          data: { result: c.result, entryMethod: item.entryMethod },
        },
      });
      return true;
    });

    const scan = (await loadScanDto(ctx, item.id))!;
    return { result: { id: item.id, status: created ? 'created' : 'unchanged', scan }, created };
  } catch (err) {
    // Two requests with the same id raced and the other one won.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { result: { id: item.id, status: 'unchanged', scan: (await loadScanDto(ctx, item.id))! }, created: false };
    }
    throw err;
  }
}

/**
 * Takes a batch of scans from a phone. Each scan is handled on its own, so one
 * bad scan never blocks the rest, and every scan gets its own answer.
 */
export async function syncScans(ctx: AppContext, user: SyncUser, items: SyncScanItem[]): Promise<SyncScansResponse> {
  const checks = new Map<string, AuditCheck>();
  const principal: Principal = { kind: 'user', user };
  for (const auditId of new Set(items.map((i) => i.auditId))) {
    const audit = await ctx.db.audit.findUnique({ where: { id: auditId } });
    checks.set(auditId, { audit, allowed: audit ? await canSeeAudit(ctx, auditId, principal) : false });
  }

  const results: SyncResultItem[] = [];
  const touched = new Set<string>();
  for (const item of items) {
    const { result, created } = await syncOne(ctx, user, item, checks.get(item.auditId)!);
    results.push(result);
    if (created && result.scan) {
      touched.add(item.auditId);
      ctx.broadcaster.toAudit(item.auditId, 'scan:created', { auditId: item.auditId, scan: result.scan });
      if (result.scan.flags.length > 0) {
        ctx.broadcaster.toAudit(item.auditId, 'flag:raised', {
          auditId: item.auditId,
          scanId: result.scan.id,
          flags: result.scan.flags,
        });
      }
    }
  }

  for (const auditId of touched) {
    ctx.progress.schedule(auditId);
    await ctx.presence.touch(auditId, { id: user.id, fullName: user.fullName });
  }
  return { results, serverTime: new Date().toISOString() };
}

export async function listScans(ctx: AppContext, principal: Principal, auditId: string, q: ScanListQuery) {
  await loadAuditFor(ctx, auditId, principal, { scopes: ['results:read'] });
  const cursor = decodeCursor(q.cursor);
  const where: Prisma.ScanWhereInput = {
    auditId,
    ...(q.result ? { result: q.result } : {}),
    ...(q.flagged === true ? { flags: { isEmpty: false } } : {}),
    ...(q.flagged === false ? { flags: { isEmpty: true } } : {}),
    ...(q.reviewStatus ? { reviewStatus: q.reviewStatus } : {}),
    ...(q.locationDecision ? { locationDecision: q.locationDecision } : {}),
    ...(q.auditorId ? { auditorId: q.auditorId } : {}),
    ...(q.q ? { containerNumber: { startsWith: q.q } } : {}),
  };
  const rows = await ctx.db.scan.findMany({
    where,
    include: scanInclude,
    orderBy: { id: 'desc' },
    take: q.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = pageOf(rows, q.limit);
  return { items: page.items.map(toScanDto), nextCursor: page.nextCursor };
}

export async function getScan(ctx: AppContext, principal: Principal, scanId: string): Promise<ScanDto> {
  const scan = await ctx.db.scan.findUnique({ where: { id: scanId }, include: scanInclude });
  if (!scan) throw new NotFoundError('Scan');
  await loadAuditFor(ctx, scan.auditId, principal, { scopes: ['results:read'] });
  return toScanDto(scan);
}

/**
 * When the primary scan of a container stops counting (rejected, or its number
 * corrected), the next scan of that container takes its place, and the other
 * duplicates point at it.
 */
async function promoteNextPrimary(tx: Tx, auditId: string, containerNumber: string, excludeId: string): Promise<string | null> {
  await lockContainer(tx, auditId, containerNumber);
  const stillPrimary = await tx.scan.findFirst({
    where: { auditId, containerNumber, ...NOT_DUPLICATE_OR_REJECTED, id: { not: excludeId } },
    select: { id: true },
  });
  if (stillPrimary) return null;

  const next = await tx.scan.findFirst({
    where: { auditId, containerNumber, result: 'DUPLICATE', reviewStatus: { not: 'REJECTED' }, id: { not: excludeId } },
    orderBy: { receivedAt: 'asc' },
    select: { id: true },
  });
  if (!next) return null;

  const expected = await tx.expectedContainer.findFirst({
    where: { auditId, containerNumber, removedAt: null },
    select: { id: true },
  });
  await tx.scan.update({
    where: { id: next.id },
    data: {
      result: expected ? 'MATCHED' : 'UNEXPECTED',
      expectedContainerId: expected?.id ?? null,
      duplicateOfId: null,
    },
  });
  await tx.scan.updateMany({
    where: { auditId, containerNumber, result: 'DUPLICATE', id: { notIn: [next.id, excludeId] } },
    data: { duplicateOfId: next.id },
  });
  return next.id;
}

/**
 * A supervisor's answer to "the list says here, the clerk found it there". The
 * box really was found either way, so the scan stays the primary one and counts
 * as found. Nothing here runs the promote path: that is only for scans that stop counting.
 */
async function decideLocation(
  tx: Tx,
  scan: Prisma.ScanGetPayload<object>,
  action: 'UPDATE_LIST' | 'MOVE_BACK',
  base: { reviewNote: string | null; reviewedById: string; reviewedAt: Date },
): Promise<{ listVersion: number | null; listLocation: string | null; foundLocation: string }> {
  if (!scan.foundLocation || !scan.flags.includes('LOCATION_MISMATCH') || scan.reviewStatus !== 'PENDING' || scan.locationDecision) {
    throw new ConflictError('This scan has no location waiting for a decision', 'no_location_decision');
  }
  const row = scan.expectedContainerId
    ? await tx.expectedContainer.findFirst({ where: { id: scan.expectedContainerId, removedAt: null }, select: { id: true, location: true } })
    : null;

  let listVersion: number | null = null;
  if (action === 'UPDATE_LIST') {
    if (!row) throw new ConflictError('That box is no longer on the list', 'not_on_list');
    // The same order as an import: the audit row first, so the two take turns.
    const bumped = await tx.$queryRaw<{ listVersion: number }[]>(Prisma.sql`
      UPDATE audits SET "listVersion" = "listVersion" + 1, "updatedAt" = now()
      WHERE id = ${scan.auditId}::uuid AND status = 'ACTIVE'
      RETURNING "listVersion"
    `);
    listVersion = bumped[0]?.listVersion ?? null;
    if (listVersion === null) throw new ConflictError('This yard plan is finished, so its list cannot change', 'audit_finished');
    await tx.expectedContainer.update({ where: { id: row.id }, data: { location: scan.foundLocation, version: listVersion } });
  }
  await tx.scan.update({
    where: { id: scan.id },
    data: { ...base, reviewStatus: 'APPROVED', locationDecision: action === 'UPDATE_LIST' ? 'LIST_UPDATED' : 'MOVE_BACK' },
  });
  return { listVersion, listLocation: row?.location ?? null, foundLocation: scan.foundLocation };
}

export async function reviewScan(
  ctx: AppContext,
  user: SyncUser,
  scanId: string,
  input: ReviewScanBody,
  ip: string | null,
): Promise<ScanDto> {
  const scan = await ctx.db.scan.findUnique({ where: { id: scanId }, include: { audit: true } });
  if (!scan) throw new NotFoundError('Scan');
  if (scan.audit.status === 'CANCELLED') throw new ConflictError('This yard plan was cancelled', 'audit_cancelled');

  const changed: string[] = [scanId];
  const now = new Date();
  let newListVersion: number | null = null;

  await ctx.db.$transaction(async (tx) => {
    // Lock every container this review touches, always in the same order, so
    // two reviews can never wait on each other.
    const toLock = [...new Set([scan.containerNumber, input.correctedNumber ?? scan.containerNumber])].sort();
    for (const n of toLock) await lockContainer(tx, scan.auditId, n);

    // Read again under the lock; someone else may have reviewed it a moment ago.
    const fresh = await tx.scan.findUniqueOrThrow({ where: { id: scanId } });
    if (fresh.containerNumber !== scan.containerNumber) {
      throw new ConflictError('This scan was just changed by someone else. Reload and try again', 'scan_changed');
    }
    const wasPrimary = fresh.result !== 'DUPLICATE' && fresh.reviewStatus !== 'REJECTED';

    const base = { reviewNote: input.note ?? null, reviewedById: user.id, reviewedAt: now };
    let decided: Awaited<ReturnType<typeof decideLocation>> | null = null;

    if (input.action === 'UPDATE_LIST' || input.action === 'MOVE_BACK') {
      decided = await decideLocation(tx, fresh, input.action, base);
      newListVersion = decided.listVersion;
    } else if (input.action === 'APPROVE') {
      await tx.scan.update({ where: { id: scanId }, data: { ...base, reviewStatus: 'APPROVED' } });
    } else if (input.action === 'REJECT') {
      await tx.scan.update({ where: { id: scanId }, data: { ...base, reviewStatus: 'REJECTED' } });
      if (wasPrimary) {
        const promoted = await promoteNextPrimary(tx, scan.auditId, scan.containerNumber, scanId);
        if (promoted) changed.push(promoted);
      }
    } else {
      const newNumber = input.correctedNumber ?? scan.containerNumber;
      const numberChanged = newNumber !== scan.containerNumber;
      let placement = {};
      if (numberChanged) {
        const c = await classify(tx, scan.auditId, newNumber, scanId);
        placement = {
          containerNumber: newNumber,
          checkDigitValid: true,
          result: c.result,
          expectedContainerId: c.expectedContainerId,
          duplicateOfId: c.duplicateOfId,
        };
      }
      await tx.scan.update({
        where: { id: scanId },
        data: {
          ...base,
          ...placement,
          ...(input.correctedColour ? { colourChosen: input.correctedColour } : {}),
          reviewStatus: 'CORRECTED',
        },
      });
      if (numberChanged && wasPrimary) {
        const promoted = await promoteNextPrimary(tx, scan.auditId, scan.containerNumber, scanId);
        if (promoted) changed.push(promoted);
      }
    }

    await tx.containerEvent.create({
      data: {
        containerNumber: input.correctedNumber ?? scan.containerNumber,
        type: 'AUDITED',
        source: 'REVIEW',
        sectionId: scan.audit.sectionId,
        auditId: scan.auditId,
        scanId,
        actorId: user.id,
        occurredAt: now,
        data: {
          action: input.action,
          ...(input.correctedNumber ? { from: scan.containerNumber, to: input.correctedNumber } : {}),
          ...(input.correctedColour ? { colour: input.correctedColour } : {}),
          ...(decided ? { listLocation: decided.listLocation, foundLocation: decided.foundLocation } : {}),
        },
      },
    });
    await logActivity(tx, {
      actorId: user.id,
      action: `scan.${input.action.toLowerCase()}`,
      entityType: 'scan',
      entityId: scanId,
      ip,
      data: { auditId: scan.auditId, note: input.note ?? null },
    });
  });

  for (const id of changed) {
    const dto = await loadScanDto(ctx, id);
    if (dto) ctx.broadcaster.toAudit(scan.auditId, 'scan:updated', { auditId: scan.auditId, scan: dto });
  }
  ctx.progress.schedule(scan.auditId);
  if (newListVersion !== null) ctx.broadcaster.toAudit(scan.auditId, 'expected:updated', { auditId: scan.auditId, listVersion: newListVersion });
  return (await loadScanDto(ctx, scanId))!;
}
