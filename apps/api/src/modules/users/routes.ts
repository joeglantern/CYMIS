import {
  CreateUserBody,
  EndedSessionsResponse,
  IdParams,
  ResetPasswordBody,
  UpdateUserBody,
  UserDto,
  UserListQuery,
  paged,
} from '@cymis/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { STAFF_ROLES, requireUser } from '../../plugins/auth.js';
import { endAllSessionsFor } from '../auth/sessions.js';
import { createUser, getUser, listUsers, resetPassword, unlockUser, updateUser } from './service.js';

export const userRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  const adminOnly = app.guard({ roles: ['ADMIN'] });
  const actor = (request: Parameters<typeof requireUser>[0]) => ({ id: requireUser(request).id, ip: request.ip ?? null });

  // Supervisors can list people so they can assign crew to audits.
  app.get(
    '/',
    {
      schema: { tags: ['users'], querystring: UserListQuery, response: { 200: paged(UserDto) } },
      preHandler: app.guard({ roles: STAFF_ROLES }),
    },
    async (request) => listUsers(ctx, request.query),
  );

  app.get(
    '/:id',
    { schema: { tags: ['users'], params: IdParams, response: { 200: UserDto } }, preHandler: app.guard({ roles: STAFF_ROLES }) },
    async (request) => getUser(ctx, request.params.id),
  );

  app.post(
    '/',
    { schema: { tags: ['users'], body: CreateUserBody, response: { 201: UserDto } }, preHandler: adminOnly },
    async (request, reply) => {
      reply.status(201);
      return createUser(ctx, request.body, actor(request));
    },
  );

  app.patch(
    '/:id',
    { schema: { tags: ['users'], params: IdParams, body: UpdateUserBody, response: { 200: UserDto } }, preHandler: adminOnly },
    async (request) => updateUser(ctx, request.params.id, request.body, actor(request)),
  );

  app.post(
    '/:id/reset-password',
    {
      schema: { tags: ['users'], params: IdParams, body: ResetPasswordBody, response: { 200: UserDto } },
      preHandler: adminOnly,
    },
    async (request) => resetPassword(ctx, request.params.id, request.body, actor(request)),
  );

  app.post(
    '/:id/unlock',
    { schema: { tags: ['users'], params: IdParams, response: { 200: UserDto } }, preHandler: adminOnly },
    async (request) => unlockUser(ctx, request.params.id, actor(request)),
  );

  // Lost or stolen phone: every device this person is signed in on stops working now.
  app.post(
    '/:id/sign-out-everywhere',
    { schema: { tags: ['users'], params: IdParams, response: { 200: EndedSessionsResponse } }, preHandler: adminOnly },
    async (request) => {
      const by = actor(request);
      await getUser(ctx, request.params.id);
      return { ended: await endAllSessionsFor(ctx, by.id, request.params.id, by.ip) };
    },
  );
};
