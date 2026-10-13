import type { ColumnMap, ColumnMappingDto, ImportDto, PushExpectedBody, SetMappingBody } from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import type { Prisma } from '../../infra/db.js';
import { logActivity } from '../../lib/activity.js';
import { sha256Hex } from '../../lib/crypto.js';
import { toImportDto } from '../../lib/dto.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { iso } from '../../lib/time.js';
import { commitExpected } from './commit.js';
import { ParseError, detectFileKind, headerSignature, parseSpreadsheet, suggestMapping } from './parser.js';
import { checkRows, mapRows, type CanonicalRow } from './rows.js';

interface Actor {
  id: string;
  ip: string | null;
}

const SAMPLE_ROWS = 20;
const CONTENT_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
} as const;

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'file';
}

async function openAudit(ctx: AppContext, auditId: string) {
  const audit = await ctx.db.audit.findUnique({ where: { id: auditId }, include: { section: true } });
  if (!audit) throw new NotFoundError('Audit');
  if (audit.status !== 'DRAFT' && audit.status !== 'ACTIVE') {
    throw new ConflictError('This audit is finished, so its list cannot change', 'audit_finished');
  }
  return audit;
}

/** Stores the uploaded file and queues it for reading. Returns straight away. */
export async function uploadImport(
  ctx: AppContext,
  input: { auditId: string; fileName: string; buffer: Buffer },
  actor: Actor,
): Promise<ImportDto> {
  await openAudit(ctx, input.auditId);

  let kind;
  try {
    kind = detectFileKind(input.buffer, input.fileName);
  } catch (err) {
    if (err instanceof ParseError) throw new BadRequestError(err.message, 'bad_file');
    throw err;
  }

  const id = newId();
  const fileName = safeName(input.fileName);
  const storageKey = `imports/${input.auditId}/${id}/${fileName}`;
  await ctx.storage.put(storageKey, input.buffer, CONTENT_TYPES[kind]);

  const batch = await ctx.db.importBatch.create({
    data: {
      id,
      auditId: input.auditId,
      sourceType: 'SPREADSHEET',
      fileName,
      fileSha256: sha256Hex(input.buffer),
      storageKey,
      sizeBytes: input.buffer.length,
      status: 'UPLOADED',
      createdById: actor.id,
    },
  });
  await logActivity(ctx.db, {
    actorId: actor.id,
    action: 'import.uploaded',
    entityType: 'import',
    entityId: id,
    ip: actor.ip,
    data: { auditId: input.auditId, fileName, sizeBytes: input.buffer.length },
  });
  await ctx.queues.addImport({ kind: 'inspect', importId: id });
  return toImportDto(batch);
}

export async function getImport(ctx: AppContext, importId: string): Promise<ImportDto> {
  const batch = await ctx.db.importBatch.findUnique({ where: { id: importId } });
  if (!batch) throw new NotFoundError('Import');
  return toImportDto(batch);
}

export async function listImportsForAudit(ctx: AppContext, auditId: string): Promise<ImportDto[]> {
  const rows = await ctx.db.importBatch.findMany({ where: { auditId }, orderBy: { id: 'desc' }, take: 50 });
  return rows.map(toImportDto);
}

export async function setMapping(ctx: AppContext, importId: string, input: SetMappingBody, actor: Actor): Promise<ImportDto> {
  const batch = await ctx.db.importBatch.findUnique({ where: { id: importId } });
  if (!batch) throw new NotFoundError('Import');
  if (batch.status !== 'READY') {
    throw new ConflictError('This import is not ready for a mapping yet', 'import_not_ready');
  }
  await openAudit(ctx, batch.auditId);

  const unknown = Object.values(input.mapping).filter((h): h is string => !!h && !batch.headers.includes(h));
  if (unknown.length > 0) {
    throw new BadRequestError(`These columns are not in the file: ${unknown.join(', ')}`, 'unknown_columns');
  }
  if (input.mode === 'replace') {
    const scans = await ctx.db.scan.count({ where: { auditId: batch.auditId } });
    if (scans > 0) {
      throw new ConflictError('Scans already exist for this audit. Use append instead of replace.', 'replace_after_scans');
    }
  }

  let mappingId: string | null = batch.mappingId;
  if (input.saveAs) {
    const saved = await ctx.db.columnMapping.upsert({
      where: { name: input.saveAs },
      create: {
        name: input.saveAs,
        headerSignature: headerSignature(batch.headers),
        mapping: input.mapping,
        createdById: actor.id,
      },
      update: { headerSignature: headerSignature(batch.headers), mapping: input.mapping },
    });
    mappingId = saved.id;
  }

  const updated = await ctx.db.importBatch.update({
    where: { id: importId },
    data: { mapping: input.mapping, mode: input.mode, mappingId, validated: false, failureReason: null },
  });
  await ctx.queues.addImport({ kind: 'validate', importId });
  return toImportDto(updated);
}

