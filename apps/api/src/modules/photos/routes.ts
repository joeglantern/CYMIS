import { IdParams, PhotoUrlResponse, PresignPhotoBody, PresignPhotoResponse, ScanDto } from '@cymis/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { ALL_ROLES, requireUser } from '../../plugins/auth.js';
import { completePhoto, photoUrl, presignPhoto } from './service.js';

export const photoRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  const crew = app.guard({ roles: ALL_ROLES });

  app.post(
    '/presign',
    {
      schema: { tags: ['photos'], body: PresignPhotoBody, response: { 200: PresignPhotoResponse } },
      preHandler: crew,
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (request) => presignPhoto(ctx, requireUser(request), request.body),
  );

  app.post(
    '/:id/complete',
    { schema: { tags: ['photos'], params: IdParams, response: { 200: ScanDto } }, preHandler: crew },
    async (request) => completePhoto(ctx, requireUser(request), request.params.id),
  );

  app.get(
    '/:id/url',
    {
      schema: {
        tags: ['photos'],
        params: IdParams,
        querystring: z.object({ thumb: z.enum(['true', 'false']).optional() }),
        response: { 200: PhotoUrlResponse },
      },
      preHandler: app.guard({ roles: ALL_ROLES, scopes: ['results:read'] }),
    },
    async (request) => photoUrl(ctx, request.principal!, request.params.id, request.query.thumb === 'true'),
  );
};
