import { z } from 'zod';
import { Id, IsoDateTime } from './common.js';
import { FacilityType, SectionKind } from './enums.js';

const Code = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[A-Za-z0-9_-]+$/, 'Letters, digits, dash or underscore only')
  .transform((s) => s.toUpperCase());

const Name = z.string().trim().min(2).max(120);

/** Location code prefixes from the terminal system that belong to a section. */
const LocationCodes = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(24)
      .transform((s) => s.toUpperCase()),
  )
  .max(200);

export const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLng>;

export const BOUNDARY_MIN_POINTS = 3;
export const BOUNDARY_MAX_POINTS = 50;

/** Which way c sits from the line a to b: above zero one side, below the other, zero on the line. */
function turn(a: LatLng, b: LatLng, c: LatLng): number {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

/** True when c, known to be on the line through a and b, lies between them. */
function within(a: LatLng, b: LatLng, c: LatLng): boolean {
  return (
    Math.min(a.lng, b.lng) <= c.lng && c.lng <= Math.max(a.lng, b.lng) && Math.min(a.lat, b.lat) <= c.lat && c.lat <= Math.max(a.lat, b.lat)
  );
}

function edgesTouch(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  const t1 = turn(a, b, c);
  const t2 = turn(a, b, d);
  const t3 = turn(c, d, a);
  const t4 = turn(c, d, b);
  if (((t1 > 0 && t2 < 0) || (t1 < 0 && t2 > 0)) && ((t3 > 0 && t4 < 0) || (t3 < 0 && t4 > 0))) return true;
  return (t1 === 0 && within(a, b, c)) || (t2 === 0 && within(a, b, d)) || (t3 === 0 && within(c, d, a)) || (t4 === 0 && within(c, d, b));
}

/**
 * What is wrong with a shape, in words for the person drawing it, or null if
 * it is fine. The map page and the API share this, so they always agree.
 */
export function boundaryProblem(points: LatLng[]): string | null {
  if (points.length < BOUNDARY_MIN_POINTS) return `A shape needs at least ${BOUNDARY_MIN_POINTS} corners.`;
  if (points.length > BOUNDARY_MAX_POINTS) return `A shape can have at most ${BOUNDARY_MAX_POINTS} corners.`;
  const seen = new Set(points.map((p) => `${p.lat},${p.lng}`));
  if (seen.size !== points.length) return 'Two corners are in the same place.';
  const n = points.length;
  if (points.every((p) => turn(points[0]!, points[1]!, p) === 0)) return 'All the corners are in a straight line.';
  for (let i = 0; i < n; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    // Edges next to each other share a corner, so start past the neighbour and stop before the wrap.
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (edgesTouch(a, b, points[j]!, points[(j + 1) % n]!)) return 'Two edges of this shape cross.';
    }
  }
  return null;
}

/** A block's shape on the map. Not limited to rectangles. */
export const Boundary = z.array(LatLng).superRefine((points, ctx) => {
  const problem = boundaryProblem(points);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
});
export type Boundary = z.infer<typeof Boundary>;

export const YardDto = z.object({
  id: Id,
  facilityId: Id,
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: IsoDateTime,
});
export type YardDto = z.infer<typeof YardDto>;

export const CreateYardBody = z.object({ facilityId: Id, code: Code, name: Name });
export type CreateYardBody = z.infer<typeof CreateYardBody>;

export const UpdateYardBody = z
  .object({ name: Name.optional(), isActive: z.boolean().optional() })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
export type UpdateYardBody = z.infer<typeof UpdateYardBody>;

export const SectionDto = z.object({
  id: Id,
  facilityId: Id,
  code: z.string(),
  name: z.string(),
  kind: SectionKind,
  locationCodes: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: IsoDateTime,
  yardId: Id.nullable(),
  boundary: z.array(LatLng).nullable(),
});
export type SectionDto = z.infer<typeof SectionDto>;

export const FacilityDto = z.object({
  id: Id,
  code: z.string(),
  name: z.string(),
  type: FacilityType,
  isActive: z.boolean(),
  createdAt: IsoDateTime,
  sections: z.array(SectionDto),
  yards: z.array(YardDto),
});
export type FacilityDto = z.infer<typeof FacilityDto>;

export const CreateFacilityBody = z.object({ code: Code, name: Name, type: FacilityType });
export type CreateFacilityBody = z.infer<typeof CreateFacilityBody>;

export const UpdateFacilityBody = z
  .object({ name: Name.optional(), type: FacilityType.optional(), isActive: z.boolean().optional() })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
export type UpdateFacilityBody = z.infer<typeof UpdateFacilityBody>;

export const CreateSectionBody = z.object({
  facilityId: Id,
  code: Code,
  name: Name,
  kind: SectionKind,
  locationCodes: LocationCodes.default([]),
  yardId: Id.nullable().optional(),
  boundary: Boundary.nullable().optional(),
});
export type CreateSectionBody = z.infer<typeof CreateSectionBody>;

export const UpdateSectionBody = z
  .object({
    name: Name.optional(),
    kind: SectionKind.optional(),
    locationCodes: LocationCodes.optional(),
    isActive: z.boolean().optional(),
    yardId: Id.nullable().optional(),
    boundary: Boundary.nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
export type UpdateSectionBody = z.infer<typeof UpdateSectionBody>;
