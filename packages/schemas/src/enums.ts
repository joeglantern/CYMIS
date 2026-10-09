import { z } from 'zod';

// Keep these in step with apps/api/prisma/schema.prisma. A test in the API
// checks that the Prisma enums and these lists match.

export const Role = z.enum(['ADMIN', 'SUPERVISOR', 'AUDITOR']);
export type Role = z.infer<typeof Role>;

export const FacilityType = z.enum(['PORT', 'CFS', 'ICD', 'DEPOT']);
export type FacilityType = z.infer<typeof FacilityType>;

export const SectionKind = z.enum(['YARD_BLOCK', 'VERIFICATION_BAY', 'SGR_LOADING', 'GATE', 'QUAY', 'OTHER']);
export type SectionKind = z.infer<typeof SectionKind>;

export const AuditStatus = z.enum(['DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED']);
export type AuditStatus = z.infer<typeof AuditStatus>;

export const ImportStatus = z.enum(['UPLOADED', 'PARSING', 'READY', 'COMMITTED', 'FAILED']);
export type ImportStatus = z.infer<typeof ImportStatus>;

export const ImportSource = z.enum(['SPREADSHEET', 'EDI', 'API']);
export type ImportSource = z.infer<typeof ImportSource>;

export const EntryMethod = z.enum(['OCR', 'OCR_CORRECTED', 'MANUAL']);
export type EntryMethod = z.infer<typeof EntryMethod>;

export const ScanResult = z.enum(['MATCHED', 'UNEXPECTED', 'DUPLICATE']);
export type ScanResult = z.infer<typeof ScanResult>;

export const CvStatus = z.enum(['PENDING', 'DONE', 'FAILED', 'SKIPPED']);
export type CvStatus = z.infer<typeof CvStatus>;

export const ScanFlag = z.enum(['NUMBER_MISMATCH', 'COLOUR_MISMATCH', 'CHECK_DIGIT_FAILED']);
export type ScanFlag = z.infer<typeof ScanFlag>;

export const ReviewStatus = z.enum(['NONE', 'PENDING', 'APPROVED', 'CORRECTED', 'REJECTED']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const PhotoStatus = z.enum(['PENDING_UPLOAD', 'UPLOADED']);
export type PhotoStatus = z.infer<typeof PhotoStatus>;

export const ContainerEventType = z.enum([
  'IMPORTED',
  'AUDITED',
  'DISCHARGED',
  'IN_YARD',
  'MOVED_TO_CFS',
  'RAILED',
  'VERIFIED',
  'RELEASED',
  'GATE_OUT',
]);
export type ContainerEventType = z.infer<typeof ContainerEventType>;

export const EventSource = z.enum(['IMPORT', 'SCAN', 'REVIEW', 'EDI', 'API']);
export type EventSource = z.infer<typeof EventSource>;

export const ReportFormat = z.enum(['XLSX', 'CSV', 'PDF']);
export type ReportFormat = z.infer<typeof ReportFormat>;

export const ReportStatus = z.enum(['QUEUED', 'RUNNING', 'READY', 'FAILED']);
export type ReportStatus = z.infer<typeof ReportStatus>;

/** The fixed palette the colour detector matches against. */
export const ColourName = z.enum([
  'blue',
  'red',
  'maroon',
  'green',
  'grey',
  'white',
  'orange',
  'yellow',
  'brown',
  'black',
]);
export type ColourName = z.infer<typeof ColourName>;

/** Scopes a service account API key can hold. */
export const ApiScope = z.enum(['audits:read', 'results:read', 'expected:write']);
export type ApiScope = z.infer<typeof ApiScope>;

/** The four buckets every expected or scanned container ends up in. */
export const Bucket = z.enum(['found', 'missing', 'unexpected', 'mismatched']);
export type Bucket = z.infer<typeof Bucket>;
