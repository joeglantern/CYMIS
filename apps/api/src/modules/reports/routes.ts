import { CreateReportBody, IdParams, ReportDto } from '@cymis/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import type { Prisma } from '../../infra/db.js';
import { logActivity } from '../../lib/activity.js';
import { toReportDto } from '../../lib/dto.js';
import { NotFoundError } from '../../lib/errors.js';
import { STAFF_ROLES, requireUser } from '../../plugins/auth.js';
import { reportFileName } from './build.js';

const DOWNLOAD_LINK_SECONDS = 10 * 60;

export const reportRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  const staff = app.guard({ roles: STAFF_ROLES });

  async function withLink(r: Prisma.ReportGetPayload<{ include: { audit: { select: { name: true } } } }>) {
    const url =
      r.status === 'READY' && r.storageKey
        ? await ctx.storage.signDownload(r.storageKey, DOWNLOAD_LINK_SECONDS, reportFileName(r.audit.name, r.format))
        : null;
    return toReportDto(r, url);
  }

  app.post(
    '/audits/:id/reports',
    {
      schema: { tags: ['reports'], params: IdParams, body: CreateReportBody, response: { 202: ReportDto } },
      preHandler: staff,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const user = requireUser(request);
      const audit = await ctx.db.audit.findUnique({ where: { id: request.params.id }, select: { id: true } });
      if (!audit) throw new NotFoundError('Audit');
      const report = await ctx.db.report.create({
        data: { auditId: audit.id, format: request.body.format, createdById: user.id },
        include: { audit: { select: { name: true } } },
      });
      await logActivity(ctx.db, {
        actorId: user.id,
        action: 'report.requested',
        entityType: 'report',
        entityId: report.id,
        ip: request.ip ?? null,
        data: { auditId: audit.id, format: report.format },
      });
      await ctx.queues.addReport({ reportId: report.id });
      reply.status(202);
      return withLink(report);
    },
  );

  app.get(
    '/audits/:id/reports',
    { schema: { tags: ['reports'], params: IdParams, response: { 200: z.array(ReportDto) } }, preHandler: staff },
    async (request) => {
      const rows = await ctx.db.report.findMany({
        where: { auditId: request.params.id },
        include: { audit: { select: { name: true } } },
        orderBy: { id: 'desc' },
        take: 50,
      });
      return Promise.all(rows.map(withLink));
    },
  );

  app.get(
    '/reports/:id',
    { schema: { tags: ['reports'], params: IdParams, response: { 200: ReportDto } }, preHandler: staff },
    async (request) => {
      const r = await ctx.db.report.findUnique({
        where: { id: request.params.id },
        include: { audit: { select: { name: true } } },
      });
      if (!r) throw new NotFoundError('Report');
      return withLink(r);
    },
  );
};
