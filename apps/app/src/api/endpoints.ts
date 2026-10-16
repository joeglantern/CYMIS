import type {
  ActivityDto,
  AuditCounts,
  AuditDto,
  AuditStatus,
  Bucket,
  ColumnMap,
  ColumnMappingDto,
  ContainerJourneyResponse,
  CreateAuditBody,
  CreateFacilityBody,
  CreateSectionBody,
  CreateServiceAccountBody,
  CreateUserBody,
  ExpectedResponse,
  FacilityDto,
  ImportDto,
  ImportMode,
  PhotoUrlResponse,
  PresignPhotoBody,
  PresignPhotoResponse,
  ReportDto,
  ReportFormat,
  ResultRow,
  ReviewScanBody,
  Role,
  ScanDto,
  ScanResult,
  SectionDto,
  ServiceAccountDto,
  SyncScanItem,
  SyncScansResponse,
  UpdateAuditBody,
  UpdateSectionBody,
  UpdateUserBody,
  UserDto,
} from '@cymis/schemas';
import { api } from './http';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

type Q = Record<string, string | number | boolean | undefined | null>;

export const endpoints = {
  // Audits
  audits: (q: { status?: AuditStatus; mine?: boolean; sectionId?: string; cursor?: string; limit?: number } = {}) =>
    api<Page<AuditDto>>('/audits', { query: { ...q, mine: q.mine === undefined ? undefined : String(q.mine) } as Q }),
  audit: (id: string) => api<AuditDto>(`/audits/${id}`),
  createAudit: (body: CreateAuditBody) => api<AuditDto>('/audits', { method: 'POST', body }),
  updateAudit: (id: string, body: UpdateAuditBody) => api<AuditDto>(`/audits/${id}`, { method: 'PATCH', body }),
  startAudit: (id: string) => api<AuditDto>(`/audits/${id}/start`, { method: 'POST', body: {} }),
  closeAudit: (id: string) => api<AuditDto>(`/audits/${id}/close`, { method: 'POST', body: {} }),
  cancelAudit: (id: string) => api<AuditDto>(`/audits/${id}/cancel`, { method: 'POST', body: {} }),
  setAssignees: (id: string, userIds: string[]) => api<AuditDto>(`/audits/${id}/assignees`, { method: 'PUT', body: { userIds } }),
  expected: (id: string, sinceVersion?: number) => api<ExpectedResponse>(`/audits/${id}/expected`, { query: { sinceVersion } }),
  progress: (id: string) => api<AuditCounts>(`/audits/${id}/progress`),
  results: (id: string, bucket: Bucket, cursor?: string, limit = 100) =>
    api<Page<ResultRow>>(`/audits/${id}/results`, { query: { bucket, cursor, limit } }),

  // Scans
  syncScans: (scans: SyncScanItem[]) => api<SyncScansResponse>('/sync/scans', { method: 'POST', body: { scans } }),
  scans: (
    auditId: string,
    q: { result?: ScanResult; flagged?: boolean; reviewStatus?: string; auditorId?: string; q?: string; cursor?: string; limit?: number } = {},
  ) =>
    api<Page<ScanDto>>(`/audits/${auditId}/scans`, {
      query: { ...q, flagged: q.flagged === undefined ? undefined : String(q.flagged) } as Q,
    }),
  scan: (id: string) => api<ScanDto>(`/scans/${id}`),
  reviewScan: (id: string, body: ReviewScanBody) => api<ScanDto>(`/scans/${id}/review`, { method: 'POST', body }),

  // Photos
  presignPhoto: (body: PresignPhotoBody) => api<PresignPhotoResponse>('/photos/presign', { method: 'POST', body }),
  completePhoto: (id: string) => api<ScanDto>(`/photos/${id}/complete`, { method: 'POST', body: {} }),
  photoUrl: (id: string) => api<PhotoUrlResponse>(`/photos/${id}/url`),

  // Imports
  uploadImport: (auditId: string, form: FormData) => api<ImportDto>('/imports', { method: 'POST', form, query: { auditId } }),
  importById: (id: string) => api<ImportDto>(`/imports/${id}`),
  auditImports: (auditId: string) => api<ImportDto[]>(`/audits/${auditId}/imports`),
  setMapping: (id: string, body: { mapping: ColumnMap; mode: ImportMode; saveAs?: string }) =>
    api<ImportDto>(`/imports/${id}/mapping`, { method: 'POST', body }),
  commitImport: (id: string) => api<ImportDto>(`/imports/${id}/commit`, { method: 'POST', body: {} }),
  columnMappings: () => api<ColumnMappingDto[]>('/column-mappings'),

  // Containers
  journey: (number: string, cursor?: string) => api<ContainerJourneyResponse>(`/containers/${encodeURIComponent(number)}/events`, { query: { cursor } }),

  // Reports
  createReport: (auditId: string, format: ReportFormat) => api<ReportDto>(`/audits/${auditId}/reports`, { method: 'POST', body: { format } }),
  auditReports: (auditId: string) => api<ReportDto[]>(`/audits/${auditId}/reports`),
  report: (id: string) => api<ReportDto>(`/reports/${id}`),

  // Facilities and sections
  facilities: () => api<FacilityDto[]>('/facilities'),
  createFacility: (body: CreateFacilityBody) => api<FacilityDto>('/facilities', { method: 'POST', body }),
  createSection: (body: CreateSectionBody) => api<SectionDto>('/sections', { method: 'POST', body }),
  updateSection: (id: string, body: UpdateSectionBody) => api<SectionDto>(`/sections/${id}`, { method: 'PATCH', body }),

  // People
  users: (q: { q?: string; role?: Role; active?: boolean; cursor?: string; limit?: number } = {}) =>
    api<Page<UserDto>>('/users', { query: { ...q, active: q.active === undefined ? undefined : String(q.active) } as Q }),
  createUser: (body: CreateUserBody) => api<UserDto>('/users', { method: 'POST', body }),
  updateUser: (id: string, body: UpdateUserBody) => api<UserDto>(`/users/${id}`, { method: 'PATCH', body }),
  resetPassword: (id: string, temporaryPassword: string) =>
    api<UserDto>(`/users/${id}/reset-password`, { method: 'POST', body: { temporaryPassword } }),
  unlockUser: (id: string) => api<UserDto>(`/users/${id}/unlock`, { method: 'POST', body: {} }),

  // Admin
  serviceAccounts: () => api<ServiceAccountDto[]>('/admin/service-accounts'),
  createServiceAccount: (body: CreateServiceAccountBody) =>
    api<{ account: ServiceAccountDto; apiKey: string }>('/admin/service-accounts', { method: 'POST', body }),
  revokeServiceAccount: (id: string) => api<ServiceAccountDto>(`/admin/service-accounts/${id}/revoke`, { method: 'POST', body: {} }),
  activity: (q: { actorId?: string; entityType?: string; entityId?: string; cursor?: string; limit?: number } = {}) =>
    api<Page<ActivityDto>>('/admin/activity', { query: q as Q }),
};
