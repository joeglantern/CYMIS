import {
  AuditCounts,
  AuditDto,
  AuditListQuery,
  CreateAuditBody,
  ExpectedQuery,
  ExpectedResponse,
  IdParams,
  ResultRow,
  ResultsQuery,
  SetAssigneesBody,
  UpdateAuditBody,
  paged,
} from '@cymis/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { ALL_ROLES, STAFF_ROLES, requireUser } from '../../plugins/auth.js';
import { loadAuditFor } from './access.js';
import {
  cancelAudit,
  closeAudit,
  createAudit,
  getAudit,
  getExpected,
  getResultsPage,
  listAudits,
  setAssignees,
  startAudit,
  updateAudit,
} from './service.js';

export const auditRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  const staff = app.guard({ roles: STAFF_ROLES });
  const readers = app.guard({ roles: ALL_ROLES, scopes: ['audits:read', 'results:read'] });
  const actor = (request: Parameters<typeof requireUser>[0]) => ({ id: requireUser(request).id, ip: request.ip ?? null });

  app.get(
    '/',
    { schema: { tags: ['audits'], querystring: AuditListQuery, response: { 200: paged(AuditDto) } }, preHandler: readers },
    async (request) => listAudits(ctx, request.principal!, request.query),
  );

  app.post(
    '/',
    { schema: { tags: ['audits'], body: CreateAuditBody, response: { 201: AuditDto } }, preHandler: staff },
    async (request, reply) => {
      reply.status(201);
      return createAudit(ctx, request.body, actor(request));
    },
  );

  app.get(
    '/:id',
    { schema: { tags: ['audits'], params: IdParams, response: { 200: AuditDto } }, preHandler: readers },
    async (request) => getAudit(ctx, request.principal!, request.params.id),
  );

  app.patch(
    '/:id',
    { schema: { tags: ['audits'], params: IdParams, body: UpdateAuditBody, response: { 200: AuditDto } }, preHandler: staff },
    async (request) => updateAudit(ctx, request.params.id, request.body, actor(request)),
  );

  app.post(
    '/:id/start',
    { schema: { tags: ['audits'], params: IdParams, response: { 200: AuditDto } }, preHandler: staff },
    async (request) => startAudit(ctx, request.params.id, actor(request)),
  );

  app.post(
    '/:id/close',
    { schema: { tags: ['audits'], params: IdParams, response: { 200: AuditDto } }, preHandler: staff },
    async (request) => closeAudit(ctx, request.params.id, actor(request)),
  );

  app.post(
    '/:id/cancel',
    { schema: { tags: ['audits'], params: IdParams, response: { 200: AuditDto } }, preHandler: staff },
    async (request) => cancelAudit(ctx, request.params.id, actor(request)),
  );

  app.put(
    '/:id/assignees',
    {
      schema: { tags: ['audits'], params: IdParams, body: SetAssigneesBody, response: { 200: AuditDto } },
      preHandler: staff,
    },
    async (request) => setAssignees(ctx, request.params.id, request.body, actor(request)),
  );

  app.get(
    '/:id/expected',
    {
      schema: { tags: ['audits'], params: IdParams, querystring: ExpectedQuery, response: { 200: ExpectedResponse } },
      preHandler: readers,
    },
    async (request) => getExpected(ctx, request.principal!, request.params.id, request.query.sinceVersion),
  );

  app.get(
    '/:id/progress',
    { schema: { tags: ['audits'], params: IdParams, response: { 200: AuditCounts } }, preHandler: readers },
    async (request) => {
      await loadAuditFor(ctx, request.params.id, request.principal, { scopes: ['audits:read', 'results:read'] });
      return ctx.progress.get(request.params.id);
    },
  );

  app.get(
    '/:id/results',
    {
      schema: { tags: ['audits'], params: IdParams, querystring: ResultsQuery, response: { 200: paged(ResultRow) } },
      preHandler: app.guard({ roles: STAFF_ROLES, scopes: ['results:read'] }),
    },
    async (request) => {
      await loadAuditFor(ctx, request.params.id, request.principal, { scopes: ['results:read'] });
      return getResultsPage(ctx, request.params.id, request.query.bucket, request.query.cursor, request.query.limit);
    },
  );
};
