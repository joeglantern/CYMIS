// Background worker process: imports, reports and CV results. In production
// this runs in its own container so heavy files never slow the API down.

import pino from 'pino';
import { loadEnv } from './config/env.js';
import { closeContext, createContext } from './context.js';
import { startWorkers } from './jobs/index.js';
import { loggerOptions } from './lib/logger.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const log = pino(loggerOptions(env));
  const ctx = createContext(env);
  const workers = await startWorkers(ctx, log);

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info({ signal }, 'worker shutting down');
    const force = setTimeout(() => process.exit(1), 30_000);
    force.unref();
    await workers.stop();
    await closeContext(ctx);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
