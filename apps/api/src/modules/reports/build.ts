import type { AuditCounts, Bucket, ResultRow } from '@cymis/schemas';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import type { AppContext } from '../../context.js';
import { computeCounts } from '../../infra/progress.js';
import { getResultsPage } from '../audits/service.js';

const BUCKETS: Bucket[] = ['found', 'missing', 'unexpected', 'mismatched'];
const BUCKET_TITLES: Record<Bucket, string> = {
  found: 'Found',
  missing: 'Missing',
  unexpected: 'Unexpected',
  mismatched: 'Needs review',
};
const PDF_ROWS_PER_SECTION = 2000;
const PDF_MAX_PHOTOS = 48;

export function reportFileName(auditName: string, format: 'XLSX' | 'CSV' | 'PDF'): string {
  const slug = auditName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `cymis-audit-${slug || 'report'}.${format.toLowerCase()}`;
}

/**
 * Stops spreadsheet apps from running a cell as a formula. Values that start
 * with = + - @ or a control character get a leading apostrophe.
 */
export function safeCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export interface ReportData {
  audit: {
    id: string;
    name: string;
    status: string;
    section: string;
    facility: string;
    startedAt: Date | null;
    closedAt: Date | null;
  };
  counts: AuditCounts;
  rows: Record<Bucket, ResultRow[]>;
  duplicates: { containerNumber: string; scannedAt: string; scannedBy: string }[];
  generatedAt: Date;
}

export async function gatherReportData(ctx: AppContext, auditId: string): Promise<ReportData> {
  const audit = await ctx.db.audit.findUniqueOrThrow({
    where: { id: auditId },
    include: { section: { include: { facility: true } } },
  });
  const rows = { found: [], missing: [], unexpected: [], mismatched: [] } as Record<Bucket, ResultRow[]>;
  for (const bucket of BUCKETS) {
    let cursor: string | undefined;
    do {
      const page = await getResultsPage(ctx, auditId, bucket, cursor, 1000);
      rows[bucket].push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }
  const dups = await ctx.db.scan.findMany({
    where: { auditId, result: 'DUPLICATE' },
    include: { auditor: { select: { fullName: true } } },
    orderBy: { id: 'asc' },
  });
  return {
    audit: {
      id: audit.id,
      name: audit.name,
      status: audit.status,
      section: `${audit.section.code} ${audit.section.name}`,
      facility: `${audit.section.facility.code} ${audit.section.facility.name}`,
      startedAt: audit.startedAt,
      closedAt: audit.closedAt,
    },
    counts: await computeCounts(ctx.db, auditId),
    rows,
    duplicates: dups.map((d) => ({
      containerNumber: d.containerNumber,
      scannedAt: d.capturedAt.toISOString(),
      scannedBy: d.auditor.fullName,
    })),
    generatedAt: new Date(),
  };
}

const fmt = (d: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '');

function rowArray(r: ResultRow): string[] {
  return [
    BUCKET_TITLES[r.bucket],
    r.containerNumber,
    r.location ?? '',
    r.colour ?? '',
    r.scannedAt ? r.scannedAt.replace('T', ' ').slice(0, 16) : '',
    r.scannedBy ?? '',
    r.flags.join(', '),
  ].map(safeCell);
}

const ROW_HEADER = ['Result', 'Container', 'Location', 'Colour', 'Scanned at (UTC)', 'Scanned by', 'Flags'];

function summaryRows(d: ReportData): string[][] {
  return [
    ['Audit', safeCell(d.audit.name)],
    ['Facility', safeCell(d.audit.facility)],
    ['Section', safeCell(d.audit.section)],
    ['Status', d.audit.status],
    ['Started', fmt(d.audit.startedAt)],
    ['Closed', fmt(d.audit.closedAt)],
    ['Report made', fmt(d.generatedAt)],
    [],
    ['Expected', String(d.counts.expected)],
    ['Found', String(d.counts.found)],
    ['Missing', String(d.counts.missing)],
    ['Unexpected', String(d.counts.unexpected)],
    ['Needs review', String(d.counts.mismatched)],
    ['Duplicate scans', String(d.counts.duplicates)],
  ];
}

export function buildXlsx(d: ReportData): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows(d)), 'Summary');
  for (const bucket of BUCKETS) {
    const sheet = XLSX.utils.aoa_to_sheet([ROW_HEADER, ...d.rows[bucket].map(rowArray)]);
    sheet['!cols'] = [{ wch: 13 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 22 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, sheet, BUCKET_TITLES[bucket]);
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Container', 'Scanned at (UTC)', 'Scanned by'],
      ...d.duplicates.map((x) => [x.containerNumber, x.scannedAt, safeCell(x.scannedBy)]),
    ]),
    'Duplicate scans',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;
}

