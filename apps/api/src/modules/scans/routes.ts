import {
  IdParams,
  ReviewScanBody,
  ScanDto,
  ScanListQuery,
  SyncScansBody,
  SyncScansResponse,
  paged,
} from '@cymis/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { ALL_ROLES, STAFF_ROLES, requireUser } from '../../plugins/auth.js';
import { getScan, listScans, reviewScan, syncScans } from './service.js';

export const scanRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  const crew = app.guard({ roles: ALL_ROLES });
  const readers = app.guard({ roles: ALL_ROLES, scopes: ['results:read'] });

  app.post(
    '/sync/scans',
    {
      schema: { tags: ['scans'], body: SyncScansBody, response: { 200: SyncScansResponse } },
      preHandler: crew,
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      bodyLimit: 1024 * 1024,
    },
    async (request) => syncScans(ctx, requireUser(request), request.body.scans),
  );

  app.get(
    '/audits/:id/scans',
    {
      schema: { tags: ['scans'], params: IdParams, querystring: ScanListQuery, response: { 200: paged(ScanDto) } },
      preHandler: readers,
    },
    async (request) => listScans(ctx, request.principal!, request.params.id, request.query),
  );

  app.get(
    '/scans/:id',
    { schema: { tags: ['scans'], params: IdParams, response: { 200: ScanDto } }, preHandler: readers },
    async (request) => getScan(ctx, request.principal!, request.params.id),
  );

  app.post(
    '/scans/:id/review',
    {
      schema: { tags: ['scans'], params: IdParams, body: ReviewScanBody, response: { 200: ScanDto } },
      preHandler: app.guard({ roles: STAFF_ROLES }),
    },
    async (request) => reviewScan(ctx, requireUser(request), request.params.id, request.body, request.ip ?? null),
  );
};
