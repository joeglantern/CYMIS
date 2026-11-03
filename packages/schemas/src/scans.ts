import { z } from 'zod';
import { ClientId, ContainerNumber, ContainerNumberLoose, CursorQuery, Id, IsoDateTime } from './common.js';
import { ColourName, CvStatus, EntryMethod, LocationDecision, PhotoStatus, ReviewStatus, ScanFlag, ScanResult } from './enums.js';
import { UserSummary } from './users.js';

export const GeoPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100_000).optional(),
});
export type GeoPoint = z.infer<typeof GeoPoint>;

/** A location as a clerk types it. Free text: we make no rule about its format. */
export const FoundLocation = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .transform((s) => s.toUpperCase());

/** Case and separators do not matter when comparing locations: a01 02-3 is A01-02-3. */
export function normaliseLocation(location: string): string {
  return location.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function sameLocation(a: string, b: string): boolean {
  return normaliseLocation(a) === normaliseLocation(b);
}

/**
 * The import rule: with codes set, a location must start with one of them or its
 * row is left out. Lives here so the warning before a list update cannot drift from it.
 */
export function locationInCodes(location: string, codes: readonly string[]): boolean {
  if (codes.length === 0) return true;
  const loc = location.toUpperCase();
  return codes.some((c) => loc.startsWith(c.toUpperCase()));
}

export const SyncScanItem = z.object({
  id: ClientId,
  auditId: Id,
  containerNumber: ContainerNumberLoose,
  ocrRaw: z.string().max(500).optional(),
  ocrConfidence: z.number().min(0).max(1).optional(),
  entryMethod: EntryMethod,
  capturedAt: IsoDateTime,
  location: GeoPoint.optional(),
  colourChosen: ColourName.optional(),
  /** Sent only when the clerk says the box is somewhere other than the list says. */
  foundLocation: FoundLocation.optional(),
  deviceId: z.string().trim().min(1).max(100),
});
export type SyncScanItem = z.infer<typeof SyncScanItem>;

export const SyncScansBody = z.object({
  scans: z.array(SyncScanItem).min(1).max(100),
});
export type SyncScansBody = z.infer<typeof SyncScansBody>;

export const PhotoSummary = z.object({ id: Id, status: PhotoStatus });

export const ScanDto = z.object({
  id: Id,
  auditId: Id,
  containerNumber: z.string(),
  checkDigitValid: z.boolean(),
  entryMethod: EntryMethod,
  ocrRaw: z.string().nullable(),
  ocrConfidence: z.number().nullable(),
  result: ScanResult,
  expectedContainerId: Id.nullable(),
  duplicateOfId: Id.nullable(),
  flags: z.array(ScanFlag),
  reviewStatus: ReviewStatus,
  reviewNote: z.string().nullable(),
  colourChosen: ColourName.nullable(),
  colourSuggested: ColourName.nullable(),
  colourHex: z.string().nullable(),
  colourConfidence: z.number().nullable(),
  serverOcrNumber: z.string().nullable(),
  serverOcrConfidence: z.number().nullable(),
  cvStatus: CvStatus,
  location: GeoPoint.nullable(),
  capturedAt: IsoDateTime,
  receivedAt: IsoDateTime,
  auditor: UserSummary,
  reviewedBy: UserSummary.nullable(),
  reviewedAt: IsoDateTime.nullable(),
  foundLocation: z.string().nullable(),
  locationDecision: LocationDecision.nullable(),
  /** Where the list says this box is right now. */
  listLocation: z.string().nullable(),
  photos: z.array(PhotoSummary),
});
export type ScanDto = z.infer<typeof ScanDto>;

export const SyncItemStatus = z.enum(['created', 'unchanged', 'rejected']);

export const SyncResultItem = z.object({
  id: z.string(),
  status: SyncItemStatus,
  /** Why it was rejected, in words the crew can read. */
  reason: z.string().optional(),
  code: z.string().optional(),
  scan: ScanDto.optional(),
});
export type SyncResultItem = z.infer<typeof SyncResultItem>;

export const SyncScansResponse = z.object({
  results: z.array(SyncResultItem),
  serverTime: IsoDateTime,
});
export type SyncScansResponse = z.infer<typeof SyncScansResponse>;

export const ScanListQuery = CursorQuery.extend({
  result: ScanResult.optional(),
  flagged: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  reviewStatus: ReviewStatus.optional(),
  locationDecision: LocationDecision.optional(),
  auditorId: Id.optional(),
  /** Start of a container number, for search. */
  q: z
    .string()
    .trim()
    .max(11)
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .optional(),
});
export type ScanListQuery = z.infer<typeof ScanListQuery>;

export const ReviewAction = z.enum(['APPROVE', 'CORRECT', 'REJECT', 'UPDATE_LIST', 'MOVE_BACK']);
export type ReviewAction = z.infer<typeof ReviewAction>;

export const ReviewScanBody = z
  .object({
    action: ReviewAction,
    correctedNumber: ContainerNumber.optional(),
    correctedColour: ColourName.optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((b) => b.action !== 'CORRECT' || b.correctedNumber || b.correctedColour, {
    message: 'Give the corrected number or colour',
    path: ['correctedNumber'],
  })
  .refine((b) => b.action !== 'REJECT' || (b.note && b.note.length > 0), {
    message: 'Say why the scan is rejected',
    path: ['note'],
  })
  .refine((b) => b.action !== 'MOVE_BACK' || (b.note && b.note.length > 0), {
    message: 'Say where the box must go back to, or why',
    path: ['note'],
  });
export type ReviewScanBody = z.infer<typeof ReviewScanBody>;

export const PresignPhotoBody = z.object({
  photoId: ClientId,
  scanId: ClientId,
  contentType: z.literal('image/jpeg'),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  width: z.number().int().min(1).max(20_000).optional(),
  height: z.number().int().min(1).max(20_000).optional(),
});
export type PresignPhotoBody = z.infer<typeof PresignPhotoBody>;

export const PresignPhotoResponse = z.object({
  photoId: Id,
  /** True if the photo was already uploaded. The phone can skip the upload. */
  alreadyUploaded: z.boolean(),
  uploadUrl: z.string().nullable(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresAt: IsoDateTime.nullable(),
});
export type PresignPhotoResponse = z.infer<typeof PresignPhotoResponse>;

export const PhotoUrlResponse = z.object({
  url: z.string(),
  expiresAt: IsoDateTime,
});
export type PhotoUrlResponse = z.infer<typeof PhotoUrlResponse>;
