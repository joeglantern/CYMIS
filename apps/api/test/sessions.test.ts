import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PASSWORD, createUser, login, makeApp, resetData, type TestApp } from './helpers.js';

let t: TestApp;

beforeAll(async () => {
  t = await makeApp({ env: { APP_MIN_VERSION: '1.2.0', APP_LATEST_VERSION: '1.4.0', FEATURES_OFF: 'photos, autoscan', GIT_COMMIT: 'abc1234' } });
  await resetData(t.ctx);
});
afterAll(async () => t.close());
beforeEach(async () => {
  await t.ctx.redis.flushall();
});

const call = (method: 'GET' | 'POST' | 'DELETE', url: string, token?: string, payload?: object) =>
  t.app.inject({ method, url: `/api/v1${url}`, ...(payload ? { payload } : {}), headers: token ? { authorization: `Bearer ${token}` } : {} });

async function signInTwice(staffId: string) {
  const phone = await t.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { staffId, password: PASSWORD, deviceLabel: 'iPhone 15' } });
  const tablet = await t.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { staffId, password: PASSWORD, deviceLabel: 'Galaxy Tab' } });
  return { phone: phone.json(), tablet: tablet.json() };
}

describe('signed in devices', () => {
  it('lists each sign in once, with the asking device first', async () => {
    const u = await createUser(t.ctx, 'AUDITOR');
    const { phone } = await signInTwice(u.staffId);
    // A refresh rotates the token but stays the same device.
    await t.app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: { refreshToken: phone.refreshToken } });

    const res = await call('GET', '/auth/sessions', phone.accessToken);
    expect(res.statusCode).toBe(200);
    const { sessions } = res.json();
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({ deviceLabel: 'iPhone 15', current: true });
    expect(sessions[1]).toMatchObject({ deviceLabel: 'Galaxy Tab', current: false });
  });

  it('signing a device out stops its access token at once and its refresh token too', async () => {
    const u = await createUser(t.ctx, 'AUDITOR');
    const { phone, tablet } = await signInTwice(u.staffId);
    const tabletSession = (await call('GET', '/auth/sessions', phone.accessToken)).json().sessions.find((s: { current: boolean }) => !s.current);

    expect((await call('DELETE', `/auth/sessions/${tabletSession.id}`, phone.accessToken)).statusCode).toBe(200);

    const me = await call('GET', '/auth/me', tablet.accessToken);
    expect(me.statusCode).toBe(401);
    expect(me.json().error.code).toBe('session_revoked');
    const refreshed = await t.app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: { refreshToken: tablet.refreshToken } });
    expect(refreshed.statusCode).toBe(401);
    // The phone that did it still works.
    expect((await call('GET', '/auth/me', phone.accessToken)).statusCode).toBe(200);
  });

  it('cannot sign out someone else', async () => {
    const a = await createUser(t.ctx, 'AUDITOR');
    const b = await createUser(t.ctx, 'AUDITOR');
    const aTokens = await login(t.app, a.staffId);
    const bTokens = await login(t.app, b.staffId);
    const bSession = (await call('GET', '/auth/sessions', bTokens.accessToken)).json().sessions[0];
    expect((await call('DELETE', `/auth/sessions/${bSession.id}`, aTokens.accessToken)).statusCode).toBe(404);
  });

  it('signs out every other device and keeps this one', async () => {
    const u = await createUser(t.ctx, 'AUDITOR');
    const { phone, tablet } = await signInTwice(u.staffId);
    const res = await call('POST', '/auth/sessions/end-others', phone.accessToken);
    expect(res.json()).toEqual({ ended: 1 });
    expect((await call('GET', '/auth/me', tablet.accessToken)).statusCode).toBe(401);
    expect((await call('GET', '/auth/me', phone.accessToken)).statusCode).toBe(200);
  });

  it('lets only an admin sign a person out everywhere', async () => {
    const crew = await createUser(t.ctx, 'AUDITOR');
    const { phone } = await signInTwice(crew.staffId);
    const supervisor = await login(t.app, (await createUser(t.ctx, 'SUPERVISOR')).staffId);
    const admin = await login(t.app, (await createUser(t.ctx, 'ADMIN')).staffId);

    expect((await call('POST', `/users/${crew.id}/sign-out-everywhere`, supervisor.accessToken)).statusCode).toBe(403);
    const res = await call('POST', `/users/${crew.id}/sign-out-everywhere`, admin.accessToken);
    expect(res.json()).toEqual({ ended: 2 });
    expect((await call('GET', '/auth/me', phone.accessToken)).statusCode).toBe(401);
  });
});

describe('app config and crash reports', () => {
  it('serves versions, switched off features and no notice', async () => {
    const res = await call('GET', '/app-config');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ minVersion: '1.2.0', latestVersion: '1.4.0', features: { photos: false, autoscan: false }, notice: null });
  });

  it('takes a crash report without sign in and refuses junk', async () => {
    expect((await call('POST', '/client-errors', undefined, { message: 'boom', platform: 'ios', appVersion: '0.1.0' })).statusCode).toBe(200);
    expect((await call('POST', '/client-errors', undefined, { message: '', platform: 'fridge' })).statusCode).toBe(400);
  });

  it('health says which build is running', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/health/live' });
    expect(res.json()).toMatchObject({ ok: true, commit: 'abc1234', version: expect.stringMatching(/^\d+\.\d+\.\d+$/) });
  });
});
