import { normalise, validateContainerNumber } from '@cymis/iso6346';
import { z } from 'zod';

export const Id = z.uuid();
/** Ids the phone creates itself. Must be UUIDv7 so they sort by time. */
export const ClientId = z.uuidv7();

export const IsoDateTime = z.iso.datetime({ offset: true });

/**
 * A container number with a correct check digit. Input is normalised first,
 * so "csqu 305438-3" is accepted and comes out as "CSQU3054383".
 */
export const ContainerNumber = z
  .string()
  .max(32)
  .transform((s) => normalise(s))
  .refine((s) => validateContainerNumber(s).ok, { message: 'Not a valid ISO 6346 container number' });

/**
 * A container number that only has to look right (4 letters, 7 digits). Used
 * where the crew saved a number that fails the check digit, so the record is
 * kept and flagged instead of lost.
 */
export const ContainerNumberLoose = z
  .string()
  .max(32)
  .transform((s) => normalise(s))
  .refine((s) => /^[A-Z]{4}\d{7}$/.test(s), { message: 'Expected 4 letters and 7 digits' });

export const StaffId = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, dot, dash or underscore only')
  .transform((s) => s.toUpperCase());

/**
 * Password rule for an internal tool: long beats clever. At least 10
 * characters, at most 128, and not all the same character.
 */
export const Password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine((s) => new Set(s).size > 3, { message: 'Password is too simple' });

export const CursorQuery = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type CursorQuery = z.infer<typeof CursorQuery>;

export function paged<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export const IdParams = z.object({ id: Id });

export const ErrorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const OkResponse = z.object({ ok: z.literal(true) });
