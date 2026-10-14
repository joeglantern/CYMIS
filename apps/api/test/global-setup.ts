// Starts real Postgres, Redis and S3 (SeaweedFS) containers once for the whole
// integration run, applies the migrations, and hands the addresses to tests.

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { execFileSync } from 'node:child_process';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import type { TestProject } from 'vitest/node';

export interface TestInfra {
  databaseUrl: string;
  redisUrl: string;
  s3Endpoint: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    infra: TestInfra;
  }
}

const S3_CONFIG = JSON.stringify({
  identities: [
    {
      name: 'test',
      credentials: [{ accessKey: 'test_access', secretKey: 'test_secret_key_123' }],
      actions: ['Admin', 'Read', 'Write', 'List', 'Tagging'],
    },
  ],
});

let pg: StartedPostgreSqlContainer | undefined;
let redis: StartedRedisContainer | undefined;
let s3: StartedTestContainer | undefined;

export async function setup(project: TestProject): Promise<void> {
  [pg, redis, s3] = await Promise.all([
    new PostgreSqlContainer('postgres:17-alpine').withDatabase('cymis_test').start(),
    new RedisContainer('redis:8-alpine').start(),
    new GenericContainer('chrislusf/seaweedfs:4.48')
      .withCommand(['server', '-dir=/data', '-s3', '-s3.port=8333', '-s3.config=/etc/s3.json', '-ip.bind=0.0.0.0'])
      .withCopyContentToContainer([{ content: S3_CONFIG, target: '/etc/s3.json' }])
      .withExposedPorts(8333)
      .withWaitStrategy(Wait.forListeningPorts())
      .start(),
  ]);

  const databaseUrl = pg.getConnectionUri();
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });

  project.provide('infra', {
    databaseUrl,
    redisUrl: redis.getConnectionUrl(),
    s3Endpoint: `http://${s3.getHost()}:${s3.getMappedPort(8333)}`,
  });
}

export async function teardown(): Promise<void> {
  await Promise.all([pg?.stop(), redis?.stop(), s3?.stop()]);
}
