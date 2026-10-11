import {
  CreateFacilityBody,
  CreateSectionBody,
  FacilityDto,
  IdParams,
  SectionDto,
  UpdateFacilityBody,
  UpdateSectionBody,
} from '@cymis/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { requireUser } from '../../plugins/auth.js';
import { createFacility, createSection, listFacilities, updateFacility, updateSection } from './service.js';

export const facilityRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  const adminOnly = app.guard({ roles: ['ADMIN'] });
  const actor = (request: Parameters<typeof requireUser>[0]) => ({ id: requireUser(request).id, ip: request.ip ?? null });

  app.get(
    '/facilities',
    {
      schema: {
        tags: ['facilities'],
        querystring: z.object({ includeInactive: z.enum(['true', 'false']).optional() }),
        response: { 200: z.array(FacilityDto) },
      },
      preHandler: app.guard({ roles: 'any' }),
    },
    async (request) => {
      const principal = requireUser(request);
      // Only admins see switched off facilities.
      const includeInactive = request.query.includeInactive === 'true' && principal.role === 'ADMIN';
      return listFacilities(ctx, includeInactive);
    },
  );

  app.post(
    '/facilities',
    { schema: { tags: ['facilities'], body: CreateFacilityBody, response: { 201: FacilityDto } }, preHandler: adminOnly },
    async (request, reply) => {
      reply.status(201);
      return createFacility(ctx, request.body, actor(request));
    },
  );

  app.patch(
    '/facilities/:id',
    {
      schema: { tags: ['facilities'], params: IdParams, body: UpdateFacilityBody, response: { 200: FacilityDto } },
      preHandler: adminOnly,
    },
    async (request) => updateFacility(ctx, request.params.id, request.body, actor(request)),
  );

  app.post(
    '/sections',
    { schema: { tags: ['facilities'], body: CreateSectionBody, response: { 201: SectionDto } }, preHandler: adminOnly },
    async (request, reply) => {
      reply.status(201);
      return createSection(ctx, request.body, actor(request));
    },
  );

  app.patch(
    '/sections/:id',
    {
      schema: { tags: ['facilities'], params: IdParams, body: UpdateSectionBody, response: { 200: SectionDto } },
      preHandler: adminOnly,
    },
    async (request) => updateSection(ctx, request.params.id, request.body, actor(request)),
  );
};