export function buildCsv(d: ReportData): Buffer {
  const all = BUCKETS.flatMap((b) => d.rows[b].map(rowArray));
  const sheet = XLSX.utils.aoa_to_sheet([ROW_HEADER, ...all]);
  // A byte order mark helps Excel open the file as UTF-8.
  return Buffer.from('﻿' + XLSX.utils.sheet_to_csv(sheet, { forceQuotes: true }), 'utf8');
}

export async function buildPdf(ctx: AppContext, d: ReportData): Promise<Buffer> {
  // Thumbnails for the boxes that need attention.
  const photoScans = [...d.rows.mismatched, ...d.rows.unexpected].filter((r) => r.scanId).slice(0, PDF_MAX_PHOTOS);
  const photos = await ctx.db.photo.findMany({
    where: { scanId: { in: photoScans.map((r) => r.scanId!) }, status: 'UPLOADED', thumbKey: { not: null } },
    orderBy: { createdAt: 'asc' },
  });
  const thumbByScan = new Map<string, string>();
  for (const p of photos) if (!thumbByScan.has(p.scanId) && p.thumbKey) thumbByScan.set(p.scanId, p.thumbKey);
  const thumbs = new Map<string, Buffer>();
  await Promise.all(
    [...thumbByScan.entries()].map(async ([scanId, key]) => {
      try {
        thumbs.set(scanId, await ctx.storage.getBuffer(key));
      } catch {
        // A missing thumbnail should not stop the report.
      }
    }),
  );

  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Audit report: ${d.audit.name}`, Author: 'Cymis' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const ink = '#1b1b1a';
  const muted = '#6b6a66';
  const rule = '#d4d2cc';

  doc.fillColor(muted).fontSize(9).text('CONTAINER AUDIT REPORT', { characterSpacing: 1.2 });
  doc.moveDown(0.3).fillColor(ink).fontSize(20).text(d.audit.name);
  doc.moveDown(0.2).fillColor(muted).fontSize(10).text(`${d.audit.facility}  /  ${d.audit.section}`);
  doc.moveDown(1);

  const s = summaryRows(d).filter((r) => r.length > 0);
  for (const [label, value] of s) {
    const y = doc.y;
    doc.fillColor(muted).fontSize(10).text(label ?? '', 48, y, { width: 140 });
    doc.fillColor(ink).text(value ?? '', 190, y, { width: 340 });
    doc.moveTo(48, doc.y + 3).lineTo(547, doc.y + 3).strokeColor(rule).lineWidth(0.5).stroke();
    doc.moveDown(0.4);
  }

  for (const bucket of ['missing', 'unexpected', 'mismatched'] as Bucket[]) {
    const rows = d.rows[bucket];
    doc.addPage();
    doc.fillColor(ink).fontSize(14).text(`${BUCKET_TITLES[bucket]} (${rows.length})`);
    doc.moveDown(0.5);
    if (rows.length === 0) {
      doc.fillColor(muted).fontSize(10).text('Nothing in this group.');
      continue;
    }
    doc.fontSize(9);
    for (const r of rows.slice(0, PDF_ROWS_PER_SECTION)) {
      if (doc.y > 770) doc.addPage();
      const y = doc.y;
      doc.fillColor(ink).font('Courier').text(r.containerNumber, 48, y, { width: 100 });
      doc.font('Helvetica').fillColor(muted);
      doc.text(r.location ?? '', 152, y, { width: 90 });
      doc.text(r.scannedBy ?? '', 246, y, { width: 130 });
      doc.text(r.flags.join(', ').toLowerCase().replace(/_/g, ' '), 380, y, { width: 167 });
      doc.moveDown(0.25);
    }
    if (rows.length > PDF_ROWS_PER_SECTION) {
      doc.moveDown().fillColor(muted).text(`${rows.length - PDF_ROWS_PER_SECTION} more rows are in the Excel report.`);
    }
  }

  if (thumbs.size > 0) {
    doc.addPage();
    doc.fillColor(ink).fontSize(14).text('Photos of boxes that need attention');
    doc.moveDown(0.5);
    let x = 48;
    let y = doc.y;
    for (const r of photoScans) {
      const img = thumbs.get(r.scanId!);
      if (!img) continue;
      if (y > 640) {
        doc.addPage();
        x = 48;
        y = 48;
      }
      try {
        doc.image(img, x, y, { fit: [155, 116] });
      } catch {
        continue;
      }
      doc.fillColor(ink).fontSize(8).font('Courier').text(r.containerNumber, x, y + 120, { width: 155 });
      doc.font('Helvetica').fillColor(muted).text(BUCKET_TITLES[r.bucket], x, y + 131, { width: 155 });
      x += 168;
      if (x > 400) {
        x = 48;
        y += 160;
      }
    }
  }

  doc.end();
  return done;
}
