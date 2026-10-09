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

export const SectionDto = z.object({
  id: Id,
  facilityId: Id,
  code: z.string(),
  name: z.string(),
  kind: SectionKind,
  locationCodes: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: IsoDateTime,
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
});
export type CreateSectionBody = z.infer<typeof CreateSectionBody>;

export const UpdateSectionBody = z
  .object({
    name: Name.optional(),
    kind: SectionKind.optional(),
    locationCodes: LocationCodes.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
export type UpdateSectionBody = z.infer<typeof UpdateSectionBody>;
