import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';

const Check = z.object({ ok: z.boolean(), checks: z.record(z.string(), z.boolean()).optional() });

export const healthRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  // Is the process up. Used by Docker to restart a stuck container.
  app.get('/live', { schema: { tags: ['health'], response: { 200: Check } }, config: { rateLimit: false } }, async () => ({
    ok: true,
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
