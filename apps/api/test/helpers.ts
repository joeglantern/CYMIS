import type { AuthResponse, Role } from '@cymis/schemas';
import type { FastifyInstance } from 'fastify';
import { inject } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { closeContext, createContext, type AppContext } from '../src/context.js';
import { startWorkers, type Workers } from '../src/jobs/index.js';
import { newId } from '../src/lib/ids.js';
import { hashPassword } from '../src/modules/auth/service.js';

export const PASSWORD = 'test password 2026';

export function testEnv(overrides: Record<string, string> = {}): Env {
  const infra = inject('infra');
  return loadEnv({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '0',
    LOG_LEVEL: 'silent',
    CORS_ORIGINS: 'http://localhost:8081',
    DATABASE_URL: infra.databaseUrl,
    REDIS_URL: infra.redisUrl,
    JWT_SECRET: 'test_jwt_secret_test_jwt_secret_test_jwt_secret',
    COOKIE_SECRET: 'test_cookie_secret_test_cookie_secret_test_cookie',
    S3_ENDPOINT: infra.s3Endpoint,
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'cymis-test',
    S3_ACCESS_KEY_ID: 'test_access',
    S3_SECRET_ACCESS_KEY: 'test_secret_key_123',
    S3_FORCE_PATH_STYLE: 'true',
    ...overrides,
  });
}

export interface TestApp {
  app: FastifyInstance;
  ctx: AppContext;
  workers: Workers | null;
  close(): Promise<void>;
}

const TABLES = [
  'activity_log',
  'container_events',
  'photos',
  'scans',
  'expected_containers',
  'import_batches',
  'column_mappings',
  'reports',
  'audit_assignments',
  'audits',
  'sections',
  'facilities',
  'service_accounts',
  'refresh_tokens',
  'users',
];

/** Empties every table and Redis. Call at the start of each test file. */
export async function resetData(ctx: AppContext): Promise<void> {
  await ctx.db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`);
  await ctx.redis.flushall();
}

export async function makeApp(options: { workers?: boolean; env?: Record<string, string> } = {}): Promise<TestApp> {
  const ctx = createContext(testEnv(options.env));
  await retry(() => ctx.storage.ensureBucket(), 10);
  const app = await buildApp(ctx);
  await app.ready();
  const workers = options.workers ? await startWorkers(ctx, app.log) : null;
  return {
    app,
    ctx,
    workers,
    async close() {
      await workers?.stop();
      await app.close();
      await closeContext(ctx);
    },
  };
}

async function retry<T>(fn: () => Promise<T>, times: number): Promise<T> {
  let last: unknown;
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw last;
}

export async function createUser(
  ctx: AppContext,
  role: Role,
  options: { staffId?: string; mustChangePassword?: boolean; password?: string } = {},
) {
  return ctx.db.user.create({
    data: {
      staffId: (options.staffId ?? `${role.slice(0, 3)}${Math.random().toString(36).slice(2, 8)}`).toUpperCase(),
      fullName: `${role.toLowerCase()} person`,
      role,
      passwordHash: await hashPassword(options.password ?? PASSWORD),
      mustChangePassword: options.mustChangePassword ?? false,
    },
  });
}

export async function login(app: FastifyInstance, staffId: string, password = PASSWORD): Promise<AuthResponse> {
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { staffId, password } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  return res.json<AuthResponse>();
}

export async function userWithToken(t: TestApp, role: Role) {
  const user = await createUser(t.ctx, role);
  const auth = await login(t.app, user.staffId);
  return { user, token: auth.accessToken, headers: { authorization: `Bearer ${auth.accessToken}` } };
}

/** A facility, a section and an audit ready for scanning. */
export async function makeAudit(
  t: TestApp,
  creatorId: string,
  options: { status?: 'DRAFT' | 'ACTIVE' | 'CLOSED'; locationCodes?: string[]; expected?: string[] } = {},
) {
  const code = `F${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
  const facility = await t.ctx.db.facility.create({ data: { code, name: 'Test Terminal', type: 'PORT' } });
  const section = await t.ctx.db.section.create({
    data: { facilityId: facility.id, code: 'YB-A', name: 'Yard Block A', kind: 'YARD_BLOCK', locationCodes: options.locationCodes ?? [] },
  });
  const status = options.status ?? 'ACTIVE';
  const audit = await t.ctx.db.audit.create({
    data: {
      sectionId: section.id,
      name: 'Test audit',
      status,
      createdById: creatorId,
      startedAt: status === 'DRAFT' ? null : new Date(),
      closedAt: status === 'CLOSED' ? new Date() : null,
      listVersion: options.expected?.length ? 1 : 0,
    },
  });
  if (options.expected?.length) {
    await t.ctx.db.expectedContainer.createMany({
      data: options.expected.map((n) => ({ id: newId(), auditId: audit.id, containerNumber: n, checkDigitValid: true, version: 1 })),
    });
  }
  return { facility, section, audit };
}

export function scanItem(auditId: string, containerNumber: string, extra: Record<string, unknown> = {}) {
  return {
    id: newId(),
    auditId,
    containerNumber,
    entryMethod: 'OCR',
    capturedAt: new Date().toISOString(),
    deviceId: 'test-phone',
    ...extra,
  };
}

export async function waitFor<T>(fn: () => Promise<T>, timeoutMs = 15_000): Promise<Exclude<T, null | undefined | false>> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v as Exclude<T, null | undefined | false>;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('waitFor timed out');
}

// Valid ISO 6346 numbers, checked by a separate implementation.
export const VALID = {
  a: 'CSQU3054383',
  b: 'MSKU9070323',
  c: 'MSCU6639870',
  d: 'TGHU1234567',
  e: 'HLXU8765430',
  f: 'OOLU1548228',
  g: 'MAEU8001232',
  h: 'TCNU1122333',
} as const;
