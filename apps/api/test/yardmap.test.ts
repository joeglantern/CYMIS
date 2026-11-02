// The bay grid and site map data: totals, roles, and what a clerk is never sent.

import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { VALID, makeApp, makeAudit, resetData, scanItem, userWithToken, type TestApp } from './helpers.js';

let t: TestApp;
let sup: Awaited<ReturnType<typeof userWithToken>>;
let clerk: Awaited<ReturnType<typeof userWithToken>>;
let other: Awaited<ReturnType<typeof userWithToken>>;

beforeAll(async () => {
  t = await makeApp();
  await resetData(t.ctx);
  sup = await userWithToken(t, 'SUPERVISOR');
  clerk = await userWithToken(t, 'AUDITOR');
  other = await userWithToken(t, 'AUDITOR');
  await t.ctx.db.user.update({ where: { id: other.user.id }, data: { fullName: 'Zawadi Secret Namesake' } });
});
afterAll(async () => t.close());

const LOCATIONS: Record<string, string> = {
  [VALID.a]: 'A01-02-3',
  [VALID.b]: 'A01-02-1',
  [VALID.c]: 'B05-01-1',
  [VALID.d]: 'C09-07-1',
};

/** A live plan with a located list and two clerks on it. */
async function plan() {
  const made = await makeAudit(t, sup.user.id, { status: 'ACTIVE', expected: Object.keys(LOCATIONS) });
  for (const [n, location] of Object.entries(LOCATIONS)) {
    await t.ctx.db.expectedContainer.updateMany({ where: { auditId: made.audit.id, containerNumber: n }, data: { location } });
  }
  await t.ctx.db.auditAssignment.createMany({ data: [clerk, other].map((c) => ({ auditId: made.audit.id, userId: c.user.id })) });
  return made;
}

const get = (url: string, who: { headers: Record<string, string> }) => t.app.inject({ method: 'GET', url: `/api/v1${url}`, headers: who.headers });
const sync = (who: typeof clerk, scans: unknown[]) => t.app.inject({ method: 'POST', url: '/api/v1/sync/scans', headers: who.headers, payload: { scans } });

