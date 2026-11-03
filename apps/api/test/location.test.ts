// Misplaced boxes: what a clerk's found location does, and each supervisor decision,
// traced through counts, caches, buckets, reports, the list and the promote path.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeCounts } from '../src/infra/progress.js';
import { buildCsv, gatherReportData } from '../src/modules/reports/build.js';
import { VALID, makeApp, resetData, scanItem, userWithToken, type TestApp } from './helpers.js';

let t: TestApp;
let sup: Awaited<ReturnType<typeof userWithToken>>;
let clerk: Awaited<ReturnType<typeof userWithToken>>;
let sectionId: string;
let n = 0;

const LIST = 'A01-02-3';
const FOUND = 'A05-01-1';

beforeAll(async () => {
  t = await makeApp();
  await resetData(t.ctx);
  sup = await userWithToken(t, 'SUPERVISOR');
  clerk = await userWithToken(t, 'AUDITOR');
  const facility = await t.ctx.db.facility.create({ data: { code: 'T1', name: 'Terminal', type: 'PORT' } });
  const section = await t.ctx.db.section.create({ data: { facilityId: facility.id, code: 'S1', name: 'Block', kind: 'YARD_BLOCK', locationCodes: [] } });
  sectionId = section.id;
});
afterAll(async () => t.close());

/** A live plan with VALID.a at LIST and VALID.b on the list with no location. */
async function plan() {
  const audit = await t.ctx.db.audit.create({
    data: { sectionId, name: `Plan ${++n}`, status: 'ACTIVE', startedAt: new Date(), listVersion: 1, createdById: sup.user.id },
  });
  await t.ctx.db.expectedContainer.createMany({
    data: [
      { auditId: audit.id, containerNumber: VALID.a, checkDigitValid: true, location: LIST, version: 1 },
      { auditId: audit.id, containerNumber: VALID.b, checkDigitValid: true, location: null, version: 1 },
    ],
  });
  await t.ctx.db.auditAssignment.create({ data: { auditId: audit.id, userId: clerk.user.id } });
  return audit.id;
}

const sync = async (auditId: string, number: string, extra: Record<string, unknown> = {}) => {
  const res = await t.app.inject({ method: 'POST', url: '/api/v1/sync/scans', headers: clerk.headers, payload: { scans: [scanItem(auditId, number, extra)] } });
  expect(res.statusCode).toBe(200);
  return res.json().results[0];
};
const review = (scanId: string, payload: object, headers = sup.headers) => t.app.inject({ method: 'POST', url: `/api/v1/scans/${scanId}/review`, headers, payload });
const counts = (auditId: string) => computeCounts(t.ctx.db, auditId);
const counted = async (auditId: string) => (await t.app.inject({ method: 'GET', url: `/api/v1/audits/${auditId}/progress`, headers: sup.headers })).json();
const bucket = async (auditId: string, name: string) => (await t.app.inject({ method: 'GET', url: `/api/v1/audits/${auditId}/results?bucket=${name}`, headers: sup.headers })).json().items;
const delta = async (auditId: string, since: number) => (await t.app.inject({ method: 'GET', url: `/api/v1/audits/${auditId}/expected?sinceVersion=${since}`, headers: clerk.headers })).json();

