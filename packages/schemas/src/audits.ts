import { z } from 'zod';
import { CursorQuery, Id, IsoDateTime } from './common.js';
import { AuditStatus, Bucket, FacilityType, SectionKind } from './enums.js';
import { UserSummary } from './users.js';

export const AuditCounts = z.object({
  expected: z.number().int(),
  found: z.number().int(),
  missing: z.number().int(),
  unexpected: z.number().int(),
  mismatched: z.number().int(),
  duplicates: z.number().int(),
  scans: z.number().int(),
  pendingReview: z.number().int(),
});
export type AuditCounts = z.infer<typeof AuditCounts>;

export const AuditDto = z.object({
  id: Id,
  name: z.string(),
  notes: z.string().nullable(),
  status: AuditStatus,
  listVersion: z.number().int(),
  section: z.object({
    id: Id,
    code: z.string(),
    name: z.string(),
    kind: SectionKind,
    facility: z.object({ id: Id, code: z.string(), name: z.string(), type: FacilityType }),
  }),
  createdBy: UserSummary,
  closedBy: UserSummary.nullable(),
  assignees: z.array(UserSummary),
  counts: AuditCounts,
  startedAt: IsoDateTime.nullable(),
  closedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type AuditDto = z.infer<typeof AuditDto>;

export const CreateAuditBody = z.object({
  sectionId: Id,
  name: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateAuditBody = z.infer<typeof CreateAuditBody>;

export const UpdateAuditBody = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
export type UpdateAuditBody = z.infer<typeof UpdateAuditBody>;

export const AuditListQuery = CursorQuery.extend({
  status: AuditStatus.optional(),
  sectionId: Id.optional(),
  /** Only audits assigned to me. Auditors always get this. */
  mine: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type AuditListQuery = z.infer<typeof AuditListQuery>;

export const SetAssigneesBody = z.object({
  userIds: z.array(Id).max(200),
});
export type SetAssigneesBody = z.infer<typeof SetAssigneesBody>;

export const ExpectedContainerDto = z.object({
  id: Id,
  containerNumber: z.string(),
  checkDigitValid: z.boolean(),
  sizeType: z.string().nullable(),
  location: z.string().nullable(),
  vessel: z.string().nullable(),
  voyage: z.string().nullable(),
  fullEmpty: z.string().nullable(),
  lineOperator: z.string().nullable(),
  category: z.string().nullable(),
  version: z.number().int(),
  removed: z.boolean(),
});
export type ExpectedContainerDto = z.infer<typeof ExpectedContainerDto>;

export const ExpectedQuery = z.object({
  /** The listVersion the phone already has. Leave out for the full list. */
  sinceVersion: z.coerce.number().int().min(0).optional(),
});
export type ExpectedQuery = z.infer<typeof ExpectedQuery>;

export const ExpectedResponse = z.object({
  auditId: Id,
  listVersion: z.number().int(),
  /** True when this is the full list, false when it is only changes. */
  full: z.boolean(),
  items: z.array(ExpectedContainerDto),
});
export type ExpectedResponse = z.infer<typeof ExpectedResponse>;

export const ResultsQuery = CursorQuery.extend({
  bucket: Bucket,
});
export type ResultsQuery = z.infer<typeof ResultsQuery>;

/** One line in the results for an audit. */
export const ResultRow = z.object({
  bucket: Bucket,
  containerNumber: z.string(),
  expectedContainerId: Id.nullable(),
  scanId: Id.nullable(),
  location: z.string().nullable(),
  colour: z.string().nullable(),
  scannedAt: IsoDateTime.nullable(),
  scannedBy: z.string().nullable(),
  flags: z.array(z.string()),
});
export type ResultRow = z.infer<typeof ResultRow>;
