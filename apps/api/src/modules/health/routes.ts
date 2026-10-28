import { readFileSync } from 'node:fs';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';

const Check = z.object({ ok: z.boolean(), checks: z.record(z.string(), z.boolean()).optional() });
const Live = z.object({ ok: z.boolean(), version: z.string(), commit: z.string(), uptimeSeconds: z.number() });

// Same path from src and from dist.
const version = (JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as { version: string }).version;

export const healthRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  // Is the process up, and which build is it. Used by Docker to restart a
  // stuck container, and by people to see what is actually deployed.
  app.get('/live', { schema: { tags: ['health'], response: { 200: Live } }, config: { rateLimit: false } }, async () => ({
    ok: true,
    version,
    commit: ctx.env.GIT_COMMIT,
    uptimeSeconds: Math.round(process.uptime()),
  }));

  // Can it do work. Used by the proxy before sending traffic.
  app.get(
    '/ready',
    { schema: { tags: ['health'], response: { 200: Check, 503: Check } }, config: { rateLimit: false } },
    async (_request, reply) => {
      const timed = <T>(p: Promise<T>) =>
        Promise.race([p.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 2_000))]).catch(
          () => false,
        );
      const [db, redis, storage] = await Promise.all([
        timed(ctx.db.$queryRaw`SELECT 1`),
        timed(ctx.redis.ping()),
        timed(ctx.storage.ping()),
      ]);
      const ok = db && redis && storage;
      reply.status(ok ? 200 : 503);
      return { ok, checks: { db, redis, storage } };
    },
  );
};