describe('bays', () => {
  it('adds up to the plan counts, and keeps boxes with no location apart', async () => {
    const { audit, section } = await plan();
    await t.ctx.db.section.update({ where: { id: section.id }, data: { locationCodes: ['A', 'B'] } });
    await sync(clerk, [
      scanItem(audit.id, VALID.a),
      scanItem(audit.id, VALID.c),
      scanItem(audit.id, VALID.e), // not on the list
      scanItem(audit.id, VALID.a), // a duplicate counts for nothing
    ]);
    const body = (await get(`/audits/${audit.id}/bays`, sup)).json();
    const progress = (await get(`/audits/${audit.id}/progress`, sup)).json();

    const sum = (key: 'found' | 'missing' | 'unexpected' | 'mismatched') =>
      body.bays.reduce((n: number, b: Record<string, number>) => n + b[key]!, 0) + body.withoutLocation[key];
    expect(sum('found')).toBe(progress.found);
    expect(sum('missing')).toBe(progress.missing);
    expect(sum('unexpected')).toBe(progress.unexpected);
    expect(sum('mismatched')).toBe(progress.mismatched);
    expect(body.withoutLocation.unexpected).toBe(1);

    const a = body.bays.find((b: { row: string; bay: string }) => b.row === 'A01' && b.bay === '02');
    expect(a).toMatchObject({ found: 1, missing: 1 });
  });

  it('counts a box waiting for review as needing a decision, not as found', async () => {
    const { audit } = await plan();
    await sync(clerk, [scanItem(audit.id, VALID.a, { entryMethod: 'MANUAL' })]);
    await t.ctx.db.scan.updateMany({ where: { auditId: audit.id }, data: { reviewStatus: 'PENDING', flags: ['CHECK_DIGIT_FAILED'] } });
    const body = (await get(`/audits/${audit.id}/bays`, sup)).json();
    expect(body.bays.find((b: { row: string }) => b.row === 'A01')).toMatchObject({ mismatched: 1, found: 0 });
  });

  it('names the blocks a plan touches, by their location codes, longest code first', async () => {
    const { audit, facility } = await plan();
    const wide = await t.ctx.db.section.create({ data: { facilityId: facility.id, code: 'W', name: 'A rows', kind: 'YARD_BLOCK', locationCodes: ['A'] } });
    const narrow = await t.ctx.db.section.create({ data: { facilityId: facility.id, code: 'N', name: 'B05 only', kind: 'YARD_BLOCK', locationCodes: ['B05', 'B'] } });
    await t.ctx.db.section.create({ data: { facilityId: facility.id, code: 'Z', name: 'Nothing here', kind: 'YARD_BLOCK', locationCodes: ['Z9'] } });
    const body = (await get(`/audits/${audit.id}/bays`, sup)).json();

    expect(body.blocks.map((b: { name: string }) => b.name).sort()).toEqual(['A rows', 'B05 only']);
    expect(body.blocks.find((b: { id: string }) => b.id === wide.id).missing).toBe(2);
    expect(body.bays.find((b: { row: string }) => b.row === 'B05').blockId).toBe(narrow.id);
    expect(body.bays.find((b: { row: string }) => b.row === 'C09').blockId).toBeNull();
  });

  it('sends a clerk counts and nothing about any person or position', async () => {
    const { audit } = await plan();
    await sync(other, [scanItem(audit.id, VALID.a, { location: { lat: -4.05, lng: 39.65 } })]);
    const res = await get(`/audits/${audit.id}/bays`, clerk);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.body).not.toContain('Zawadi');
    expect(res.body).not.toContain('39.65');
    expect(res.body).not.toContain(other.user.id);
    expect(res.body).not.toContain('boundary');
  });

  it('gives a clerk only a plan they are on', async () => {
    const { audit } = await makeAudit(t, sup.user.id, { status: 'ACTIVE' });
    expect((await get(`/audits/${audit.id}/bays`, clerk)).statusCode).toBe(404);
  });
});

describe('site map', () => {
  const square = [
    { lat: -4.05, lng: 39.6 },
    { lat: -4.05, lng: 39.61 },
    { lat: -4.06, lng: 39.61 },
  ];

  it('is for staff only: a clerk on the plan gets 403', async () => {
    const { audit } = await plan();
    expect((await get(`/audits/${audit.id}/map`, clerk)).statusCode).toBe(403);
    expect((await get(`/audits/${audit.id}/map`, sup)).statusCode).toBe(200);
  });

  it('counts scans with no position in plain numbers, and never guesses one', async () => {
    const { audit } = await plan();
    await sync(clerk, [
      scanItem(audit.id, VALID.a, { location: { lat: -4.05, lng: 39.65 } }),
      scanItem(audit.id, VALID.b),
      scanItem(audit.id, VALID.c),
    ]);
    const body = (await get(`/audits/${audit.id}/map`, sup)).json();
    expect(body.scansTotal).toBe(3);
    expect(body.scansWithoutLocation).toBe(2);
    expect(body.points).toHaveLength(1);
    expect(body.points[0]).toMatchObject({ lat: -4.05, lng: 39.65, initials: 'AP' });
    expect(body.pointsCapped).toBe(false);
  });

  it('caps the points and says so', async () => {
    const { audit } = await plan();
    const rows = Array.from({ length: 201 }, (_, i) => scanItem(audit.id, VALID.a, { location: { lat: -4 - i / 1000, lng: 39.6 } }));
    for (let i = 0; i < rows.length; i += 100) await sync(clerk, rows.slice(i, i + 100));
    const body = (await get(`/audits/${audit.id}/map`, sup)).json();
    expect(body.points).toHaveLength(200);
    expect(body.pointsCapped).toBe(true);
  });

  it('shows the site shapes, with this plan counted on its blocks and the whole count on a whole yard area', async () => {
    const { audit, facility, section } = await plan();
    await t.ctx.db.section.update({ where: { id: section.id }, data: { locationCodes: [], kind: 'OTHER', boundary: square } });
    await t.ctx.db.section.create({ data: { facilityId: facility.id, code: 'BLKA', name: 'Shaped A', kind: 'YARD_BLOCK', locationCodes: ['A'], boundary: square } });
    await t.ctx.db.section.create({ data: { facilityId: facility.id, code: 'NOSHAPE', name: 'No shape', kind: 'YARD_BLOCK', locationCodes: ['B'] } });
    const body = (await get(`/audits/${audit.id}/map`, sup)).json();
    const names = body.blocks.map((b: { name: string }) => b.name);
    expect(names).toContain('Shaped A');
    expect(names).not.toContain('No shape');
    const area = body.blocks.find((b: { isPlanArea: boolean }) => b.isPlanArea);
    expect(area.missing).toBe(4);
    expect(body.blocks.find((b: { name: string }) => b.name === 'Shaped A').missing).toBe(2);
  });
});

