import * as shared from '@cymis/schemas';
import { describe, expect, it } from 'vitest';
import * as prisma from '../generated/prisma/enums.js';

// The database enums and the shared API enums must list the same values,
// or a value saved by one side will be rejected by the other.
const PAIRS = [
  'Role',
  'FacilityType',
  'SectionKind',
  'AuditStatus',
  'ImportStatus',
  'ImportSource',
  'ImportMode',
  'EntryMethod',
  'ScanResult',
  'CvStatus',
  'ScanFlag',
  'ReviewStatus',
  'PhotoStatus',
  'ContainerEventType',
  'EventSource',
  'ReportFormat',
  'ReportStatus',
] as const;

describe('Prisma enums match shared schemas', () => {
  it.each(PAIRS)('%s', (name) => {
    const db = Object.values((prisma as Record<string, Record<string, string>>)[name]!).sort();
    const api = [...((shared as unknown as Record<string, { options: string[] }>)[name]!.options)].sort();
    expect(db).toEqual(api);
  });
});
