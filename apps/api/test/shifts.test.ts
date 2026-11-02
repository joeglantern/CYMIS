// Shifts and the rule that ties them to plan access, through the real API.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/lib/crypto.js';
import { VALID, makeApp, makeAudit, resetData, scanItem, userWithToken, type TestApp } from './helpers.js';

let t: TestApp;
let sup: Awaited<ReturnType<typeof userWithToken>>;
let admin: Awaited<ReturnType<typeof userWithToken>>;
let clerk: Awaited<ReturnType<typeof userWithToken>>;
let other: Awaited<ReturnType<typeof userWithToken>>;

const DAY = { startsAt: '2026-11-03T03:00:00.000Z', endsAt: '2026-11-03T11:00:00.000Z' };
const NIGHT = { startsAt: '2026-11-03T19:00:00.000Z', endsAt: '2026-11-04T03:00:00.000Z' };

beforeAll(async () => {
  t = await makeApp();
  await resetData(t.ctx);
  sup = await userWithToken(t, 'SUPERVISOR');
  admin = await userWithToken(t, 'ADMIN');
  clerk = await userWithToken(t, 'AUDITOR');
  other = await userWithToken(t, 'AUDITOR');
});
afterAll(async () => t.close());

async function newPlan(status: 'DRAFT' | 'ACTIVE' = 'ACTIVE', expected?: string[]) {
  const { audit } = await makeAudit(t, sup.user.id, { status, ...(expected ? { expected } : {}) });
  return audit.id;
}

async function addShift(auditId: string, clerkIds: string[], times = DAY, name = 'Day shift') {
  const res = await t.app.inject({ method: 'POST', url: '/api/v1/shifts', headers: sup.headers, payload: { auditId, name, ...times, clerkIds } });
  expect(res.statusCode, res.body).toBe(201);
  return res.json<{ id: string; clerks: { id: string }[] }>();
}

const setClerks = (shiftId: string, clerkIds: string[]) =>
  t.app.inject({ method: 'PATCH', url: `/api/v1/shifts/${shiftId}`, headers: sup.headers, payload: { clerkIds } });

const setDirect = (auditId: string, userIds: string[]) =>
  t.app.inject({ method: 'PUT', url: `/api/v1/audits/${auditId}/assignees`, headers: sup.headers, payload: { userIds } });

const planRow = (auditId: string, userId: string) => t.ctx.db.auditAssignment.findUnique({ where: { auditId_userId: { auditId, userId } } });

