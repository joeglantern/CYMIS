// Turns database rows into API shapes. Every response goes through one of
// these, so fields like passwordHash can never leak by accident.

import type {
  ActivityDto,
  AuditCounts,
  AuditDto,
  ColourName,
  ColumnMap,
  ContainerEventDto,
  ExpectedContainerDto,
  FacilityDto,
  ImportDto,
  ReportDto,
  RowError,
  ScanDto,
  SectionDto,
  ServiceAccountDto,
  UserDto,
  UserSummary,
  ApiScope,
} from '@cymis/schemas';
import type { Prisma } from '../infra/db.js';
import { iso } from './time.js';

export const userSummarySelect = { id: true, staffId: true, fullName: true } as const;

export function toUserSummary(u: { id: string; staffId: string; fullName: string }): UserSummary {
  return { id: u.id, staffId: u.staffId, fullName: u.fullName };
}

export function toUserDto(u: Prisma.UserGetPayload<object>): UserDto {
  return {
    id: u.id,
    staffId: u.staffId,
    fullName: u.fullName,
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    lockedUntil: iso(u.lockedUntil),
    lastLoginAt: iso(u.lastLoginAt),
    createdAt: iso(u.createdAt),
  };
}

export function toSectionDto(s: Prisma.SectionGetPayload<object>): SectionDto {
  return {
    id: s.id,
    facilityId: s.facilityId,
    code: s.code,
    name: s.name,
    kind: s.kind,
    locationCodes: s.locationCodes,
    isActive: s.isActive,
    createdAt: iso(s.createdAt),
  };
}

export function toFacilityDto(f: Prisma.FacilityGetPayload<{ include: { sections: true } }>): FacilityDto {
  return {
    id: f.id,
    code: f.code,
    name: f.name,
    type: f.type,
    isActive: f.isActive,
    createdAt: iso(f.createdAt),
    sections: f.sections.map(toSectionDto),
  };
}

export const auditInclude = {
  section: { include: { facility: true } },
  createdBy: { select: userSummarySelect },
  closedBy: { select: userSummarySelect },
  assignments: { include: { user: { select: userSummarySelect } }, orderBy: { createdAt: 'asc' } },
} as const satisfies Prisma.AuditInclude;

export type AuditWithRelations = Prisma.AuditGetPayload<{ include: typeof auditInclude }>;

export function toAuditDto(a: AuditWithRelations, counts: AuditCounts): AuditDto {
  return {
    id: a.id,
    name: a.name,
    notes: a.notes,
    status: a.status,
    listVersion: a.listVersion,
    section: {
      id: a.section.id,
      code: a.section.code,
      name: a.section.name,
      kind: a.section.kind,
      facility: {
        id: a.section.facility.id,
        code: a.section.facility.code,
        name: a.section.facility.name,
        type: a.section.facility.type,
      },
    },
    createdBy: toUserSummary(a.createdBy),
    closedBy: a.closedBy ? toUserSummary(a.closedBy) : null,
    assignees: a.assignments.map((x) => toUserSummary(x.user)),
    counts,
    startedAt: iso(a.startedAt),
    closedAt: iso(a.closedAt),
    createdAt: iso(a.createdAt),
  };
}

export function toExpectedDto(e: Prisma.ExpectedContainerGetPayload<object>): ExpectedContainerDto {
  return {
    id: e.id,
    containerNumber: e.containerNumber,
    checkDigitValid: e.checkDigitValid,
    sizeType: e.sizeType,
    location: e.location,
    vessel: e.vessel,
    voyage: e.voyage,
    fullEmpty: e.fullEmpty,
    lineOperator: e.lineOperator,
    category: e.category,
    version: e.version,
    removed: e.removedAt !== null,
  };
}

export const scanInclude = {
  auditor: { select: userSummarySelect },
  reviewedBy: { select: userSummarySelect },
  photos: { select: { id: true, status: true }, orderBy: { createdAt: 'asc' } },
} as const satisfies Prisma.ScanInclude;

export type ScanWithRelations = Prisma.ScanGetPayload<{ include: typeof scanInclude }>;

