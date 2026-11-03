import { z } from 'zod';
import { Id, IsoDateTime } from './common.js';
import { Boundary } from './facilities.js';

const Counts = {
  found: z.number().int(),
  missing: z.number().int(),
  unexpected: z.number().int(),
  mismatched: z.number().int(),
};

export const BayCounts = z.object(Counts);
export type BayCounts = z.infer<typeof BayCounts>;

/** One bay. Counts only: no container numbers, people or positions, so it is safe for clerks. */
export const BayDto = z.object({
  row: z.string(),
  bay: z.string(),
  /** The block this bay falls in, by its location codes. Null when no block claims it. */
  blockId: Id.nullable(),
  ...Counts,
});
export type BayDto = z.infer<typeof BayDto>;

export const BayBlock = z.object({ id: Id, name: z.string(), ...Counts });
export type BayBlock = z.infer<typeof BayBlock>;

/** `GET /audits/:id/bays`. The sum of everything here matches the plan's counts. */
export const BaysResponse = z.object({
  auditId: Id,
  bays: z.array(BayDto),
  /** Only blocks that hold at least one bay of this plan. */
  blocks: z.array(BayBlock),
  /** Boxes with no usable yard location, such as anything not on the list. */
  withoutLocation: BayCounts,
  generatedAt: IsoDateTime,
});
export type BaysResponse = z.infer<typeof BaysResponse>;

export const MapBlock = z.object({
  id: Id,
  name: z.string(),
  boundary: Boundary,
  /** The area this yard plan was made for. */
  isPlanArea: z.boolean(),
  ...Counts,
});
export type MapBlock = z.infer<typeof MapBlock>;

export const ScanPoint = z.object({
  id: Id,
  lat: z.number(),
  lng: z.number(),
  initials: z.string(),
  clerkName: z.string(),
  capturedAt: IsoDateTime,
});
export type ScanPoint = z.infer<typeof ScanPoint>;

/** `GET /audits/:id/map`, staff only: shapes and where recent scans were made. */
export const YardMapResponse = z.object({
  auditId: Id,
  blocks: z.array(MapBlock),
  /** The latest scans that have a position, newest first. */
  points: z.array(ScanPoint),
  /** True when more scans have a position than points holds. */
  pointsCapped: z.boolean(),
  scansTotal: z.number().int(),
  scansWithoutLocation: z.number().int(),
  generatedAt: IsoDateTime,
});
export type YardMapResponse = z.infer<typeof YardMapResponse>;

/** Splits a location like A01-02-3 into a row (A01) and a bay (02). */
export function splitLocation(loc: string | null | undefined): { row: string; bay: string } | null {
  if (!loc) return null;
  const parts = loc.trim().toUpperCase().split(/[\s\-/.]+/).filter(Boolean);
  if (!parts.length) return null;
  return { row: parts[0]!, bay: parts[1] ?? '1' };
}