describe('a clerk says the box is somewhere else', () => {
  it('flags it when the box is on the list with a different location', async () => {
    const id = await plan();
    const r = await sync(id, VALID.a, { foundLocation: ' a05-01-1 ' });
    expect(r.status).toBe('created');
    expect(r.scan).toMatchObject({ foundLocation: FOUND, listLocation: LIST, flags: ['LOCATION_MISMATCH'], reviewStatus: 'PENDING', locationDecision: null, result: 'MATCHED' });
    expect(await counts(id)).toMatchObject({ expected: 2, found: 0, mismatched: 1, missing: 1, pendingReview: 1 });
  });

  it.each([
    ['the same, in another case', 'a01-02-3'],
    ['the same, with other separators', 'A01 02 3'],
    ['the same, with no separators', 'A01023'],
  ])('raises no flag for %s', async (_name, foundLocation) => {
    const id = await plan();
    const r = await sync(id, VALID.a, { foundLocation });
    expect(r.scan).toMatchObject({ flags: [], reviewStatus: 'NONE', foundLocation: foundLocation.toUpperCase() });
    expect(await counts(id)).toMatchObject({ found: 1, mismatched: 0 });
  });

  it('stores it with no flag when the list row has no location', async () => {
    const id = await plan();
    const r = await sync(id, VALID.b, { foundLocation: FOUND });
    expect(r.scan).toMatchObject({ foundLocation: FOUND, listLocation: null, flags: [], reviewStatus: 'NONE' });
  });

  it('stores it with no flag when the box is not on the list', async () => {
    const id = await plan();
    const r = await sync(id, VALID.c, { foundLocation: FOUND });
    expect(r.scan).toMatchObject({ foundLocation: FOUND, result: 'UNEXPECTED', flags: [], reviewStatus: 'NONE' });
  });

  it('stores it with no flag on a repeat scan', async () => {
    const id = await plan();
    await sync(id, VALID.a);
    const r = await sync(id, VALID.a, { foundLocation: FOUND });
    expect(r.scan).toMatchObject({ result: 'DUPLICATE', flags: [], reviewStatus: 'NONE' });
  });

  it('keeps both reasons when the check digit also fails', async () => {
    const id = await plan();
    await t.ctx.db.expectedContainer.create({ data: { auditId: id, containerNumber: 'CSQU3054384', checkDigitValid: false, location: LIST, version: 1 } });
    const r = await sync(id, 'CSQU3054384', { foundLocation: FOUND });
    expect(r.scan.flags.sort()).toEqual(['CHECK_DIGIT_FAILED', 'LOCATION_MISMATCH']);
    expect(r.scan.reviewStatus).toBe('PENDING');
  });

  it('refuses a location that is too long', async () => {
    const id = await plan();
    const res = await t.app.inject({ method: 'POST', url: '/api/v1/sync/scans', headers: clerk.headers, payload: { scans: [scanItem(id, VALID.a, { foundLocation: 'X'.repeat(61) })] } });
    expect(res.statusCode).toBe(400);
  });
});

describe('old phones', () => {
  it('a scan with no found location behaves exactly as before', async () => {
    const id = await plan();
    const r = await sync(id, VALID.a);
    expect(r.scan).toMatchObject({ flags: [], reviewStatus: 'NONE', foundLocation: null, locationDecision: null, result: 'MATCHED', listLocation: LIST });
    expect(await counts(id)).toMatchObject({ found: 1, mismatched: 0, missing: 1 });
  });

  it('a retried scan stays one scan', async () => {
    const id = await plan();
    const item = scanItem(id, VALID.a, { foundLocation: FOUND });
    const send = () => t.app.inject({ method: 'POST', url: '/api/v1/sync/scans', headers: clerk.headers, payload: { scans: [item] } });
    expect((await send()).json().results[0].status).toBe('created');
    expect((await send()).json().results[0].status).toBe('unchanged');
    expect(await t.ctx.db.scan.count({ where: { auditId: id } })).toBe(1);
  });
});