export function toScanDto(s: ScanWithRelations): ScanDto {
  return {
    id: s.id,
    auditId: s.auditId,
    containerNumber: s.containerNumber,
    checkDigitValid: s.checkDigitValid,
    entryMethod: s.entryMethod,
    ocrRaw: s.ocrRaw,
    ocrConfidence: s.ocrConfidence,
    result: s.result,
    expectedContainerId: s.expectedContainerId,
    duplicateOfId: s.duplicateOfId,
    flags: s.flags,
    reviewStatus: s.reviewStatus,
    reviewNote: s.reviewNote,
    colourChosen: (s.colourChosen as ColourName | null) ?? null,
    colourSuggested: (s.colourSuggested as ColourName | null) ?? null,
    colourHex: s.colourHex,
    colourConfidence: s.colourConfidence,
    serverOcrNumber: s.serverOcrNumber,
    serverOcrConfidence: s.serverOcrConfidence,
    cvStatus: s.cvStatus,
    location:
      s.lat !== null && s.lng !== null
        ? { lat: s.lat, lng: s.lng, ...(s.accuracyM !== null ? { accuracyM: s.accuracyM } : {}) }
        : null,
    capturedAt: iso(s.capturedAt),
    receivedAt: iso(s.receivedAt),
    auditor: toUserSummary(s.auditor),
    reviewedBy: s.reviewedBy ? toUserSummary(s.reviewedBy) : null,
    photos: s.photos.map((p) => ({ id: p.id, status: p.status })),
  };
}

export function toImportDto(i: Prisma.ImportBatchGetPayload<object>): ImportDto {
  return {
    id: i.id,
    auditId: i.auditId,
    sourceType: i.sourceType,
    fileName: i.fileName,
    status: i.status,
    sheetName: i.sheetName,
    headers: i.headers,
    sampleRows: (i.sampleRows as Record<string, string>[] | null) ?? [],
    suggestedMapping: (i.suggestedMapping as Partial<ColumnMap> | null) ?? null,
    mapping: (i.mapping as ColumnMap | null) ?? null,
    mode: i.mode,
    validated: i.validated,
    rowCount: i.rowCount,
    validCount: i.validCount,
    invalidCount: i.invalidCount,
    duplicateCount: i.duplicateCount,
    outOfSectionCount: i.outOfSectionCount,
    errors: (i.errors as RowError[] | null) ?? [],
    failureReason: i.failureReason,
    createdAt: iso(i.createdAt),
    committedAt: iso(i.committedAt),
  };
}

export const eventInclude = {
  section: { select: { id: true, code: true, name: true } },
  actor: { select: { id: true, fullName: true } },
} as const satisfies Prisma.ContainerEventInclude;

export function toEventDto(e: Prisma.ContainerEventGetPayload<{ include: typeof eventInclude }>): ContainerEventDto {
  return {
    id: e.id,
    containerNumber: e.containerNumber,
    type: e.type,
    source: e.source,
    occurredAt: iso(e.occurredAt),
    section: e.section,
    auditId: e.auditId,
    scanId: e.scanId,
    actor: e.actor,
    data: (e.data as Record<string, unknown> | null) ?? null,
  };
}

export function toReportDto(r: Prisma.ReportGetPayload<object>, downloadUrl: string | null): ReportDto {
  return {
    id: r.id,
    auditId: r.auditId,
    format: r.format,
    status: r.status,
    failureReason: r.failureReason,
    createdAt: iso(r.createdAt),
    readyAt: iso(r.readyAt),
    downloadUrl,
  };
}

export function toServiceAccountDto(a: Prisma.ServiceAccountGetPayload<object>): ServiceAccountDto {
  return {
    id: a.id,
    name: a.name,
    scopes: a.scopes as ApiScope[],
    keyPrefix: a.keyPrefix,
    lastUsedAt: iso(a.lastUsedAt),
    revokedAt: iso(a.revokedAt),
    createdAt: iso(a.createdAt),
  };
}

export function toActivityDto(
  a: Prisma.ActivityLogGetPayload<{ include: { actor: { select: typeof userSummarySelect } } }>,
): ActivityDto {
  return {
    id: a.id,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    actor: a.actor,
    ip: a.ip,
    data: (a.data as Record<string, unknown> | null) ?? null,
    createdAt: iso(a.createdAt),
  };
}
