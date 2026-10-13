import { isValidContainerNumber, normalise } from '@cymis/iso6346';
import type { ColumnMap, ImportField, RowError } from '@cymis/schemas';
import type { ParsedRow } from './parser.js';

/** One container ready to go into the expected list. */
export interface ExpectedRow {
  containerNumber: string;
  checkDigitValid: boolean;
  sizeType: string | null;
  location: string | null;
  vessel: string | null;
  voyage: string | null;
  fullEmpty: string | null;
  lineOperator: string | null;
  category: string | null;
  raw: Record<string, string> | null;
  rowNumber: number | null;
}

export interface CanonicalRow {
  rowNumber: number | null;
  fields: Partial<Record<ImportField, string>>;
  raw: Record<string, string> | null;
}

export interface CheckedRows {
  rows: ExpectedRow[];
  errors: RowError[];
  rowCount: number;
  invalidCount: number;
  duplicateCount: number;
  outOfSectionCount: number;
}

export const MAX_STORED_ERRORS = 200;

/** Spreadsheet rows to our field names, using the chosen mapping. */
export function mapRows(rows: ParsedRow[], mapping: ColumnMap): CanonicalRow[] {
  const entries = Object.entries(mapping) as [ImportField, string | undefined][];
  return rows.map((r) => {
    const fields: Partial<Record<ImportField, string>> = {};
    for (const [field, header] of entries) {
      if (header) fields[field] = r.values[header] ?? '';
    }
    return { rowNumber: r.rowNumber, fields, raw: r.values };
  });
}

function clean(v: string | undefined, max: number): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/**
 * Checks every row and keeps the usable ones.
 * - No container number, or the wrong shape: the row is skipped and listed as a problem.
 * - Right shape but the check digit fails: kept and flagged. The box in the yard
 *   might really carry that number, and the supervisor should see the typo.
 * - The same container twice: the first row wins.
 * - If the section has location codes and the row has a location outside them, it is left out.
 */
export function checkRows(input: CanonicalRow[], locationCodes: string[]): CheckedRows {
  const errors: RowError[] = [];
  const seen = new Set<string>();
  const rows: ExpectedRow[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;
  let outOfSectionCount = 0;
  const codes = locationCodes.map((c) => c.toUpperCase());

  const addError = (e: RowError) => {
    if (errors.length < MAX_STORED_ERRORS) errors.push(e);
  };

  for (const r of input) {
    const rawNumber = r.fields.containerNumber ?? '';
    const number = normalise(rawNumber);
    const row = r.rowNumber ?? 0;

    if (!number) {
      invalidCount++;
      addError({ row, message: 'No container number' });
      continue;
    }
    if (!/^[A-Z]{4}\d{7}$/.test(number)) {
      invalidCount++;
      addError({ row, message: 'Not a container number (needs 4 letters and 7 digits)', value: rawNumber.slice(0, 40) });
      continue;
    }
    if (seen.has(number)) {
      duplicateCount++;
      addError({ row, message: 'Listed more than once, kept the first', value: number });
      continue;
    }

    const location = clean(r.fields.location, 60);
    if (codes.length > 0 && location) {
      const loc = location.toUpperCase();
      if (!codes.some((c) => loc.startsWith(c))) {
        outOfSectionCount++;
        continue;
      }
    }

    seen.add(number);
    const checkDigitValid = isValidContainerNumber(number);
    if (!checkDigitValid) addError({ row, message: 'Check digit does not match, kept and flagged', value: number });

    rows.push({
      containerNumber: number,
      checkDigitValid,
      sizeType: clean(r.fields.sizeType, 40),
      location,
      vessel: clean(r.fields.vessel, 120),
      voyage: clean(r.fields.voyage, 60),
      fullEmpty: clean(r.fields.fullEmpty, 20),
      lineOperator: clean(r.fields.lineOperator, 120),
      category: clean(r.fields.category, 60),
      raw: r.raw,
      rowNumber: r.rowNumber,
    });
  }

  return { rows, errors, rowCount: input.length, invalidCount, duplicateCount, outOfSectionCount };
}
