import { z } from 'zod';
import { Id, IsoDateTime } from './common.js';
import { ImportSource, ImportStatus } from './enums.js';

/**
 * Our fields. A column mapping says which column in their file holds each one.
 * Only containerNumber is required. Everything else in the row is kept as raw
 * data so nothing from the source file is lost.
 */
export const IMPORT_FIELDS = [
  'containerNumber',
  'sizeType',
  'location',
  'vessel',
  'voyage',
  'fullEmpty',
  'lineOperator',
  'category',
] as const;
export const ImportField = z.enum(IMPORT_FIELDS);
export type ImportField = z.infer<typeof ImportField>;

const Header = z.string().min(1).max(200);

export const ColumnMap = z.object({
  containerNumber: Header,
  sizeType: Header.optional(),
  location: Header.optional(),
  vessel: Header.optional(),
  voyage: Header.optional(),
  fullEmpty: Header.optional(),
  lineOperator: Header.optional(),
  category: Header.optional(),
});
export type ColumnMap = z.infer<typeof ColumnMap>;

export const ImportMode = z.enum(['append', 'replace']);
export type ImportMode = z.infer<typeof ImportMode>;

export const RowError = z.object({
  row: z.number().int(),
  message: z.string(),
  value: z.string().optional(),
});
export type RowError = z.infer<typeof RowError>;

export const ImportDto = z.object({
  id: Id,
  auditId: Id,
  sourceType: ImportSource,
  fileName: z.string(),
  status: ImportStatus,
  sheetName: z.string().nullable(),
  headers: z.array(z.string()),
  sampleRows: z.array(z.record(z.string(), z.string())),
  suggestedMapping: ColumnMap.partial().nullable(),
  mapping: ColumnMap.nullable(),
  mode: ImportMode,
  /** True once the rows have been checked against the chosen mapping. */
  validated: z.boolean(),
  rowCount: z.number().int(),
  validCount: z.number().int(),
  invalidCount: z.number().int(),
  duplicateCount: z.number().int(),
  outOfSectionCount: z.number().int(),
  errors: z.array(RowError),
  failureReason: z.string().nullable(),
  createdAt: IsoDateTime,
  committedAt: IsoDateTime.nullable(),
});
export type ImportDto = z.infer<typeof ImportDto>;

export const UploadImportQuery = z.object({ auditId: Id });

export const SetMappingBody = z.object({
  mapping: ColumnMap,
  mode: ImportMode.default('append'),
  /** Save this mapping by name so the next file with the same columns picks it up. */
  saveAs: z.string().trim().min(2).max(80).optional(),
});
export type SetMappingBody = z.infer<typeof SetMappingBody>;

export const ColumnMappingDto = z.object({
  id: Id,
  name: z.string(),
  mapping: ColumnMap,
  createdAt: IsoDateTime,
});
export type ColumnMappingDto = z.infer<typeof ColumnMappingDto>;

/** System to system: push an expected list as JSON instead of a file. */
export const PushExpectedBody = z.object({
  mode: ImportMode.default('append'),
  containers: z
    .array(
      z.object({
        containerNumber: z.string().min(1).max(32),
        sizeType: z.string().max(40).optional(),
        location: z.string().max(60).optional(),
        vessel: z.string().max(120).optional(),
        voyage: z.string().max(60).optional(),
        fullEmpty: z.string().max(20).optional(),
        lineOperator: z.string().max(120).optional(),
        category: z.string().max(60).optional(),
      }),
    )
    .min(1)
    .max(50_000),
});
export type PushExpectedBody = z.infer<typeof PushExpectedBody>;
