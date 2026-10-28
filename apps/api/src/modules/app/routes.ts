import { AppConfigResponse, ClientErrorBody, OkResponse } from '@cymis/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';

export const appRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  const off = ctx.env.FEATURES_OFF.split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  // Read by every app on launch, before sign in. Lets us block a broken old
  // version, nudge people to update, or switch a feature off without a release.
  app.get('/app-config', { schema: { tags: ['app'], response: { 200: AppConfigResponse } } }, async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=60');
    return {
      minVersion: ctx.env.APP_MIN_VERSION,
      latestVersion: ctx.env.APP_LATEST_VERSION,
      features: Object.fromEntries(off.map((f) => [f, false])),
      notice: ctx.env.APP_NOTICE || null,
      environment: ctx.env.APP_ENVIRONMENT ?? (ctx.env.NODE_ENV === 'production' ? 'production' : 'development'),
    };
  });

  // Crash reports from the apps. They land in the server log with the build,
  // so a crash on a crew phone is seen before anyone calls about it.
  app.post(
    '/client-errors',
    {
      schema: { tags: ['app'], body: ClientErrorBody, response: { 200: OkResponse } },
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request) => {
      request.log.warn({ clientError: request.body, ip: request.ip }, 'app crash report');
      return { ok: true as const };
    },
  );
};
