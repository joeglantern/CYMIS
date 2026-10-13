import {
  ActivityDto,
  ActivityQuery,
  CreateServiceAccountBody,
  CreateServiceAccountResponse,
  IdParams,
  ServiceAccountDto,
  paged,
} from '@cymis/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import type { Prisma } from '../../infra/db.js';
import { logActivity } from '../../lib/activity.js';
import { randomToken, sha256Hex } from '../../lib/crypto.js';
import { toActivityDto, toServiceAccountDto, userSummarySelect } from '../../lib/dto.js';
import { NotFoundError } from '../../lib/errors.js';
import { decodeCursor, pageOf } from '../../lib/pagination.js';
import { API_KEY_PREFIX, requireUser } from '../../plugins/auth.js';

export const adminRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  const adminOnly = app.guard({ roles: ['ADMIN'] });

  app.get(
    '/service-accounts',
    { schema: { tags: ['admin'], response: { 200: z.array(ServiceAccountDto) } }, preHandler: adminOnly },
    async () => {
      const rows = await ctx.db.serviceAccount.findMany({ orderBy: { id: 'desc' } });
      return rows.map(toServiceAccountDto);
    },
  );

  // The full key is only shown in this response. We keep a hash.
  app.post(
    '/service-accounts',
    {
      schema: { tags: ['admin'], body: CreateServiceAccountBody, response: { 201: CreateServiceAccountResponse } },
      preHandler: adminOnly,
    },
    async (request, reply) => {
      const user = requireUser(request);
      const prefix = randomToken(6).replace(/[-_]/g, 'x').slice(0, 8);
      const apiKey = `${API_KEY_PREFIX}${prefix}_${randomToken(32)}`;
      const account = await ctx.db.serviceAccount.create({
        data: {
          name: request.body.name,
          scopes: [...new Set(request.body.scopes)],
          keyPrefix: `${API_KEY_PREFIX}${prefix}`,
          keyHash: sha256Hex(apiKey),
          createdById: user.id,
        },
      });
      await logActivity(ctx.db, {
        actorId: user.id,
        action: 'service_account.created',
        entityType: 'service_account',
        entityId: account.id,
        ip: request.ip ?? null,
        data: { name: account.name, scopes: account.scopes },
      });
      reply.status(201);
      return { account: toServiceAccountDto(account), apiKey };
    },
  );

  app.post(
    '/service-accounts/:id/revoke',
    { schema: { tags: ['admin'], params: IdParams, response: { 200: ServiceAccountDto } }, preHandler: adminOnly },
    async (request) => {
      const user = requireUser(request);
      const found = await ctx.db.serviceAccount.findUnique({ where: { id: request.params.id } });
      if (!found) throw new NotFoundError('Service account');
      const account = await ctx.db.serviceAccount.update({
        where: { id: found.id },
        data: { revokedAt: found.revokedAt ?? new Date() },
      });
      await logActivity(ctx.db, {
        actorId: user.id,
        action: 'service_account.revoked',
        entityType: 'service_account',
        entityId: account.id,
        ip: request.ip ?? null,
      });
      return toServiceAccountDto(account);
    },
  );

  app.get(
    '/activity',
    { schema: { tags: ['admin'], querystring: ActivityQuery, response: { 200: paged(ActivityDto) } }, preHandler: adminOnly },
    async (request) => {
      const q = request.query;
      const cursor = decodeCursor(q.cursor);
      const where: Prisma.ActivityLogWhereInput = {
        ...(q.actorId ? { actorId: q.actorId } : {}),
        ...(q.entityType ? { entityType: q.entityType } : {}),
        ...(q.entityId ? { entityId: q.entityId } : {}),
      };
      const rows = await ctx.db.activityLog.findMany({
        where,
        include: { actor: { select: userSummarySelect } },
        orderBy: { id: 'desc' },
        take: q.limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const page = pageOf(rows, q.limit);
      return { items: page.items.map(toActivityDto), nextCursor: page.nextCursor };
    },
  );
};