describe('shifts and plan assignment', () => {
  it('adding a clerk to a shift also gives them the plan, marked as coming from the shift', async () => {
    const auditId = await newPlan();
    await addShift(auditId, [clerk.user.id]);
    const row = await planRow(auditId, clerk.user.id);
    expect(row).not.toBeNull();
    expect(row!.viaShiftAt).not.toBeNull();
  });

  it('removing a shift only clerk from their last shift drops the plan', async () => {
    const auditId = await newPlan();
    const shift = await addShift(auditId, [clerk.user.id]);
    expect((await setClerks(shift.id, [])).statusCode).toBe(200);
    expect(await planRow(auditId, clerk.user.id)).toBeNull();
  });

  it('removing a clerk who is still on another shift keeps the plan', async () => {
    const auditId = await newPlan();
    const day = await addShift(auditId, [clerk.user.id]);
    await addShift(auditId, [clerk.user.id], NIGHT, 'Night shift');
    await setClerks(day.id, []);
    expect(await planRow(auditId, clerk.user.id)).not.toBeNull();
  });

  it('removing a clerk assigned directly keeps the plan, and the shift does not change that', async () => {
    const auditId = await newPlan();
    await setDirect(auditId, [clerk.user.id]);
    const shift = await addShift(auditId, [clerk.user.id]);
    expect((await planRow(auditId, clerk.user.id))!.viaShiftAt).toBeNull();
    await setClerks(shift.id, []);
    const row = await planRow(auditId, clerk.user.id);
    expect(row).not.toBeNull();
    expect(row!.viaShiftAt).toBeNull();
  });

  it('deleting a shift follows the same rule for each clerk', async () => {
    const auditId = await newPlan();
    await setDirect(auditId, [other.user.id]);
    const shift = await addShift(auditId, [clerk.user.id, other.user.id]);
    const res = await t.app.inject({ method: 'DELETE', url: `/api/v1/shifts/${shift.id}`, headers: sup.headers });
    expect(res.statusCode, res.body).toBe(204);
    expect(await planRow(auditId, clerk.user.id)).toBeNull();
    expect(await planRow(auditId, other.user.id)).not.toBeNull();
  });

  it('moving a shift only clerk by adding then removing never loses the plan row', async () => {
    const auditId = await newPlan();
    const day = await addShift(auditId, [clerk.user.id]);
    const night = await addShift(auditId, [], NIGHT, 'Night shift');

    expect(await planRow(auditId, clerk.user.id)).not.toBeNull();
    const first = await planRow(auditId, clerk.user.id);

    expect((await setClerks(night.id, [clerk.user.id])).statusCode).toBe(200);
    expect(await planRow(auditId, clerk.user.id)).not.toBeNull();

    expect((await setClerks(day.id, [])).statusCode).toBe(200);
    const last = await planRow(auditId, clerk.user.id);
    expect(last).not.toBeNull();
    // The same row all the way through, still marked as coming from a shift.
    expect(last!.createdAt).toEqual(first!.createdAt);
    expect(last!.viaShiftAt).not.toBeNull();
  });

  it('the Clerks step leaves a shift clerk marked as from a shift when saved again', async () => {
    const auditId = await newPlan();
    await addShift(auditId, [clerk.user.id]);
    await setDirect(auditId, [clerk.user.id, other.user.id]);
    expect((await planRow(auditId, clerk.user.id))!.viaShiftAt).not.toBeNull();
    expect((await planRow(auditId, other.user.id))!.viaShiftAt).toBeNull();
  });

  it('unticking in the Clerks step also takes the person off the plan shifts', async () => {
    const auditId = await newPlan();
    const shift = await addShift(auditId, [clerk.user.id, other.user.id]);
    const res = await setDirect(auditId, [other.user.id]);
    expect(res.statusCode, res.body).toBe(200);
    const list = await t.ctx.db.shiftAssignment.findMany({ where: { shiftId: shift.id } });
    expect(list.map((a) => a.userId)).toEqual([other.user.id]);
    expect(await planRow(auditId, clerk.user.id)).toBeNull();
  });

  it('refuses people who cannot be assigned, on the same terms as the Clerks step', async () => {
    const auditId = await newPlan();
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/shifts',
      headers: sup.headers,
      payload: { auditId, name: 'Day', ...DAY, clerkIds: [admin.user.id] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('bad_assignee');
  });
});

describe('who can do what', () => {
  it('lets admins and supervisors write, and logs it', async () => {
    const auditId = await newPlan();
    const res = await t.app.inject({ method: 'POST', url: '/api/v1/shifts', headers: admin.headers, payload: { auditId, name: 'Day', ...DAY } });
    expect(res.statusCode, res.body).toBe(201);
    const id = res.json().id;
    await t.app.inject({ method: 'PATCH', url: `/api/v1/shifts/${id}`, headers: sup.headers, payload: { name: 'Early' } });
    await t.app.inject({ method: 'DELETE', url: `/api/v1/shifts/${id}`, headers: sup.headers });
    const log = await t.ctx.db.activityLog.findMany({ where: { entityType: 'shift', entityId: id }, orderBy: { createdAt: 'asc' } });
    expect(log.map((l) => l.action)).toEqual(['shift.created', 'shift.updated', 'shift.deleted']);
  });

  it('a clerk cannot list, create, change or delete shifts', async () => {
    const auditId = await newPlan();
    const shift = await addShift(auditId, [clerk.user.id]);
    const calls = [
      t.app.inject({ method: 'GET', url: '/api/v1/shifts', headers: clerk.headers }),
      t.app.inject({ method: 'POST', url: '/api/v1/shifts', headers: clerk.headers, payload: { auditId, name: 'Mine', ...DAY } }),
      t.app.inject({ method: 'PATCH', url: `/api/v1/shifts/${shift.id}`, headers: clerk.headers, payload: { name: 'Mine' } }),
      t.app.inject({ method: 'DELETE', url: `/api/v1/shifts/${shift.id}`, headers: clerk.headers }),
    ];
    for (const res of await Promise.all(calls)) expect(res.statusCode).toBe(403);
    expect(await t.ctx.db.shift.count({ where: { id: shift.id } })).toBe(1);
  });

  it('asks for a sign in', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/shifts' });
    expect(res.statusCode).toBe(401);
  });
});

