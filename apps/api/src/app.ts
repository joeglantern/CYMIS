import fastifyCompress from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import type { AppContext } from './context.js';
import { sha256Hex } from './lib/crypto.js';
import { newId } from './lib/ids.js';
import { loggerOptions } from './lib/logger.js';
import { appRoutes } from './modules/app/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { auditRoutes } from './modules/audits/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { containerRoutes } from './modules/containers/routes.js';
import { facilityRoutes } from './modules/facilities/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { importRoutes } from './modules/imports/routes.js';
import { photoRoutes } from './modules/photos/routes.js';
import { reportRoutes } from './modules/reports/routes.js';
import { scanRoutes } from './modules/scans/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { authPlugin } from './plugins/auth.js';
import { errorsPlugin } from './plugins/errors.js';
import { realtimePlugin } from './plugins/realtime.js';

export const API_PREFIX = '/api/v1';

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const { env } = ctx;
  const docs = env.NODE_ENV !== 'production';

  const app = Fastify({
    logger: loggerOptions(env),
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 1024 * 1024,
    requestIdHeader: 'x-request-id',
    genReqId: () => newId(),
    // Keep the shapes strict: unknown query keys are ignored by zod, not by Ajv coercion.
    ajv: { customOptions: { coerceTypes: false } },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(errorsPlugin);
  await app.register(fastifyHelmet, {
    // The API only serves JSON. The docs page needs inline scripts, so CSP is off when docs are on.
    contentSecurityPolicy: docs ? false : { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(fastifyCors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    maxAge: 600,
  });
  await app.register(fastifyCookie, { secret: env.COOKIE_SECRET });
  await app.register(fastifyCompress, { threshold: 1024 });
  await app.register(fastifyRateLimit, {
    global: true,
    max: 600,
    timeWindow: '1 minute',
    redis: ctx.redis,
    nameSpace: 'cymis:rl:',
    // Many phones share one yard Wi-Fi address, so signed in callers are
    // counted by token, not by IP.
    keyGenerator: (request) => {
      const auth = request.headers.authorization;
      return auth ? `t:${sha256Hex(auth).slice(0, 24)}` : `ip:${request.ip}`;
    },
  });
  await app.register(fastifyMultipart, {
    limits: { fileSize: env.IMPORT_MAX_BYTES, files: 1, fields: 5, parts: 6, headerPairs: 200 },
  });

  if (docs) {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Cymis API',
          version: '1.0.0',
          description: 'Container audit API. Every route needs a bearer token unless marked otherwise.',
        },
        components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
        security: [{ bearer: [] }],
      },
      transform: jsonSchemaTransform,
    });
    await app.register(fastifySwaggerUi, { routePrefix: '/docs' });
  }

  await app.register(authPlugin, { ctx });
  await app.register(realtimePlugin, { ctx });

  await app.register(healthRoutes, { prefix: '/health', ctx });
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth', ctx });
      await api.register(userRoutes, { prefix: '/users', ctx });
      await api.register(facilityRoutes, { ctx });
      await api.register(auditRoutes, { prefix: '/audits', ctx });
      await api.register(importRoutes, { ctx });
      await api.register(scanRoutes, { ctx });
      await api.register(photoRoutes, { prefix: '/photos', ctx });
      await api.register(containerRoutes, { prefix: '/containers', ctx });
      await api.register(reportRoutes, { ctx });
      await api.register(adminRoutes, { prefix: '/admin', ctx });
      await api.register(appRoutes, { ctx });
    },
    { prefix: API_PREFIX },
  );

  return app;
}
