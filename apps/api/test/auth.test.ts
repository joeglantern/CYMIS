import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAX_FAILED_LOGINS } from '../src/modules/auth/service.js';
import { PASSWORD, createUser, login, makeApp, resetData, type TestApp } from './helpers.js';

let t: TestApp;

beforeAll(async () => {
  t = await makeApp();
  await resetData(t.ctx);
});
afterAll(async () => t.close());
// Sign in is rate limited per person and address, and every test here comes from 127.0.0.1.
beforeEach(async () => {
  await t.ctx.redis.flushall();
});

const post = (url: string, payload: unknown, headers: Record<string, string> = {}) =>
  t.app.inject({ method: 'POST', url: `/api/v1${url}`, payload: payload as object, headers });

describe('sign in', () => {
  it('signs in and returns tokens and the person', async () => {
    const u = await createUser(t.ctx, 'AUDITOR', { staffId: 'crew1' });
    const res = await post('/auth/login', { staffId: 'crew1', password: PASSWORD });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user).toMatchObject({ id: u.id, staffId: 'CREW1', role: 'AUDITOR' });
    expect(body.user.passwordHash).toBeUndefined();
  });

  it('gives the same answer for a wrong password and an unknown staff id', async () => {
    await createUser(t.ctx, 'AUDITOR', { staffId: 'crew2' });
    const wrong = await post('/auth/login', { staffId: 'crew2', password: 'nope nope nope' });
    const unknown = await post('/auth/login', { staffId: 'nobody', password: 'nope nope nope' });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
  });

  it('locks the account after too many wrong tries, then an admin can unlock it', async () => {
    const u = await createUser(t.ctx, 'AUDITOR', { staffId: 'crew3' });
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await post('/auth/login', { staffId: 'crew3', password: 'wrong wrong' });
    const locked = await post('/auth/login', { staffId: 'crew3', password: PASSWORD });
    expect(locked.statusCode).toBe(423);

    const admin = await createUser(t.ctx, 'ADMIN');
    const { accessToken } = await login(t.app, admin.staffId);
    const unlock = await post(`/users/${u.id}/unlock`, {}, { authorization: `Bearer ${accessToken}` });
    expect(unlock.statusCode).toBe(200);
    expect((await post('/auth/login', { staffId: 'crew3', password: PASSWORD })).statusCode).toBe(200);
  });

  it('blocks deactivated people', async () => {
    const u = await createUser(t.ctx, 'AUDITOR');
    await t.ctx.db.user.update({ where: { id: u.id }, data: { isActive: false } });
    expect((await post('/auth/login', { staffId: u.staffId, password: PASSWORD })).statusCode).toBe(401);
  });

  it('rate limits sign in attempts', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      codes.push((await post('/auth/login', { staffId: 'ratelimit', password: 'x' })).statusCode);
    }
    expect(codes).toContain(429);
  });

  it('does not block a whole shift signing in from one address', async () => {
    // Twelve different people on the same yard Wi-Fi, one wrong try each.
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      codes.push((await post('/auth/login', { staffId: `shift${i}`, password: 'wrong password' })).statusCode);
    }
    expect(codes).not.toContain(429);
    expect(new Set(codes)).toEqual(new Set([401]));
  });
});

describe('first sign in', () => {
  it('forces a password change before anything else', async () => {
    const u = await createUser(t.ctx, 'SUPERVISOR', { mustChangePassword: true });
    await t.ctx.redis.flushall(); // clear the rate limit from the test above
    const auth = await login(t.app, u.staffId);
    const headers = { authorization: `Bearer ${auth.accessToken}` };

    const blocked = await t.app.inject({ method: 'GET', url: '/api/v1/audits', headers });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.code).toBe('password_change_required');

    const me = await t.app.inject({ method: 'GET', url: '/api/v1/auth/me', headers });
    expect(me.json().mustChangePassword).toBe(true);

    const changed = await post('/auth/change-password', { currentPassword: PASSWORD, newPassword: 'a brand new phrase' }, headers);
    expect(changed.statusCode).toBe(200);
    const fresh = changed.json();

    // The old token stops working at once; the new one works.
    expect((await t.app.inject({ method: 'GET', url: '/api/v1/auth/me', headers })).statusCode).toBe(401);
    const ok = await t.app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${fresh.accessToken}` },
    });
    expect(ok.statusCode).toBe(200);

    // The old refresh token is gone too.
    expect((await post('/auth/refresh', { refreshToken: auth.refreshToken })).statusCode).toBe(401);
  });

  it('rejects a weak new password', async () => {
    const u = await createUser(t.ctx, 'AUDITOR', { mustChangePassword: true });
    const auth = await login(t.app, u.staffId);
    const res = await post(
      '/auth/change-password',
      { currentPassword: PASSWORD, newPassword: 'short' },
      { authorization: `Bearer ${auth.accessToken}` },
    );
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation_failed');
  });
});

describe('refresh tokens', () => {
  it('rotates on every use', async () => {
    const u = await createUser(t.ctx, 'AUDITOR');
    const first = await login(t.app, u.staffId);
    const r1 = await post('/auth/refresh', { refreshToken: first.refreshToken });
    expect(r1.statusCode).toBe(200);
    const second = r1.json();
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect((await post('/auth/refresh', { refreshToken: second.refreshToken })).statusCode).toBe(200);
  });

  it('cuts off the whole sign in when an old token comes back later', async () => {
    const u = await createUser(t.ctx, 'AUDITOR');
    const first = await login(t.app, u.staffId);
    const second = (await post('/auth/refresh', { refreshToken: first.refreshToken })).json();

    // Pretend the rotation happened a minute ago, past the race window.
    await t.ctx.db.refreshToken.updateMany({
      where: { userId: u.id, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    expect((await post('/auth/refresh', { refreshToken: first.refreshToken })).statusCode).toBe(401);
    // The newer token from the same sign in is now dead as well.
    expect((await post('/auth/refresh', { refreshToken: second.refreshToken })).statusCode).toBe(401);
  });

  it('uses an httpOnly cookie for the web dashboard', async () => {
    const u = await createUser(t.ctx, 'SUPERVISOR');
    const res = await post('/auth/login', { staffId: u.staffId, password: PASSWORD, client: 'web' });
    expect(res.statusCode).toBe(200);
    expect(res.json().refreshToken).toBeUndefined();
    const cookie = res.cookies.find((c) => c.name === 'cymis_rt');
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Strict');

    const refreshed = await t.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { cymis_rt: cookie!.value },
    });
    expect(refreshed.statusCode, refreshed.body).toBe(200);
    expect(refreshed.cookies.find((c) => c.name === 'cymis_rt')?.value).not.toBe(cookie!.value);
  });

  it('logout ends the sign in', async () => {
    const u = await createUser(t.ctx, 'AUDITOR');
    const auth = await login(t.app, u.staffId);
    expect((await post('/auth/logout', { refreshToken: auth.refreshToken })).statusCode).toBe(200);
    expect((await post('/auth/refresh', { refreshToken: auth.refreshToken })).statusCode).toBe(401);
  });

  it('records sign ins in the activity log without secrets', async () => {
    const rows = await t.ctx.db.activityLog.findMany({ where: { action: 'auth.login' } });
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain(PASSWORD);
  });
});
