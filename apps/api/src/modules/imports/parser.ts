// Reads a spreadsheet export (xlsx, xls or csv) into plain rows of text.
// Nothing here knows about audits or the database, which keeps it easy to test
// and easy to swap for another source (EDI, a terminal system API) later.

import { IMPORT_FIELDS, type ColumnMap, type ImportField } from '@cymis/schemas';
import * as XLSX from 'xlsx';
import * as cptable from 'xlsx/dist/cpexcel.full.mjs';
import { sha256Hex } from '../../lib/crypto.js';

XLSX.set_cptable(cptable);

export type FileKind = 'xlsx' | 'xls' | 'csv';

export interface ParsedRow {
  /** Row number as seen in the spreadsheet, starting at 1. */
  rowNumber: number;
  values: Record<string, string>;
}

export interface ParsedSheet {
  sheetName: string | null;
  headers: string[];
  rows: ParsedRow[];
}

export class ParseError extends Error {}

const HEADER_SCAN_ROWS = 25;

/** Works out the file type from its first bytes, and checks the name agrees. */
export function detectFileKind(buffer: Buffer, fileName: string): FileKind {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  const isZip = buffer.length > 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const isOle =
    buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));

  if (ext === 'xlsx' && isZip) return 'xlsx';
  if (ext === 'xls' && (isOle || isZip)) return 'xls';
  if (ext === 'csv' && !isZip && !isOle) {
    // A text file should have no NUL bytes in its first few kilobytes.
    if (buffer.subarray(0, 8192).includes(0)) throw new ParseError('That CSV file does not look like text.');
    return 'csv';
  }
  throw new ParseError('Upload an Excel file (.xlsx or .xls) or a CSV file. The file type and its name must agree.');
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Header patterns for each of our fields. Checked against the lower cased, de-punctuated header. */
const FIELD_PATTERNS: Record<ImportField, RegExp> = {
  containerNumber:
    /^(container|cntr|ctnr|ctr|cont|equipment|equip|eqp|unit|box)( ?(no|number|num|nbr|id|ref|nr))?$|^(container|unit|equipment) (no|number|nbr|id)$/,
  sizeType: /\b(size ?type|sz ?tp|size|iso( code| type)?|cntr type|ctr type|container type|eq type|equipment type|type)\b/,
  location: /\b(location|loc|yard ?position|yard ?pos|position|pos|slot|yard ?location|block|stack)\b/,
  vessel: /\b(vessel( name)?|ship( name)?|vsl)\b/,
  voyage: /\b(voyage( no| number)?|voy)\b/,
  fullEmpty: /\b(full ?empty|f ?e|freight kind|load status|full ?mty|empty ?full|fe status)\b/,
  lineOperator: /\b(line( operator| code)?|operator|shipping line|carrier|opr)\b/,
  category: /\b(category|cat|trade|import ?export|i ?e|move ?type|movement)\b/,
};

const CONTAINER_VALUE = /^[A-Z]{4}\d{7}$/;

function looksLikeContainer(v: string): boolean {
  return CONTAINER_VALUE.test(v.toUpperCase().replace(/[^A-Z0-9]/g, ''));
}

function scoreHeaderRow(cells: string[]): number {
  let score = 0;
  for (const cell of cells) {
    const h = normHeader(cell);
    if (!h) continue;
    if (FIELD_PATTERNS.containerNumber.test(h)) score += 5;
    for (const field of IMPORT_FIELDS) {
      if (field !== 'containerNumber' && FIELD_PATTERNS[field].test(h)) score += 1;
    }
    if (looksLikeContainer(cell)) score -= 3; // a data row, not a header
  }
  return score;
}

function cleanHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((cell, i) => {
    let h = String(cell ?? '').replace(/\s+/g, ' ').trim();
    if (!h) h = `Column ${i + 1}`;
    if (h.length > 200) h = h.slice(0, 200);
    const n = (seen.get(h) ?? 0) + 1;
    seen.set(h, n);
    return n > 1 ? `${h} (${n})` : h;
  });
}