/** Queues the import to be written into the audit. The status flips so it cannot be committed twice. */
export async function requestCommit(ctx: AppContext, importId: string, actor: Actor): Promise<ImportDto> {
  const batch = await ctx.db.importBatch.findUnique({ where: { id: importId } });
  if (!batch) throw new NotFoundError('Import');
  if (!batch.validated) throw new ConflictError('Check the rows before adding them', 'import_not_validated');
  if (batch.validCount === 0) throw new BadRequestError('No usable rows in this file', 'no_rows');
  await openAudit(ctx, batch.auditId);

  const claimed = await ctx.db.importBatch.updateMany({
    where: { id: importId, status: 'READY', validated: true },
    data: { status: 'PARSING', failureReason: null },
  });
  if (claimed.count === 0) throw new ConflictError('This import is already being added or is done', 'import_busy');

  await logActivity(ctx.db, {
    actorId: actor.id,
    action: 'import.commit_requested',
    entityType: 'import',
    entityId: importId,
    ip: actor.ip,
    data: { auditId: batch.auditId, validCount: batch.validCount, mode: batch.mode },
  });
  await ctx.queues.addImport({ kind: 'commit', importId, actorId: actor.id });
  return getImport(ctx, importId);
}

export async function listMappings(ctx: AppContext): Promise<ColumnMappingDto[]> {
  const rows = await ctx.db.columnMapping.findMany({ orderBy: { name: 'asc' } });
  return rows.map((m) => ({ id: m.id, name: m.name, mapping: m.mapping as ColumnMap, createdAt: iso(m.createdAt) }));
}

/** System to system: an expected list sent as JSON. Runs inline, no file involved. */
export async function pushExpected(
  ctx: AppContext,
  auditId: string,
  input: PushExpectedBody,
  actor: { userId: string | null; serviceName: string | null; ip: string | null },
): Promise<ImportDto> {
  const audit = await openAudit(ctx, auditId);
  const canonical: CanonicalRow[] = input.containers.map((c, i) => ({
    rowNumber: i + 1,
    fields: c,
    raw: null,
  }));
  const checked = checkRows(canonical, audit.section.locationCodes);

  // Service accounts have no user row, so the batch is recorded against the audit creator.
  const createdById = actor.userId ?? audit.createdById;
  const id = newId();
  await ctx.db.importBatch.create({
    data: {
      id,
      auditId,
      sourceType: 'API',
      fileName: actor.serviceName ? `api:${actor.serviceName}`.slice(0, 120) : 'api',
      status: 'PARSING',
      mode: input.mode,
      validated: true,
      rowCount: checked.rowCount,
      validCount: checked.rows.length,
      invalidCount: checked.invalidCount,
      duplicateCount: checked.duplicateCount,
      outOfSectionCount: checked.outOfSectionCount,
      errors: checked.errors as unknown as Prisma.InputJsonValue,
      createdById,
    },
  });

  if (checked.rows.length === 0) {
    const failed = await ctx.db.importBatch.update({
      where: { id },
      data: { status: 'FAILED', failureReason: 'No usable rows' },
    });
    return toImportDto(failed);
  }

  await commitExpected(ctx, {
    auditId,
    importBatchId: id,
    rows: checked.rows,
    mode: input.mode,
    actorId: actor.userId,
    source: 'API',
  });
  const done = await ctx.db.importBatch.update({
    where: { id },
    data: { status: 'COMMITTED', committedAt: new Date() },
  });
  await logActivity(ctx.db, {
    actorId: actor.userId,
    action: 'import.api_push',
    entityType: 'import',
    entityId: id,
    ip: actor.ip,
    data: { auditId, service: actor.serviceName, rows: checked.rows.length },
  });
  return toImportDto(done);
}

// The three background steps. Called from src/jobs/imports.ts.

