import { z } from 'zod';
import { CursorQuery, Id, IsoDateTime } from './common.js';
import { ApiScope, ContainerEventType, EventSource, ReportFormat, ReportStatus } from './enums.js';

// Container journey

export const ContainerEventDto = z.object({
  id: Id,
  containerNumber: z.string(),
  type: ContainerEventType,
  source: EventSource,
  occurredAt: IsoDateTime,
  section: z.object({ id: Id, code: z.string(), name: z.string() }).nullable(),
  auditId: Id.nullable(),
  scanId: Id.nullable(),
  actor: z.object({ id: Id, fullName: z.string() }).nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
});
export type ContainerEventDto = z.infer<typeof ContainerEventDto>;

export const ContainerParams = z.object({
  number: z
    .string()
    .max(32)
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')),
});

export const ContainerJourneyResponse = z.object({
  containerNumber: z.string(),
  events: z.array(ContainerEventDto),
  nextCursor: z.string().nullable(),
});
export type ContainerJourneyResponse = z.infer<typeof ContainerJourneyResponse>;

// Reports

export const CreateReportBody = z.object({ format: ReportFormat });
export type CreateReportBody = z.infer<typeof CreateReportBody>;

export const ReportDto = z.object({
  id: Id,
  auditId: Id,
  format: ReportFormat,
  status: ReportStatus,
  failureReason: z.string().nullable(),
  createdAt: IsoDateTime,
  readyAt: IsoDateTime.nullable(),
  downloadUrl: z.string().nullable(),
});
export type ReportDto = z.infer<typeof ReportDto>;

// Service accounts (system to system access)

export const ServiceAccountDto = z.object({
  id: Id,
  name: z.string(),
  scopes: z.array(ApiScope),
  keyPrefix: z.string(),
  lastUsedAt: IsoDateTime.nullable(),
  revokedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type ServiceAccountDto = z.infer<typeof ServiceAccountDto>;

export const CreateServiceAccountBody = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.array(ApiScope).min(1),
});
export type CreateServiceAccountBody = z.infer<typeof CreateServiceAccountBody>;

export const CreateServiceAccountResponse = z.object({
  account: ServiceAccountDto,
  /** Shown once. Only a hash is stored. */
  apiKey: z.string(),
});

// Activity log

export const ActivityDto = z.object({
  id: Id,
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  actor: z.object({ id: Id, staffId: z.string(), fullName: z.string() }).nullable(),
  ip: z.string().nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
  createdAt: IsoDateTime,
});
export type ActivityDto = z.infer<typeof ActivityDto>;

export const ActivityQuery = CursorQuery.extend({
  actorId: Id.optional(),
  entityType: z.string().max(40).optional(),
  entityId: z.string().max(64).optional(),
});
export type ActivityQuery = z.infer<typeof ActivityQuery>;