function sheetToMatrix(ws: XLSX.WorkSheet): string[][] {
  const matrix = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: true,
    dateNF: 'yyyy-mm-dd',
  });
  return matrix.map((r) => r.map((c) => String(c ?? '').trim()));
}

/**
 * Parses the file. Picks the sheet and header row that look most like a
 * container list, so a title row or a cover sheet does not trip it up.
 */
export function parseSpreadsheet(buffer: Buffer, kind: FileKind, maxRows: number): ParsedSheet {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, {
      type: 'buffer',
      dense: true,
      raw: kind === 'csv',
      cellFormula: false,
      cellHTML: false,
      cellDates: true,
      // Read a little past the limit so we can tell the file is too big.
      sheetRows: maxRows + HEADER_SCAN_ROWS + 2,
      ...(kind === 'csv' ? { codepage: 65001 } : {}),
    });
  } catch {
    throw new ParseError('The file could not be read. It may be damaged or password protected.');
  }
  if (wb.SheetNames.length === 0) throw new ParseError('The file has no sheets.');

  let best: { name: string; matrix: string[][]; headerIndex: number; score: number } | null = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const matrix = sheetToMatrix(ws);
    if (matrix.length === 0) continue;
    let headerIndex = matrix.findIndex((r) => r.some((c) => c !== ''));
    if (headerIndex < 0) continue;
    let score = -Infinity;
    for (let i = 0; i < Math.min(HEADER_SCAN_ROWS, matrix.length); i++) {
      const row = matrix[i]!;
      if (!row.some((c) => c !== '')) continue;
      const s = scoreHeaderRow(row);
      if (s > score) {
        score = s;
        headerIndex = i;
      }
    }
    if (!best || score > best.score || (score === best.score && matrix.length > best.matrix.length)) {
      best = { name, matrix, headerIndex, score };
    }
  }
  if (!best) throw new ParseError('The file is empty.');

  const width = Math.max(...best.matrix.slice(best.headerIndex).map((r) => r.length));
  const headerCells = best.matrix[best.headerIndex]!;
  const headers = cleanHeaders(Array.from({ length: width }, (_, i) => headerCells[i] ?? ''));

  const rows: ParsedRow[] = [];
  for (let i = best.headerIndex + 1; i < best.matrix.length; i++) {
    const cells = best.matrix[i]!;
    if (!cells.some((c) => c !== '')) continue;
    if (rows.length >= maxRows) {
      throw new ParseError(`The file has more than ${maxRows.toLocaleString('en')} rows. Split it into smaller files.`);
    }
    const values: Record<string, string> = {};
    headers.forEach((h, j) => {
      values[h] = cells[j] ?? '';
    });
    rows.push({ rowNumber: i + 1, values });
  }

  return { sheetName: kind === 'csv' ? null : best.name, headers, rows };
}

/** Same columns in any order give the same signature, so a saved mapping can be found again. */
export function headerSignature(headers: string[]): string {
  return sha256Hex(
    headers
      .map((h) => normHeader(h))
      .filter(Boolean)
      .sort()
      .join('|'),
  );
}

/** Best guess at which column holds which field. The person always confirms it. */
export function suggestMapping(headers: string[], sample: ParsedRow[]): Partial<ColumnMap> {
  const used = new Set<string>();
  const out: Partial<ColumnMap> = {};

  for (const field of IMPORT_FIELDS) {
    const match = headers.find((h) => !used.has(h) && FIELD_PATTERNS[field].test(normHeader(h)));
    if (match) {
      out[field] = match;
      used.add(match);
    }
  }

  // No container column by name? Pick the column whose values look most like container numbers.
  if (!out.containerNumber && sample.length > 0) {
    let bestHeader: string | null = null;
    let bestHits = 0;
    for (const h of headers) {
      const hits = sample.filter((r) => looksLikeContainer(r.values[h] ?? '')).length;
      if (hits > bestHits) {
        bestHits = hits;
        bestHeader = h;
      }
    }
    if (bestHeader && bestHits >= Math.ceil(sample.length / 2)) {
      if (used.has(bestHeader)) {
        for (const f of IMPORT_FIELDS) if (out[f] === bestHeader) delete out[f];
      }
      out.containerNumber = bestHeader;
    }
  }
  return out;
}