describe('times and finished plans', () => {
  it('refuses an end at or before the start', async () => {
    const auditId = await newPlan();
    for (const endsAt of [DAY.startsAt, '2026-11-03T02:00:00.000Z']) {
      const res = await t.app.inject({ method: 'POST', url: '/api/v1/shifts', headers: sup.headers, payload: { auditId, name: 'Day', startsAt: DAY.startsAt, endsAt } });
      expect(res.statusCode).toBe(400);
    }
  });

  it('checks a change of one time against the stored other time', async () => {
    const auditId = await newPlan();
    const shift = await addShift(auditId, []);
    const res = await t.app.inject({ method: 'PATCH', url: `/api/v1/shifts/${shift.id}`, headers: sup.headers, payload: { endsAt: '2026-11-03T02:00:00.000Z' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('bad_shift_times');
  });

  it('a shift cannot move to another plan', async () => {
    const auditId = await newPlan();
    const elsewhere = await newPlan();
    const shift = await addShift(auditId, []);
    await t.app.inject({ method: 'PATCH', url: `/api/v1/shifts/${shift.id}`, headers: sup.headers, payload: { auditId: elsewhere, name: 'Moved' } });
    const stored = await t.ctx.db.shift.findUnique({ where: { id: shift.id } });
    expect(stored!.auditId).toBe(auditId);
  });

  it('a finished plan refuses every shift change but can still be read', async () => {
    const auditId = await newPlan();
    const shift = await addShift(auditId, [clerk.user.id]);
    await t.ctx.db.audit.update({ where: { id: auditId }, data: { status: 'CLOSED', closedAt: new Date() } });

    const calls = [
      t.app.inject({ method: 'POST', url: '/api/v1/shifts', headers: sup.headers, payload: { auditId, name: 'Late', ...DAY } }),
      t.app.inject({ method: 'PATCH', url: `/api/v1/shifts/${shift.id}`, headers: sup.headers, payload: { name: 'Late' } }),
      t.app.inject({ method: 'DELETE', url: `/api/v1/shifts/${shift.id}`, headers: sup.headers }),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('audit_finished');
    }
    const list = await t.app.inject({ method: 'GET', url: `/api/v1/shifts?auditId=${auditId}`, headers: sup.headers });
    expect(list.json().items.map((s: { id: string }) => s.id)).toEqual([shift.id]);
  });

  it('lists by when shifts end, stored in UTC', async () => {
    const auditId = await newPlan();
    await addShift(auditId, [], DAY, 'Day');
    await addShift(auditId, [], NIGHT, 'Night');
    const get = async (qs: string) =>
      (await t.app.inject({ method: 'GET', url: `/api/v1/shifts?auditId=${auditId}&${qs}`, headers: sup.headers })).json().items.map((s: { name: string }) => s.name);
    expect(await get('order=asc')).toEqual(['Day', 'Night']);
    expect(await get('order=desc')).toEqual(['Night', 'Day']);
    expect(await get(`endsFrom=${encodeURIComponent('2026-11-03T12:00:00.000Z')}`)).toEqual(['Night']);
    expect(await get(`endsBefore=${encodeURIComponent('2026-11-03T12:00:00.000Z')}`)).toEqual(['Day']);
    const one = (await t.app.inject({ method: 'GET', url: `/api/v1/shifts?auditId=${auditId}&order=asc`, headers: sup.headers })).json().items[0];
    expect(one.startsAt).toBe(DAY.startsAt);
  });
});

describe('the integration API', () => {
  it('keeps every field it had and adds shifts, with a key that may read yard plans', async () => {
    const auditId = await newPlan();
    await addShift(auditId, [clerk.user.id]);
    const key = 'cym_testkeyforshiftadditivecheck';
    await t.ctx.db.serviceAccount.create({
      data: { name: 'Test system', keyHash: sha256Hex(key), keyPrefix: key.slice(0, 8), scopes: ['audits:read'], createdById: admin.user.id },
    });
    const res = await t.app.inject({ method: 'GET', url: `/api/v1/audits/${auditId}`, headers: { authorization: `Bearer ${key}` } });
    expect(res.statusCode, res.body).toBe(200);
    const a = res.json();
    for (const k of ['id', 'name', 'notes', 'status', 'listVersion', 'section', 'createdBy', 'closedBy', 'assignees', 'counts', 'startedAt', 'closedAt', 'createdAt']) {
      expect(a).toHaveProperty(k);
    }
    expect(a.shifts).toHaveLength(1);
  });

  it('a key cannot reach the shift routes, which are for people', async () => {
    const key = 'cym_testkeyforshiftroutecheck';
    await t.ctx.db.serviceAccount.create({
      data: { name: 'Test system 2', keyHash: sha256Hex(key), keyPrefix: key.slice(0, 8), scopes: ['audits:read'], createdById: admin.user.id },
    });
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/shifts', headers: { authorization: `Bearer ${key}` } });
    expect(res.statusCode).toBe(403);
  });
});

describe('what phones see and send', () => {
  it('a scan outside shift hours still saves, late or early, from a phone that knows nothing of shifts', async () => {
    const auditId = await newPlan('ACTIVE', [VALID.a, VALID.b]);
    // The only shift ended long ago, and the next is long away.
    await addShift(auditId, [clerk.user.id], { startsAt: '2020-01-01T03:00:00.000Z', endsAt: '2020-01-01T11:00:00.000Z' }, 'Old shift');
    await addShift(auditId, [clerk.user.id], { startsAt: '2030-01-01T03:00:00.000Z', endsAt: '2030-01-01T11:00:00.000Z' }, 'Future shift');

    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/sync/scans',
      headers: clerk.headers,
      payload: { scans: [scanItem(auditId, VALID.a)] },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().results[0].status).toBe('created');
    expect(res.json().results[0].scan.result).toBe('MATCHED');
  });

  it('a clerk on the plan with no shift at all still saves', async () => {
    const auditId = await newPlan('ACTIVE', [VALID.a]);
    await setDirect(auditId, [other.user.id]);
    const res = await t.app.inject({ method: 'POST', url: '/api/v1/sync/scans', headers: other.headers, payload: { scans: [scanItem(auditId, VALID.a)] } });
    expect(res.json().results[0].status).toBe('created');
  });

  it('every field an old phone reads is still there and means the same', async () => {
    const auditId = await newPlan();
    await setDirect(auditId, [other.user.id]);
    await addShift(auditId, [clerk.user.id]);
    const res = await t.app.inject({ method: 'GET', url: `/api/v1/audits/${auditId}`, headers: clerk.headers });
    expect(res.statusCode).toBe(200);
    const a = res.json();
    for (const key of ['id', 'name', 'notes', 'status', 'listVersion', 'section', 'createdBy', 'closedBy', 'assignees', 'counts', 'startedAt', 'closedAt', 'createdAt']) {
      expect(a).toHaveProperty(key);
    }
    expect(a.assignees.map((p: { id: string }) => p.id).sort()).toEqual([clerk.user.id, other.user.id].sort());
  });

  it('a clerk gets only their own shift, and nothing about who else is on which shift', async () => {
    const auditId = await newPlan();
    await addShift(auditId, [clerk.user.id, other.user.id], DAY, 'Day shift');
    await addShift(auditId, [other.user.id], NIGHT, 'Night shift');

    const mine = (await t.app.inject({ method: 'GET', url: `/api/v1/audits/${auditId}`, headers: clerk.headers })).json();
    expect(mine.shifts.map((s: { name: string }) => s.name)).toEqual(['Day shift']);
    expect(mine.shifts[0].clerkIds).toEqual([clerk.user.id]);
    expect(mine.viaShiftIds).toEqual([]);

    const list = (await t.app.inject({ method: 'GET', url: '/api/v1/audits?mine=true&limit=100', headers: clerk.headers })).json();
    const inList = list.items.find((x: { id: string }) => x.id === auditId);
    expect(inList.shifts.map((s: { name: string }) => s.name)).toEqual(['Day shift']);
    expect(inList.shifts[0].clerkIds).toEqual([clerk.user.id]);
    expect(inList.viaShiftIds).toEqual([]);

    const staff = (await t.app.inject({ method: 'GET', url: `/api/v1/audits/${auditId}`, headers: sup.headers })).json();
    expect(staff.shifts).toHaveLength(2);
    expect(staff.viaShiftIds.sort()).toEqual([clerk.user.id, other.user.id].sort());
  });
});
