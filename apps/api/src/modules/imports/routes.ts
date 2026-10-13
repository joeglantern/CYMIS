import {
  ColumnMappingDto,
  IdParams,
  ImportDto,
  PushExpectedBody,
  SetMappingBody,
  UploadImportQuery,
} from '@cymis/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { BadRequestError } from '../../lib/errors.js';
import { STAFF_ROLES, requireUser } from '../../plugins/auth.js';
import { loadAuditFor } from '../audits/access.js';
import { getImport, listImportsForAudit, listMappings, pushExpected, requestCommit, setMapping, uploadImport } from './service.js';

export const importRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  const staff = app.guard({ roles: STAFF_ROLES });
  const actor = (request: Parameters<typeof requireUser>[0]) => ({ id: requireUser(request).id, ip: request.ip ?? null });

  app.post(
    '/imports',
    {
      schema: { tags: ['imports'], querystring: UploadImportQuery, response: { 202: ImportDto } },
      preHandler: staff,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const file = await request.file({ limits: { fileSize: ctx.env.IMPORT_MAX_BYTES, files: 1, fields: 5, parts: 6 } });
      if (!file) throw new BadRequestError('Attach a file in the "file" field', 'no_file');
      const buffer = await file.toBuffer();
      if (buffer.length === 0) throw new BadRequestError('The file is empty', 'empty_file');
      reply.status(202);
      return uploadImport(ctx, { auditId: request.query.auditId, fileName: file.filename, buffer }, actor(request));
    },
  );

  app.get(
    '/imports/:id',
    { schema: { tags: ['imports'], params: IdParams, response: { 200: ImportDto } }, preHandler: staff },
    async (request) => getImport(ctx, request.params.id),
  );

  app.get(
    '/audits/:id/imports',
    { schema: { tags: ['imports'], params: IdParams, response: { 200: z.array(ImportDto) } }, preHandler: staff },
    async (request) => listImportsForAudit(ctx, request.params.id),
  );

  app.post(
    '/imports/:id/mapping',
    {
      schema: { tags: ['imports'], params: IdParams, body: SetMappingBody, response: { 202: ImportDto } },
      preHandler: staff,
    },
    async (request, reply) => {
      reply.status(202);
      return setMapping(ctx, request.params.id, request.body, actor(request));
    },
  );

  app.post(
    '/imports/:id/commit',
    { schema: { tags: ['imports'], params: IdParams, response: { 202: ImportDto } }, preHandler: staff },
    async (request, reply) => {
      reply.status(202);
      return requestCommit(ctx, request.params.id, actor(request));
    },
  );

  app.get(
    '/column-mappings',
    { schema: { tags: ['imports'], response: { 200: z.array(ColumnMappingDto) } }, preHandler: staff },
    async () => listMappings(ctx),
  );

  // System to system: push an expected list as JSON.
  app.post(
    '/audits/:id/expected',
    {
      schema: { tags: ['integration'], params: IdParams, body: PushExpectedBody, response: { 200: ImportDto } },
      preHandler: app.guard({ roles: STAFF_ROLES, scopes: ['expected:write'] }),
      bodyLimit: 16 * 1024 * 1024,
    },
    async (request) => {
      await loadAuditFor(ctx, request.params.id, request.principal, { scopes: ['expected:write'] });
      const p = request.principal!;
      return pushExpected(ctx, request.params.id, request.body, {
        userId: p.kind === 'user' ? p.user.id : null,
        serviceName: p.kind === 'service' ? p.account.name : null,
        ip: request.ip ?? null,
      });
    },
  );
};
