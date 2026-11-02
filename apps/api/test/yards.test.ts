import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeApp, resetData, userWithToken, type TestApp } from './helpers.js';

let t: TestApp;
let admin: string;
let supervisor: string;
let clerk: string;
let facilityId: string;
let otherFacilityId: string;

const call = (method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: object) =>
  t.app.inject({ method, url: `/api/v1${url}`, ...(payload ? { payload } : {}), headers: { authorization: `Bearer ${token}` } });

const square = [
  { lat: -4.06, lng: 39.65 },
  { lat: -4.06, lng: 39.66 },
  { lat: -4.07, lng: 39.66 },
  { lat: -4.07, lng: 39.65 },
];
let n = 0;
const code = () => `T${++n}`;

async function yard(facility = facilityId) {
  const res = await call('POST', '/yards', admin, { facilityId: facility, code: code(), name: 'Yard one' });
  expect(res.statusCode).toBe(201);
  return res.json();
}
async function section(extra: object = {}) {
  const res = await call('POST', '/sections', admin, { facilityId, code: code(), name: 'Block one', kind: 'YARD_BLOCK', ...extra });
  expect(res.statusCode).toBe(201);
  return res.json();
}

beforeAll(async () => {
  t = await makeApp();
  await resetData(t.ctx);
  admin = (await userWithToken(t, 'ADMIN')).token;
  supervisor = (await userWithToken(t, 'SUPERVISOR')).token;
  clerk = (await userWithToken(t, 'AUDITOR')).token;
  facilityId = (await call('POST', '/facilities', admin, { code: 'SITE1', name: 'Site one', type: 'PORT' })).json().id;
  otherFacilityId = (await call('POST', '/facilities', admin, { code: 'SITE2', name: 'Site two', type: 'DEPOT' })).json().id;
});
afterAll(async () => t.close());

describe('yards', () => {
  it('an admin adds a yard and it shows on the facility', async () => {
    const y = await yard();
    expect(y).toMatchObject({ facilityId, isActive: true });
    const list = (await call('GET', '/facilities', admin)).json();
    expect(list.find((f: { id: string }) => f.id === facilityId).yards.map((v: { id: string }) => v.id)).toContain(y.id);
  });

  it('only admins can add or change a yard', async () => {
    const y = await yard();
    for (const token of [supervisor, clerk]) {
      expect((await call('POST', '/yards', token, { facilityId, code: code(), name: 'No' })).statusCode).toBe(403);
      expect((await call('PATCH', `/yards/${y.id}`, token, { name: 'No' })).statusCode).toBe(403);
    }
  });

  it('refuses a short code already used on that site, but not on another', async () => {
    const res = await call('POST', '/yards', admin, { facilityId, code: 'SAME', name: 'First' });
    expect(res.statusCode).toBe(201);
    const again = await call('POST', '/yards', admin, { facilityId, code: 'SAME', name: 'Second' });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('code_taken');
    expect((await call('POST', '/yards', admin, { facilityId: otherFacilityId, code: 'SAME', name: 'Third' })).statusCode).toBe(201);
  });

  it('a yard with areas turned on cannot be switched off, with a clear message', async () => {
    const y = await yard();
    const s = await section({ yardId: y.id });
    const res = await call('PATCH', `/yards/${y.id}`, admin, { isActive: false });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({ code: 'yard_has_active_sections' });
    expect(res.json().error.message).toMatch(/1 area turned on/);

    expect((await call('PATCH', `/sections/${s.id}`, admin, { isActive: false })).statusCode).toBe(200);
    expect((await call('PATCH', `/yards/${y.id}`, admin, { isActive: false })).statusCode).toBe(200);
  });

  it('nothing can go on inside a turned off yard', async () => {
    const y = await yard();
    const s = await section({ yardId: y.id });
    await call('PATCH', `/sections/${s.id}`, admin, { isActive: false });
    await call('PATCH', `/yards/${y.id}`, admin, { isActive: false });

    const add = await call('POST', '/sections', admin, { facilityId, code: code(), name: 'Block', kind: 'YARD_BLOCK', yardId: y.id });
    expect(add.json().error.code).toBe('yard_turned_off');
    const on = await call('PATCH', `/sections/${s.id}`, admin, { isActive: true });
    expect(on.statusCode).toBe(409);
    expect(on.json().error.code).toBe('yard_turned_off');
  });

  it('logs yard changes', async () => {
    const y = await yard();
    const rows = await t.ctx.db.activityLog.findMany({ where: { entityId: y.id } });
    expect(rows.map((r) => r.action)).toContain('yard.created');
  });
});

