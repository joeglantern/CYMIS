// The main path, end to end through the real API and workers:
// create audit, upload a spreadsheet, map columns, check rows, commit,
// start, sync scans, read progress and results, make a report.

import * as XLSX from 'xlsx';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VALID, makeApp, resetData, scanItem, userWithToken, waitFor, type TestApp } from './helpers.js';

let t: TestApp;
let sup: Awaited<ReturnType<typeof userWithToken>>;
let crew: Awaited<ReturnType<typeof userWithToken>>;

beforeAll(async () => {
  t = await makeApp({ workers: true });
  await resetData(t.ctx);
  sup = await userWithToken(t, 'SUPERVISOR');
  crew = await userWithToken(t, 'AUDITOR');
});
afterAll(async () => t.close());

/** A file shaped like a terminal export: a title row, then headers, then data. */
function exportFile(): Buffer {
  const rows = [
    ['Yard inventory export 2026-10-20'],
    [],
    ['Container No', 'Size/Type', 'Yard Position', 'Vessel', 'F/E', 'Line'],
    [VALID.a, '22G1', 'A01-02-3', 'MV SAMPLE', 'F', 'CSQ'],
    [VALID.b, '45G1', 'A01-03-1', 'MV SAMPLE', 'E', 'MSK'],
    [VALID.c, '22G1', 'A02-01-2', 'MV OTHER', 'F', 'MSC'],
    ['CSQU3054384', '22G1', 'A02-02-2', 'MV OTHER', 'F', 'CSQ'], // bad check digit, kept and flagged
    [VALID.a, '22G1', 'A01-02-3', 'MV SAMPLE', 'F', 'CSQ'], // listed twice
    ['NOT A BOX', '', 'A09', '', '', ''], // unusable
    [VALID.d, '22G1', 'B05-01-1', 'MV OTHER', 'F', 'TGH'], // other block, left out
    ['=HYPERLINK("x")', '', 'A01', '', '', ''], // formula text, unusable
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Inventory');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function multipart(fileName: string, content: Buffer) {
  const boundary = '----cymis' + Math.random().toString(16).slice(2);
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        'Content-Type: application/octet-stream\r\n\r\n',
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('audit from start to report', () => {
  let auditId: string;
  let importId: string;

  it('creates an audit for a section and assigns crew', async () => {
    const facility = await t.ctx.db.facility.create({ data: { code: 'T1', name: 'Terminal', type: 'PORT' } });
    const section = await t.ctx.db.section.create({
      data: { facilityId: facility.id, code: 'YB-A', name: 'Yard Block A', kind: 'YARD_BLOCK', locationCodes: ['A'] },
    });
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/audits',
      headers: sup.headers,
      payload: { sectionId: section.id, name: 'Block A count' },
    });
    expect(res.statusCode).toBe(201);
    auditId = res.json().id;

    const assign = await t.app.inject({
      method: 'PUT',
      url: `/api/v1/audits/${auditId}/assignees`,
      headers: sup.headers,
      payload: { userIds: [crew.user.id] },
    });
    expect(assign.json().assignees).toHaveLength(1);
  });

  it('reads the upload, finds the header row and suggests a mapping', async () => {
    const { body, contentType } = multipart('export.xlsx', exportFile());
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/v1/imports?auditId=${auditId}`,
      headers: { ...sup.headers, 'content-type': contentType },
      payload: body,
    });
    expect(res.statusCode, res.body).toBe(202);
    importId = res.json().id;

    const ready = await waitFor(async () => {
      const r = await t.app.inject({ method: 'GET', url: `/api/v1/imports/${importId}`, headers: sup.headers });
      return r.json().status === 'READY' ? r.json() : null;
    });
    expect(ready.headers).toEqual(['Container No', 'Size/Type', 'Yard Position', 'Vessel', 'F/E', 'Line']);
    expect(ready.rowCount).toBe(8);
    expect(ready.suggestedMapping).toMatchObject({
      containerNumber: 'Container No',
      sizeType: 'Size/Type',
      location: 'Yard Position',
      vessel: 'Vessel',
      fullEmpty: 'F/E',
      lineOperator: 'Line',
    });
  });

  it('checks the rows against the mapping and the section', async () => {
    const draft = (await t.app.inject({ method: 'GET', url: `/api/v1/imports/${importId}`, headers: sup.headers })).json();
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/v1/imports/${importId}/mapping`,
      headers: sup.headers,
      payload: { mapping: draft.suggestedMapping, saveAs: 'Terminal export' },
    });
    expect(res.statusCode, res.body).toBe(202);

    const checked = await waitFor(async () => {
      const r = await t.app.inject({ method: 'GET', url: `/api/v1/imports/${importId}`, headers: sup.headers });
      return r.json().validated ? r.json() : null;
    });
    expect(checked.validCount).toBe(4); // a, b, c, and the bad check digit one
    expect(checked.duplicateCount).toBe(1);
    expect(checked.invalidCount).toBe(2);
    expect(checked.outOfSectionCount).toBe(1);
    expect(checked.errors.some((e: { message: string }) => e.message.includes('Check digit'))).toBe(true);
  });

  it('commits into the expected list, and phones can fetch only changes', async () => {
    const res = await t.app.inject({ method: 'POST', url: `/api/v1/imports/${importId}/commit`, headers: sup.headers });
    expect(res.statusCode, res.body).toBe(202);
    await waitFor(async () => {
      const r = await t.app.inject({ method: 'GET', url: `/api/v1/imports/${importId}`, headers: sup.headers });
      return r.json().status === 'COMMITTED';
    });

    const full = (
      await t.app.inject({ method: 'GET', url: `/api/v1/audits/${auditId}/expected`, headers: crew.headers })
    ).json();
    expect(full.full).toBe(true);
    expect(full.items.map((i: { containerNumber: string }) => i.containerNumber).sort()).toEqual(
      [VALID.a, VALID.b, VALID.c, 'CSQU3054384'].sort(),
    );

    const delta = (
      await t.app.inject({
        method: 'GET',
        url: `/api/v1/audits/${auditId}/expected?sinceVersion=${full.listVersion}`,
        headers: crew.headers,
      })
    ).json();
    expect(delta.full).toBe(false);
    expect(delta.items).toHaveLength(0);
  });

  it('refuses scans until the audit is started', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/sync/scans',
      headers: crew.headers,
      payload: { scans: [scanItem(auditId, VALID.a)] },
    });
    expect(res.json().results[0]).toMatchObject({ status: 'rejected', code: 'audit_not_started' });
    const start = await t.app.inject({ method: 'POST', url: `/api/v1/audits/${auditId}/start`, headers: sup.headers });
    expect(start.json().status).toBe('ACTIVE');
  });

  it('syncs scans: matched, unexpected, duplicate, flagged, and safe to retry', async () => {
    const matched = scanItem(auditId, VALID.a, { colourChosen: 'blue' });
    const items = [
      matched,
      scanItem(auditId, VALID.b),
      scanItem(auditId, VALID.e), // not on the list
      scanItem(auditId, VALID.a), // second scan of the same box
      scanItem(auditId, 'MSKU9070329', { entryMethod: 'MANUAL' }), // bad check digit
    ];
    const res = await t.app.inject({ method: 'POST', url: '/api/v1/sync/scans', headers: crew.headers, payload: { scans: items } });
    expect(res.statusCode, res.body).toBe(200);
    const results = res.json().results;
    expect(results.map((r: { scan: { result: string } }) => r.scan.result)).toEqual([
      'MATCHED',
      'MATCHED',
      'UNEXPECTED',
      'DUPLICATE',
      'UNEXPECTED',
    ]);
    expect(results[4].scan.flags).toEqual(['CHECK_DIGIT_FAILED']);
    expect(results[4].scan.reviewStatus).toBe('PENDING');

    // The phone lost the reply and sends the first scan again.
    const retry = await t.app.inject({
      method: 'POST',
      url: '/api/v1/sync/scans',
      headers: crew.headers,
      payload: { scans: [matched] },
    });
    expect(retry.json().results[0].status).toBe('unchanged');
    expect(await t.ctx.db.scan.count({ where: { auditId } })).toBe(5);
  });

  it('counts every bucket correctly', async () => {
    await t.ctx.progress.invalidate(auditId);
    const counts = (
      await t.app.inject({ method: 'GET', url: `/api/v1/audits/${auditId}/progress`, headers: sup.headers })
    ).json();
    expect(counts).toEqual({
      expected: 4,
      found: 2,
      missing: 2, // c and the bad check digit row
      unexpected: 1,
      mismatched: 1, // the flagged manual entry
      duplicates: 1,
      scans: 5,
      pendingReview: 1,
    });

    const missing = (
      await t.app.inject({ method: 'GET', url: `/api/v1/audits/${auditId}/results?bucket=missing`, headers: sup.headers })
    ).json();
    expect(missing.items.map((r: { containerNumber: string }) => r.containerNumber).sort()).toEqual(
      [VALID.c, 'CSQU3054384'].sort(),
    );
  });

  it('closes the audit and builds an Excel report', async () => {
    const close = await t.app.inject({ method: 'POST', url: `/api/v1/audits/${auditId}/close`, headers: sup.headers });
    expect(close.json().status).toBe('CLOSED');

    const req = await t.app.inject({
      method: 'POST',
      url: `/api/v1/audits/${auditId}/reports`,
      headers: sup.headers,
      payload: { format: 'XLSX' },
    });
    expect(req.statusCode).toBe(202);
    const report = await waitFor(async () => {
      const r = await t.app.inject({ method: 'GET', url: `/api/v1/reports/${req.json().id}`, headers: sup.headers });
      return r.json().status === 'READY' ? r.json() : null;
    }, 30_000);
    const file = await fetch(report.downloadUrl);
    expect(file.status).toBe(200);
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Summary', 'Found', 'Missing', 'Unexpected', 'Needs review', 'Duplicate scans']);
  });

  it('keeps crew out of supervisor routes', async () => {
    const res = await t.app.inject({ method: 'POST', url: `/api/v1/audits/${auditId}/close`, headers: crew.headers });
    expect(res.statusCode).toBe(403);
  });
});