describe('update the list', () => {
  it('moves the list, counts the box as found, and phones get it in the next download', async () => {
    const id = await plan();
    const { scan } = await sync(id, VALID.a, { foundLocation: FOUND });
    // Fill the short cache first, to prove the decision clears it.
    expect((await counted(id)).found).toBe(0);

    const res = await review(scan.id, { action: 'UPDATE_LIST' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ locationDecision: 'LIST_UPDATED', reviewStatus: 'APPROVED', result: 'MATCHED', listLocation: FOUND, foundLocation: FOUND });
    expect(res.json().reviewedBy.id).toBe(sup.user.id);
    expect(res.json().reviewedAt).toBeTruthy();

    expect(await counts(id)).toMatchObject({ found: 1, mismatched: 0, missing: 1, pendingReview: 0 });
    expect(await counted(id)).toMatchObject({ found: 1, mismatched: 0, pendingReview: 0 });

    const row = await t.ctx.db.expectedContainer.findFirstOrThrow({ where: { auditId: id, containerNumber: VALID.a } });
    const audit = await t.ctx.db.audit.findUniqueOrThrow({ where: { id } });
    expect(row.location).toBe(FOUND);
    expect(row.version).toBe(2);
    expect(audit.listVersion).toBe(2);

    const d = await delta(id, 1);
    expect(d.listVersion).toBe(2);
    expect(d.items.map((i: { containerNumber: string; location: string }) => [i.containerNumber, i.location])).toEqual([[VALID.a, FOUND]]);

    const found = await bucket(id, 'found');
    expect(found.map((r: { location: string; foundLocation: string }) => [r.location, r.foundLocation])).toEqual([[FOUND, FOUND]]);
    expect(await bucket(id, 'mismatched')).toEqual([]);

    const events = await t.ctx.db.containerEvent.findMany({ where: { scanId: scan.id, source: 'REVIEW' } });
    expect(events[0]?.data).toMatchObject({ action: 'UPDATE_LIST', listLocation: LIST, foundLocation: FOUND });
    expect(await t.ctx.db.activityLog.count({ where: { entityId: scan.id, action: 'scan.update_list' } })).toBe(1);
  });

  it('cannot change the list of a finished plan', async () => {
    const id = await plan();
    const { scan } = await sync(id, VALID.a, { foundLocation: FOUND });
    await t.ctx.db.audit.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
    const res = await review(scan.id, { action: 'UPDATE_LIST' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('audit_finished');
    expect((await t.ctx.db.scan.findUniqueOrThrow({ where: { id: scan.id } })).reviewStatus).toBe('PENDING');
    expect((await t.ctx.db.audit.findUniqueOrThrow({ where: { id } })).listVersion).toBe(1);
  });
});

describe('box must move back', () => {
  it('needs a note', async () => {
    const id = await plan();
    const { scan } = await sync(id, VALID.a, { foundLocation: FOUND });
    expect((await review(scan.id, { action: 'MOVE_BACK' })).statusCode).toBe(400);
  });

  it('leaves the list alone, counts the box as found, and shows it as a job', async () => {
    const id = await plan();
    const { scan } = await sync(id, VALID.a, { foundLocation: FOUND });
    const res = await review(scan.id, { action: 'MOVE_BACK', note: 'Goes back to A01' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ locationDecision: 'MOVE_BACK', reviewStatus: 'APPROVED', reviewNote: 'Goes back to A01', listLocation: LIST, foundLocation: FOUND });
    expect(await counts(id)).toMatchObject({ found: 1, mismatched: 0, missing: 1, pendingReview: 0 });

    const row = await t.ctx.db.expectedContainer.findFirstOrThrow({ where: { auditId: id, containerNumber: VALID.a } });
    expect(row).toMatchObject({ location: LIST, version: 1 });
    expect((await t.ctx.db.audit.findUniqueOrThrow({ where: { id } })).listVersion).toBe(1);
    expect((await delta(id, 1)).items).toEqual([]);

    // The yard map draws from these rows: it stays in the list's bay, as found.
    const found = await bucket(id, 'found');
    expect(found.map((r: { location: string; foundLocation: string }) => [r.location, r.foundLocation])).toEqual([[LIST, FOUND]]);

    const jobs = await t.app.inject({ method: 'GET', url: `/api/v1/audits/${id}/scans?locationDecision=MOVE_BACK`, headers: sup.headers });
    expect(jobs.json().items.map((s: { id: string }) => s.id)).toEqual([scan.id]);
    const queue = await t.app.inject({ method: 'GET', url: `/api/v1/audits/${id}/scans?flagged=true&reviewStatus=PENDING`, headers: sup.headers });
    expect(queue.json().items).toEqual([]);
  });

  it('does not promote a repeat scan: the first scan still counts', async () => {
    const id = await plan();
    const first = (await sync(id, VALID.a, { foundLocation: FOUND })).scan;
    const second = (await sync(id, VALID.a)).scan;
    expect(second.result).toBe('DUPLICATE');
    await review(first.id, { action: 'MOVE_BACK', note: 'Back to A01' });
    const after = await t.ctx.db.scan.findUniqueOrThrow({ where: { id: second.id } });
    expect(after).toMatchObject({ result: 'DUPLICATE', duplicateOfId: first.id });
    expect(await counts(id)).toMatchObject({ found: 1, duplicates: 1 });
  });
});

describe('reject stays what it was', () => {
  it('voids the scan, the box is missing again, and the list stays', async () => {
    const id = await plan();
    const { scan } = await sync(id, VALID.a, { foundLocation: FOUND });
    const res = await review(scan.id, { action: 'REJECT', note: 'Wrong box' });
    expect(res.json()).toMatchObject({ reviewStatus: 'REJECTED', locationDecision: null });
    expect(await counts(id)).toMatchObject({ found: 0, mismatched: 0, missing: 2, pendingReview: 0 });
    expect((await t.ctx.db.expectedContainer.findFirstOrThrow({ where: { auditId: id, containerNumber: VALID.a } })).location).toBe(LIST);
  });

  it('promotes a repeat scan, as it always has', async () => {
    const id = await plan();
    const first = (await sync(id, VALID.a, { foundLocation: FOUND })).scan;
    const second = (await sync(id, VALID.a)).scan;
    await review(first.id, { action: 'REJECT', note: 'Wrong box' });
    const after = await t.ctx.db.scan.findUniqueOrThrow({ where: { id: second.id } });
    expect(after).toMatchObject({ result: 'MATCHED', duplicateOfId: null });
    expect(await counts(id)).toMatchObject({ found: 1, mismatched: 0, duplicates: 0 });
  });
});

describe('the other actions are unchanged', () => {
  it('approve and correct still work on an ordinary flagged scan', async () => {
    const id = await plan();
    await t.ctx.db.expectedContainer.create({ data: { auditId: id, containerNumber: 'CSQU3054384', checkDigitValid: false, location: null, version: 1 } });
    const a = (await sync(id, 'CSQU3054384')).scan;
    const res = await review(a.id, { action: 'APPROVE' });
    expect(res.json()).toMatchObject({ reviewStatus: 'APPROVED', locationDecision: null });
  });

  it('a location decision needs a location waiting', async () => {
    const id = await plan();
    const plain = (await sync(id, VALID.a)).scan;
    const res = await review(plain.id, { action: 'UPDATE_LIST' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('no_location_decision');
  });

  it('cannot be decided twice', async () => {
    const id = await plan();
    const { scan } = await sync(id, VALID.a, { foundLocation: FOUND });
    expect((await review(scan.id, { action: 'MOVE_BACK', note: 'Back' })).statusCode).toBe(200);
    expect((await review(scan.id, { action: 'UPDATE_LIST' })).statusCode).toBe(409);
    expect((await t.ctx.db.expectedContainer.findFirstOrThrow({ where: { auditId: id, containerNumber: VALID.a } })).location).toBe(LIST);
  });

  it('keep expected = found + missing + (mismatched - offListReview) through every decision', async () => {
    const holds = async (auditId: string) => {
      const k = await counts(auditId);
      expect(k.expected).toBe(k.found + k.missing + (k.mismatched - k.offListReview));
    };
    for (const decide of [
      { action: 'UPDATE_LIST' },
      { action: 'MOVE_BACK', note: 'Goes back to A01' },
      { action: 'REJECT', note: 'Misread' },
    ]) {
      const auditId = await plan();
      await holds(auditId);
      const r = await sync(auditId, VALID.a, { foundLocation: FOUND });
      await holds(auditId);
      expect((await review(r.scan?.id ?? r.id, decide)).statusCode).toBe(200);
      await holds(auditId);
    }
  });

  it('a clerk cannot decide', async () => {
    const id = await plan();
    const { scan } = await sync(id, VALID.a, { foundLocation: FOUND });
    expect((await review(scan.id, { action: 'UPDATE_LIST' }, clerk.headers)).statusCode).toBe(403);
  });
});

describe('reports', () => {
  it('add a found location column at the end, moving nothing', async () => {
    const id = await plan();
    const { scan } = await sync(id, VALID.a, { foundLocation: FOUND });
    await review(scan.id, { action: 'MOVE_BACK', note: 'Back' });
    const csv = buildCsv(await gatherReportData(t.ctx, id)).toString('utf8');
    const [head, ...rows] = csv.replace(/^﻿/, '').trim().split('\n');
    expect(head).toBe('"Result","Container","Location","Colour","Scanned at (UTC)","Scanned by","Flags","Found location"');
    const row = rows.find((r) => r.includes(VALID.a))!;
    expect(row.startsWith(`"Found","${VALID.a}","${LIST}"`)).toBe(true);
    expect(row.endsWith(`"LOCATION_MISMATCH","${FOUND}"`)).toBe(true);
  });
});