describe('sections in yards', () => {
  it('moves a section into a yard and back out', async () => {
    const y = await yard();
    const s = await section();
    expect(s).toMatchObject({ yardId: null, boundary: null });
    expect((await call('PATCH', `/sections/${s.id}`, admin, { yardId: y.id })).json().yardId).toBe(y.id);
    expect((await call('PATCH', `/sections/${s.id}`, admin, { yardId: null })).json().yardId).toBeNull();
  });

  it('refuses a yard on another site, when adding and when moving', async () => {
    const other = await yard(otherFacilityId);
    const add = await call('POST', '/sections', admin, { facilityId, code: code(), name: 'Block', kind: 'YARD_BLOCK', yardId: other.id });
    expect(add.statusCode).toBe(400);
    expect(add.json().error.code).toBe('yard_other_facility');

    const s = await section();
    const move = await call('PATCH', `/sections/${s.id}`, admin, { yardId: other.id });
    expect(move.statusCode).toBe(400);
    expect((await call('GET', '/facilities', admin)).json().find((f: { id: string }) => f.id === facilityId).sections.find((v: { id: string }) => v.id === s.id).yardId).toBeNull();
  });

  it('saves, changes and clears a shape', async () => {
    const s = await section();
    expect((await call('PATCH', `/sections/${s.id}`, admin, { boundary: square })).json().boundary).toEqual(square);
    const changed = [...square.slice(0, 3), { lat: -4.071, lng: 39.651 }];
    expect((await call('PATCH', `/sections/${s.id}`, admin, { boundary: changed })).json().boundary).toEqual(changed);
    expect((await call('PATCH', `/sections/${s.id}`, admin, { boundary: null })).json().boundary).toBeNull();
    // Changing something else leaves the shape alone.
    await call('PATCH', `/sections/${s.id}`, admin, { boundary: square });
    expect((await call('PATCH', `/sections/${s.id}`, admin, { name: 'Renamed' })).json().boundary).toEqual(square);
  });

  it.each([
    ['too few corners', square.slice(0, 2)],
    ['a repeated corner', [...square, square[0]]],
    ['crossing edges', [square[0], square[2], square[1], square[3]]],
    ['out of range', [{ lat: 95, lng: 39 }, ...square.slice(1)]],
  ])('refuses %s', async (_name, boundary) => {
    const s = await section();
    const res = await call('PATCH', `/sections/${s.id}`, admin, { boundary });
    expect(res.statusCode).toBe(400);
    const add = await call('POST', '/sections', admin, { facilityId, code: code(), name: 'Block', kind: 'YARD_BLOCK', boundary });
    expect(add.statusCode).toBe(400);
  });

  it('only admins can set a shape or a yard', async () => {
    const s = await section();
    expect((await call('PATCH', `/sections/${s.id}`, supervisor, { boundary: square })).statusCode).toBe(403);
    expect((await call('PATCH', `/sections/${s.id}`, clerk, { yardId: null })).statusCode).toBe(403);
  });
});

describe('old clients', () => {
  it('a section body with no yard or shape still works', async () => {
    const res = await call('POST', '/sections', admin, { facilityId, code: code(), name: 'Old client block', kind: 'GATE', locationCodes: ['g1'] });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ yardId: null, boundary: null, locationCodes: ['G1'] });
  });

  it('every old field on a facility is still there for a clerk, with the new ones beside them', async () => {
    const res = await call('GET', '/facilities', clerk);
    expect(res.statusCode).toBe(200);
    const f = res.json().find((x: { id: string }) => x.id === facilityId);
    expect(f).toMatchObject({ id: facilityId, code: 'SITE1', name: 'Site one', type: 'PORT', isActive: true });
    expect(Array.isArray(f.sections)).toBe(true);
    expect(Array.isArray(f.yards)).toBe(true);
  });
});
