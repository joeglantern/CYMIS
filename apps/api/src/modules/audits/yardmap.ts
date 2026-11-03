import { splitLocation, type BayCounts, type BaysResponse, type MapBlock, type YardMapResponse } from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import { Prisma } from '../../infra/db.js';
import { iso } from '../../lib/time.js';
import type { Principal } from '../../plugins/auth.js';
import { loadAuditFor } from './access.js';

const POINT_LIMIT = 200;

type Bucket = keyof BayCounts;
const empty = (): BayCounts => ({ found: 0, missing: 0, unexpected: 0, mismatched: 0 });
const add = (into: BayCounts, bucket: Bucket, n: number) => {
  into[bucket] += n;
};

/**
 * Boxes per exact location and bucket, in one statement. A plan has far fewer
 * locations than boxes, and this never loads a box. The rules are the ones in
 * infra/progress.ts and getResultsPage: a test holds the totals to the plan's counts.
 */
async function locationCounts(ctx: AppContext, auditId: string) {
  return ctx.db.$queryRaw<{ location: string | null; bucket: Bucket; n: number }[]>(Prisma.sql`
    SELECT location, bucket, count(*)::int AS n FROM (
      SELECT e.location AS location, 'missing' AS bucket
        FROM expected_containers e
       WHERE e."auditId" = ${auditId}::uuid AND e."removedAt" IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM scans m
            WHERE m."expectedContainerId" = e.id AND m.result = 'MATCHED' AND m."reviewStatus" <> 'REJECTED'
         )
      UNION ALL
      SELECT e.location AS location,
             CASE WHEN s."reviewStatus" = 'PENDING' THEN 'mismatched'
                  WHEN s.result = 'MATCHED' THEN 'found'
                  ELSE 'unexpected' END AS bucket
        FROM scans s
        LEFT JOIN expected_containers e ON e.id = s."expectedContainerId"
       WHERE s."auditId" = ${auditId}::uuid AND s.result <> 'DUPLICATE' AND s."reviewStatus" <> 'REJECTED'
    ) x
    GROUP BY location, bucket
  `);
}

interface SiteSection {
  id: string;
  name: string;
  yardId: string | null;
  locationCodes: string[];
  boundary: unknown;
}

async function siteSections(ctx: AppContext, facilityId: string): Promise<SiteSection[]> {
  return ctx.db.section.findMany({
    where: { facilityId, isActive: true },
    select: { id: true, name: true, yardId: true, locationCodes: true, boundary: true },
    orderBy: { name: 'asc' },
  });
}

/** Finds a location's block the way an import does, by code prefix. The longest code wins, and the plan's own yard first. */
function blockMatcher(sections: SiteSection[], yardId: string | null) {
  const codes = sections
    .flatMap((s) => s.locationCodes.map((code) => ({ code: code.toUpperCase(), id: s.id, near: s.yardId === yardId })))
    .sort((a, b) => Number(b.near) - Number(a.near) || b.code.length - a.code.length);
  const memo = new Map<string, string | null>();
  return (location: string) => {
    const known = memo.get(location);
    if (known !== undefined) return known;
    const upper = location.trim().toUpperCase();
    const found = codes.find((c) => upper.startsWith(c.code))?.id ?? null;
    memo.set(location, found);
    return found;
  };
}

interface Grouped {
  bays: BaysResponse['bays'];
  byBlock: Map<string, BayCounts>;
  withoutLocation: BayCounts;
  total: BayCounts;
}

