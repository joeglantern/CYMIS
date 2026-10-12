import type { AuditCounts } from '@cymis/schemas';
import type { Redis } from 'ioredis';
import type { Broadcaster } from './broadcaster.js';
import { Prisma, type Db } from './db.js';

const CACHE_TTL_SECONDS = 15;
const BROADCAST_DELAY_MS = 1_000;
const cacheKey = (auditId: string) => `audit:counts:${auditId}`;

interface CountRow {
  expected: bigint;
  found: bigint;
  unexpected: bigint;
  mismatched: bigint;
  matched_any: bigint;
  duplicates: bigint;
  scans: bigint;
  pending_review: bigint;
}

/**
 * Bucket rules (see docs/data-model.md):
 * - A "primary" scan is the first scan of a container in an audit that was not rejected.
 * - mismatched: primary scans waiting for review (a flag was raised).
 * - found:      primary scans that matched the list and are not waiting for review.
 * - unexpected: primary scans not on the list and not waiting for review.
 * - missing:    expected containers with no primary scan at all.
 */
export async function computeCounts(db: Db, auditId: string): Promise<AuditCounts> {
  const rows = await db.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT
      (SELECT count(*) FROM expected_containers e
         WHERE e."auditId" = ${auditId}::uuid AND e."removedAt" IS NULL) AS expected,
      count(*) FILTER (WHERE s.result <> 'DUPLICATE' AND s."reviewStatus" NOT IN ('REJECTED', 'PENDING') AND s.result = 'MATCHED') AS found,
      count(*) FILTER (WHERE s.result <> 'DUPLICATE' AND s."reviewStatus" NOT IN ('REJECTED', 'PENDING') AND s.result = 'UNEXPECTED') AS unexpected,
      count(*) FILTER (WHERE s.result <> 'DUPLICATE' AND s."reviewStatus" = 'PENDING') AS mismatched,
      count(*) FILTER (WHERE s.result = 'MATCHED' AND s."reviewStatus" <> 'REJECTED') AS matched_any,
      count(*) FILTER (WHERE s.result = 'DUPLICATE') AS duplicates,
      count(*) AS scans,
      count(*) FILTER (WHERE s."reviewStatus" = 'PENDING') AS pending_review
    FROM scans s
    WHERE s."auditId" = ${auditId}::uuid
  `);
  const r = rows[0];
  if (!r) {
    return { expected: 0, found: 0, missing: 0, unexpected: 0, mismatched: 0, duplicates: 0, scans: 0, pendingReview: 0 };
  }
  const expected = Number(r.expected);
  return {
    expected,
    found: Number(r.found),
    missing: Math.max(0, expected - Number(r.matched_any)),
    unexpected: Number(r.unexpected),
    mismatched: Number(r.mismatched),
    duplicates: Number(r.duplicates),
    scans: Number(r.scans),
    pendingReview: Number(r.pending_review),
  };
}

/** Counts with a short Redis cache, plus coalesced live updates. */
export class ProgressService {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly db: Db,
    private readonly redis: Redis,
    private readonly broadcaster: Broadcaster,
  ) {}

  async get(auditId: string): Promise<AuditCounts> {
    const cached = await this.redis.get(cacheKey(auditId));
    if (cached) return JSON.parse(cached) as AuditCounts;
    const counts = await computeCounts(this.db, auditId);
    await this.redis.set(cacheKey(auditId), JSON.stringify(counts), 'EX', CACHE_TTL_SECONDS);
    return counts;
  }

  /** Many counts at once, for lists. Uses the cache where it can. */
  async getMany(auditIds: string[]): Promise<Map<string, AuditCounts>> {
    const out = new Map<string, AuditCounts>();
    await Promise.all(
      auditIds.map(async (id) => {
        out.set(id, await this.get(id));
      }),
    );
    return out;
  }

  async invalidate(auditId: string): Promise<void> {
    await this.redis.del(cacheKey(auditId));
  }

  /**
   * Call after anything that changes the counts. Many scans arriving at once
   * produce one broadcast per second per audit, not one per scan.
   */
  schedule(auditId: string): void {
    void this.invalidate(auditId).catch(() => undefined);
    if (this.timers.has(auditId)) return;
    const timer = setTimeout(() => {
      this.timers.delete(auditId);
      void this.flush(auditId).catch(() => undefined);
    }, BROADCAST_DELAY_MS);
    timer.unref();
    this.timers.set(auditId, timer);
  }

  private async flush(auditId: string): Promise<void> {
    await this.invalidate(auditId);
    const counts = await this.get(auditId);
    this.broadcaster.toAudit(auditId, 'audit:progress', { auditId, counts, at: new Date().toISOString() });
    this.broadcaster.toSupervisors('audit:progress', { auditId, counts, at: new Date().toISOString() });
  }

  /** Sends anything still waiting. Used on shutdown and in tests. */
  async flushAll(): Promise<void> {
    const ids = [...this.timers.keys()];
    for (const id of ids) {
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
    }
    await Promise.all(ids.map((id) => this.flush(id)));
  }
}