describe('what a clerk is sent about other people', () => {
  it('the scan list returns only their own scans, whatever they ask for', async () => {
    const { audit } = await plan();
    await sync(clerk, [scanItem(audit.id, VALID.a)]);
    await sync(other, [scanItem(audit.id, VALID.b, { location: { lat: -4.05, lng: 39.65 } })]);

    for (const url of [`/audits/${audit.id}/scans`, `/audits/${audit.id}/scans?auditorId=${other.user.id}`]) {
      const res = await get(url, clerk);
      expect(res.statusCode).toBe(200);
      expect(res.json().items).toHaveLength(1);
      expect(res.body).not.toContain('Zawadi');
      expect(res.body).not.toContain('39.65');
    }
    expect((await get(`/audits/${audit.id}/scans`, sup)).json().items).toHaveLength(2);
  });

  it('one scan by id is refused when it is someone else\'s', async () => {
    const { audit } = await plan();
    const theirs = (await sync(other, [scanItem(audit.id, VALID.b)])).json().results[0].scan.id;
    const mine = (await sync(clerk, [scanItem(audit.id, VALID.a)])).json().results[0].scan.id;
    expect((await get(`/scans/${theirs}`, clerk)).statusCode).toBe(404);
    expect((await get(`/scans/${mine}`, clerk)).statusCode).toBe(200);
    expect((await get(`/scans/${theirs}`, sup)).statusCode).toBe(200);
  });

  it('live scan events go to staff in the room, and a clerk gets only the counts', async () => {
    const { audit } = await plan();
    await t.app.listen({ port: 0, host: '127.0.0.1' });
    const port = (t.app.server.address() as AddressInfo).port;
    const open = (token: string) =>
      new Promise<Socket>((resolve, reject) => {
        const s = connect(`http://127.0.0.1:${port}`, { transports: ['websocket'], auth: { token } });
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
      });
    const join = (s: Socket) => new Promise((resolve) => s.emit('audit:join', { auditId: audit.id }, resolve));

    const clerkSock = await open(clerk.token);
    const staffSock = await open(sup.token);
    await join(clerkSock);
    await join(staffSock);

    const clerkEvents: string[] = [];
    const staffEvents: string[] = [];
    const clerkBodies: string[] = [];
    clerkSock.onAny((name, payload) => {
      clerkEvents.push(name);
      clerkBodies.push(JSON.stringify(payload));
    });
    staffSock.onAny((name) => staffEvents.push(name));

    await sync(other, [scanItem(audit.id, VALID.a, { location: { lat: -4.05, lng: 39.65 } }), scanItem(audit.id, 'MSKU9070329', { entryMethod: 'MANUAL' })]);
    await t.ctx.progress.flushAll();
    await new Promise((r) => setTimeout(r, 400));

    expect(staffEvents).toContain('scan:created');
    expect(staffEvents).toContain('flag:raised');
    expect(staffEvents).toContain('audit:progress');
    expect(clerkEvents).toContain('audit:progress');
    expect(clerkEvents).not.toContain('scan:created');
    expect(clerkEvents).not.toContain('flag:raised');
    expect(clerkBodies.join()).not.toContain('39.65');

    clerkSock.close();
    staffSock.close();
  });
});