function group(rows: Awaited<ReturnType<typeof locationCounts>>, blockOf: (location: string) => string | null): Grouped {
  const bays = new Map<string, BaysResponse['bays'][number]>();
  const byBlock = new Map<string, BayCounts>();
  const withoutLocation = empty();
  const total = empty();
  for (const r of rows) {
    add(total, r.bucket, r.n);
    const loc = splitLocation(r.location);
    if (!loc || !r.location) {
      add(withoutLocation, r.bucket, r.n);
      continue;
    }
    const blockId = blockOf(r.location);
    const key = `${loc.row}|${loc.bay}`;
    const bay = bays.get(key) ?? { row: loc.row, bay: loc.bay, blockId, ...empty() };
    add(bay, r.bucket, r.n);
    bays.set(key, bay);
    if (blockId) {
      const k = byBlock.get(blockId) ?? empty();
      add(k, r.bucket, r.n);
      byBlock.set(blockId, k);
    }
  }
  return { bays: [...bays.values()], byBlock, withoutLocation, total };
}

/** Counts per bay for one plan. Anyone who may see the plan may see this: it names nobody. */
export async function getBays(ctx: AppContext, principal: Principal, auditId: string): Promise<BaysResponse> {
  const audit = await loadAuditFor(ctx, auditId, principal, {
    scopes: ['audits:read', 'results:read'],
    include: { section: { select: { facilityId: true, yardId: true } } },
  });
  const [rows, sections] = await Promise.all([locationCounts(ctx, auditId), siteSections(ctx, audit.section.facilityId)]);
  const { bays, byBlock, withoutLocation } = group(rows, blockMatcher(sections, audit.section.yardId));
  return {
    auditId,
    bays,
    blocks: sections.filter((s) => byBlock.has(s.id)).map((s) => ({ id: s.id, name: s.name, ...byBlock.get(s.id)! })),
    withoutLocation,
    generatedAt: new Date().toISOString(),
  };
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0]!.slice(0, 2) : `${parts[0]![0]}${parts[parts.length - 1]![0]}`).toUpperCase();
}

/** The site's shapes with this plan's counts, and where recent scans were made. Staff only: it names clerks and where they were. */
export async function getYardMap(ctx: AppContext, principal: Principal, auditId: string): Promise<YardMapResponse> {
  const audit = await loadAuditFor(ctx, auditId, principal, { include: { section: { select: { id: true, facilityId: true, yardId: true } } } });
  const [rows, sections, points, tally] = await Promise.all([
    locationCounts(ctx, auditId),
    siteSections(ctx, audit.section.facilityId),
    ctx.db.scan.findMany({
      where: { auditId, lat: { not: null }, lng: { not: null } },
      select: { id: true, lat: true, lng: true, capturedAt: true, auditor: { select: { fullName: true } } },
      orderBy: { receivedAt: 'desc' },
      take: POINT_LIMIT + 1,
    }),
    ctx.db.$queryRaw<{ total: number; without: number }[]>(Prisma.sql`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE lat IS NULL OR lng IS NULL)::int AS without
        FROM scans WHERE "auditId" = ${auditId}::uuid
    `),
  ]);
  const { byBlock, total } = group(rows, blockMatcher(sections, audit.section.yardId));
  const blocks: MapBlock[] = sections
    .filter((s) => Array.isArray(s.boundary) && s.boundary.length > 0)
    .map((s) => {
      const isPlanArea = s.id === audit.section.id;
      // An area with no codes takes every row, so the plan's own one holds the whole count.
      const counts = isPlanArea && s.locationCodes.length === 0 ? total : (byBlock.get(s.id) ?? empty());
      return { id: s.id, name: s.name, boundary: s.boundary as MapBlock['boundary'], isPlanArea, ...counts };
    });
  return {
    auditId,
    blocks,
    points: points.slice(0, POINT_LIMIT).map((p) => ({
      id: p.id,
      lat: p.lat!,
      lng: p.lng!,
      initials: initials(p.auditor.fullName),
      clerkName: p.auditor.fullName,
      capturedAt: iso(p.capturedAt),
    })),
    pointsCapped: points.length > POINT_LIMIT,
    scansTotal: tally[0]?.total ?? 0,
    scansWithoutLocation: tally[0]?.without ?? 0,
    generatedAt: new Date().toISOString(),
  };
}
