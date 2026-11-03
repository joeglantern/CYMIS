import { CreateShiftBody, IdParams, ShiftDto, ShiftListQuery, ShiftListResponse, UpdateShiftBody } from '@cymis/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { STAFF_ROLES, requireUser } from '../../plugins/auth.js';
import { createShift, deleteShift, listShifts, updateShift } from './service.js';

export const shiftRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  const staff = app.guard({ roles: STAFF_ROLES });
  const actor = (request: Parameters<typeof requireUser>[0]) => ({ id: requireUser(request).id, ip: request.ip ?? null });

  app.get(
    '/',
    { schema: { tags: ['shifts'], querystring: ShiftListQuery, response: { 200: ShiftListResponse } }, preHandler: staff },
    async (request) => listShifts(ctx, request.query),
  );

  app.post(
    '/',
    { schema: { tags: ['shifts'], body: CreateShiftBody, response: { 201: ShiftDto } }, preHandler: staff },
    async (request, reply) => {
      reply.status(201);
      return createShift(ctx, request.body, actor(request));
    },
  );

  app.patch(
    '/:id',
    { schema: { tags: ['shifts'], params: IdParams, body: UpdateShiftBody, response: { 200: ShiftDto } }, preHandler: staff },
    async (request) => updateShift(ctx, request.params.id, request.body, actor(request)),
  );

  app.delete(
    '/:id',
    { schema: { tags: ['shifts'], params: IdParams, response: { 204: z.null() } }, preHandler: staff },
    async (request, reply) => {
      await deleteShift(ctx, request.params.id, actor(request));
      reply.status(204);
      return null;
    },
  );
};