async function loadParsed(ctx: AppContext, importId: string) {
  const batch = await ctx.db.importBatch.findUnique({
    where: { id: importId },
    include: { audit: { include: { section: true } } },
  });
  if (!batch || !batch.storageKey) throw new Error(`Import ${importId} not found`);
  const buffer = await ctx.storage.getBuffer(batch.storageKey);
  const kind = detectFileKind(buffer, batch.fileName);
  const sheet = parseSpreadsheet(buffer, kind, ctx.env.IMPORT_MAX_ROWS);
  return { batch, sheet };
}

function notify(ctx: AppContext, batch: { id: string; auditId: string; createdById: string }, status: ImportDto['status'], validated: boolean) {
  ctx.broadcaster.toUser(batch.createdById, 'import:status', { importId: batch.id, auditId: batch.auditId, status, validated });
}

async function fail(ctx: AppContext, importId: string, err: unknown, status: 'FAILED' | 'READY') {
  const reason = err instanceof ParseError || err instanceof ConflictError ? err.message : 'The file could not be processed';
  const batch = await ctx.db.importBatch.update({ where: { id: importId }, data: { status, failureReason: reason } });
  notify(ctx, batch, status, batch.validated);
}

export async function runInspect(ctx: AppContext, importId: string): Promise<void> {
  await ctx.db.importBatch.update({ where: { id: importId }, data: { status: 'PARSING' } });
  try {
    const { batch, sheet } = await loadParsed(ctx, importId);
    const sample = sheet.rows.slice(0, SAMPLE_ROWS);

    // A saved mapping for files with these same columns beats guessing.
    const saved = await ctx.db.columnMapping.findFirst({
      where: { headerSignature: headerSignature(sheet.headers) },
      orderBy: { updatedAt: 'desc' },
    });
    const savedMap = saved?.mapping as ColumnMap | undefined;
    const savedFits = savedMap && Object.values(savedMap).every((h) => !h || sheet.headers.includes(h));
    const suggestion = savedFits ? savedMap : suggestMapping(sheet.headers, sample);

    const updated = await ctx.db.importBatch.update({
      where: { id: importId },
      data: {
        status: 'READY',
        sheetName: sheet.sheetName,
        headers: sheet.headers,
        sampleRows: sample.map((r) => r.values),
        rowCount: sheet.rows.length,
        suggestedMapping: suggestion,
        mappingId: savedFits ? saved!.id : null,
        failureReason: null,
      },
    });
    notify(ctx, batch, updated.status, false);
  } catch (err) {
    if (err instanceof ParseError) {
      await fail(ctx, importId, err, 'FAILED');
      return;
    }
    throw err;
  }
}

export async function runValidate(ctx: AppContext, importId: string): Promise<void> {
  const { batch, sheet } = await loadParsed(ctx, importId);
  if (!batch.mapping) throw new Error('No mapping set');
  const checked = checkRows(mapRows(sheet.rows, batch.mapping as ColumnMap), batch.audit.section.locationCodes);
  const updated = await ctx.db.importBatch.update({
    where: { id: importId },
    data: {
      validated: true,
      rowCount: checked.rowCount,
      validCount: checked.rows.length,
      invalidCount: checked.invalidCount,
      duplicateCount: checked.duplicateCount,
      outOfSectionCount: checked.outOfSectionCount,
      errors: checked.errors as unknown as Prisma.InputJsonValue,
    },
  });
  notify(ctx, batch, updated.status, true);
}

export async function runCommit(ctx: AppContext, importId: string, actorId: string): Promise<void> {
  try {
    const { batch, sheet } = await loadParsed(ctx, importId);
    if (!batch.mapping) throw new Error('No mapping set');
    const checked = checkRows(mapRows(sheet.rows, batch.mapping as ColumnMap), batch.audit.section.locationCodes);
    await commitExpected(ctx, {
      auditId: batch.auditId,
      importBatchId: importId,
      rows: checked.rows,
      mode: batch.mode,
      actorId,
      source: 'IMPORT',
    });
    const done = await ctx.db.importBatch.update({
      where: { id: importId },
      data: { status: 'COMMITTED', committedAt: new Date(), validCount: checked.rows.length },
    });
    await logActivity(ctx.db, {
      actorId,
      action: 'import.committed',
      entityType: 'import',
      entityId: importId,
      data: { auditId: batch.auditId, rows: checked.rows.length },
    });
    notify(ctx, done, 'COMMITTED', true);
  } catch (err) {
    // Put it back to READY so the supervisor can try again.
    await fail(ctx, importId, err, 'READY');
    if (!(err instanceof ParseError) && !(err instanceof ConflictError)) throw err;
  }
}
