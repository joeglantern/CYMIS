import type { Env } from './config/env.js';
import { Broadcaster } from './infra/broadcaster.js';
import { createDb, type Db } from './infra/db.js';
import { PresenceService } from './infra/presence.js';
import { ProgressService } from './infra/progress.js';
import { Queues } from './infra/queues.js';
import { createRedis, type Redis } from './infra/redis.js';
import { Storage } from './infra/storage.js';

/** Everything a service needs, built once per process and passed around. */
export interface AppContext {
  env: Env;
  db: Db;
  redis: Redis;
  storage: Storage;
  queues: Queues;
  broadcaster: Broadcaster;
  progress: ProgressService;
  presence: PresenceService;
}

export function createContext(env: Env): AppContext {
  const db = createDb(env.DATABASE_URL);
  const redis = createRedis(env.REDIS_URL, 'main');
  const storage = new Storage(env);
  const queues = new Queues({ url: env.REDIS_URL, maxRetriesPerRequest: null }, redis);
  const broadcaster = new Broadcaster(redis);
  const progress = new ProgressService(db, redis, broadcaster);
  const presence = new PresenceService(redis, broadcaster);
  return { env, db, redis, storage, queues, broadcaster, progress, presence };
}

export async function closeContext(ctx: AppContext): Promise<void> {
  await ctx.progress.flushAll().catch(() => undefined);
  await ctx.queues.close();
  await ctx.db.$disconnect();
  ctx.storage.destroy();
  await ctx.redis.quit().catch(() => ctx.redis.disconnect());
}
