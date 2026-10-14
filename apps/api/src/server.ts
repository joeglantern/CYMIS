import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { closeContext, createContext } from './context.js';
import { startWorkers, type Workers } from './jobs/index.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const ctx = createContext(env);
  if (env.NODE_ENV !== 'production') await ctx.storage.ensureBucket();

  const app = await buildApp(ctx);
  let workers: Workers | null = null;
  if (env.WORKERS_IN_PROCESS) workers = await startWorkers(ctx, app.log);

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    app.log.info({ signal }, 'shutting down');
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    try {
      await app.close();
      await workers?.stop();
      await closeContext(ctx);
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'shutdown failed');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
