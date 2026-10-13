import type { AppContext } from '../../context.js';
import { Prisma } from '../../infra/db.js';
import { ConflictError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import type { ExpectedRow } from './rows.js';

const CHUNK = 1000;
const TX_OPTIONS = { timeout: 180_000, maxWait: 15_000 };

export interface CommitInput {
  auditId: string;
  importBatchId: string | null;
  rows: ExpectedRow[];
  mode: 'append' | 'replace';
  actorId: string | null;
  source: 'IMPORT' | 'API';
}

export interface CommitOutcome {
  listVersion: number;
  upserted: number;
  removed: number;
  rematched: number;
}

/**
 * Writes rows into an audit's expected list in one transaction.
 *
 * - Bumps the audit's listVersion first. That also locks the audit row, so two
 *   imports into the same audit run one after the other.
 * - Upserts in chunks with INSERT ... ON CONFLICT, passing each chunk as one
 *   JSON parameter. Nothing is pasted into the SQL text.
 * - Replace mode removes rows that are not in the new list (soft delete, so
 *   phones see the removal through the delta download). Only allowed before
 *   any scans exist.
 * - Scans already marked unexpected are matched again, in case the new rows
 *   now cover them.
 */
export async function commitExpected(ctx: AppContext, input: CommitInput): Promise<CommitOutcome> {
  const { auditId } = input;

  const outcome = await ctx.db.$transaction(async (tx) => {
    const bumped = await tx.$queryRaw<{ listVersion: number }[]>(Prisma.sql`
      UPDATE audits SET "listVersion" = "listVersion" + 1, "updatedAt" = now()
      WHERE id = ${auditId}::uuid AND status IN ('DRAFT', 'ACTIVE')
      RETURNING "listVersion"
    `);
    const version = bumped[0]?.listVersion;
    if (version === undefined) {
      throw new ConflictError('This audit is finished, so its list cannot change', 'audit_finished');
    }

    let removed = 0;
    if (input.mode === 'replace') {
      const scans = await tx.scan.count({ where: { auditId } });
      if (scans > 0) {
        throw new ConflictError('Scans already exist for this audit. Use append instead of replace.', 'replace_after_scans');
      }
      const keep = JSON.stringify(input.rows.map((r) => r.containerNumber));
      removed = await tx.$executeRaw(Prisma.sql`
        UPDATE expected_containers
        SET "removedAt" = now(), version = ${version}, "updatedAt" = now()
        WHERE "auditId" = ${auditId}::uuid
          AND "removedAt" IS NULL
          AND "containerNumber" NOT IN (SELECT jsonb_array_elements_text(${keep}::jsonb))
      `);
    }

    let upserted = 0;
    for (let i = 0; i < input.rows.length; i += CHUNK) {
      const chunk = input.rows.slice(i, i + CHUNK).map((r) => ({ id: newId(), ...r }));
      upserted += await tx.$executeRaw(Prisma.sql`
        INSERT INTO expected_containers (
          "id", "auditId", "importBatchId", "containerNumber", "checkDigitValid",
          "sizeType", "location", "vessel", "voyage", "fullEmpty", "lineOperator", "category",
          "raw", "rowNumber", "version", "removedAt", "createdAt", "updatedAt"
        )
        SELECT
          x.id, ${auditId}::uuid, ${input.importBatchId}::uuid, x."containerNumber", x."checkDigitValid",
          x."sizeType", x."location", x."vessel", x."voyage", x."fullEmpty", x."lineOperator", x."category",
          x."raw", x."rowNumber", ${version}, NULL, now(), now()
        FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS x(
          id uuid, "containerNumber" text, "checkDigitValid" boolean,
          "sizeType" text, "location" text, "vessel" text, "voyage" text, "fullEmpty" text,
          "lineOperator" text, "category" text, "raw" jsonb, "rowNumber" int
        )
        ON CONFLICT ("auditId", "containerNumber") DO UPDATE SET
          "importBatchId" = EXCLUDED."importBatchId",
          "checkDigitValid" = EXCLUDED."checkDigitValid",
          "sizeType" = COALESCE(EXCLUDED."sizeType", expected_containers."sizeType"),
          "location" = COALESCE(EXCLUDED."location", expected_containers."location"),
          "vessel" = COALESCE(EXCLUDED."vessel", expected_containers."vessel"),
          "voyage" = COALESCE(EXCLUDED."voyage", expected_containers."voyage"),
          "fullEmpty" = COALESCE(EXCLUDED."fullEmpty", expected_containers."fullEmpty"),
          "lineOperator" = COALESCE(EXCLUDED."lineOperator", expected_containers."lineOperator"),
          "category" = COALESCE(EXCLUDED."category", expected_containers."category"),
          "raw" = EXCLUDED."raw",
          "rowNumber" = EXCLUDED."rowNumber",
          "version" = EXCLUDED."version",
          "removedAt" = NULL,
          "updatedAt" = now()
      `);
    }

    const audit = await tx.audit.findUniqueOrThrow({ where: { id: auditId }, select: { sectionId: true } });
    const now = new Date();
    for (let i = 0; i < input.rows.length; i += CHUNK * 5) {
      await tx.containerEvent.createMany({
        data: input.rows.slice(i, i + CHUNK * 5).map((r) => ({
          id: newId(),
          containerNumber: r.containerNumber,
          type: 'IMPORTED' as const,
          source: input.source,
          sectionId: audit.sectionId,
          auditId,
          actorId: input.actorId,
          occurredAt: now,
          data: { importBatchId: input.importBatchId, location: r.location },
        })),
      });
    }

    const rematched = await tx.$executeRaw(Prisma.sql`
      UPDATE scans s
      SET result = 'MATCHED', "expectedContainerId" = e.id, "updatedAt" = now()
      FROM expected_containers e
      WHERE s."auditId" = ${auditId}::uuid
        AND s.result = 'UNEXPECTED'
        AND e."auditId" = s."auditId"
        AND e."containerNumber" = s."containerNumber"
        AND e."removedAt" IS NULL
    `);

    return { listVersion: version, upserted, removed, rematched };
  }, TX_OPTIONS);

  ctx.progress.schedule(auditId);
  ctx.broadcaster.toAudit(auditId, 'expected:updated', { auditId, listVersion: outcome.listVersion });
  return outcome;
}
