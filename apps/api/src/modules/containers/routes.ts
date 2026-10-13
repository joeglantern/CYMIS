import { ContainerJourneyResponse, ContainerParams, CursorQuery } from '@cymis/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { eventInclude, toEventDto } from '../../lib/dto.js';
import { BadRequestError } from '../../lib/errors.js';
import { decodeCursor, pageOf } from '../../lib/pagination.js';
import { STAFF_ROLES } from '../../plugins/auth.js';

export const containerRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  // Where has this box been seen, by whom, and when. Newest first.
  app.get(
    '/:number/events',
    {
      schema: {
        tags: ['containers'],
        params: ContainerParams,
        querystring: CursorQuery,
        response: { 200: ContainerJourneyResponse },
      },
      preHandler: app.guard({ roles: STAFF_ROLES, scopes: ['results:read'] }),
    },
    async (request) => {
      const number = request.params.number;
      if (!/^[A-Z]{4}\d{7}$/.test(number)) throw new BadRequestError('Not a container number', 'bad_number');
      const cursor = decodeCursor(request.query.cursor);
      const rows = await ctx.db.containerEvent.findMany({
        where: { containerNumber: number },
        include: eventInclude,
        orderBy: { id: 'desc' },
        take: request.query.limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const page = pageOf(rows, request.query.limit);
      return { containerNumber: number, events: page.items.map(toEventDto), nextCursor: page.nextCursor };
    },
  );
};
