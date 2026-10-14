import { createAdapter } from '@socket.io/redis-adapter';
import { SOCKET_ERRORS, type ClientToServerEvents, type ServerToClientEvents } from '@cymis/schemas';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { rooms } from '../infra/broadcaster.js';
import { createRedis } from '../infra/redis.js';
import { canSeeAudit } from '../modules/audits/access.js';
import { verifyAccessToken, type UserPrincipal } from './auth.js';

interface SocketData {
  user: UserPrincipal['user'];
  audits: Set<string>;
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type AppIo = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

declare module 'fastify' {
  interface FastifyInstance {
    io: AppIo;
  }
}

const AuditPayload = z.object({ auditId: z.uuid() });

/**
 * Socket.IO on the same port as the API. Clients send their access token in
 * the handshake `auth` field (never the URL). Sockets only receive broadcasts
 * and join rooms; scans travel over REST.
 */
export const realtimePlugin = fp<{ ctx: AppContext }>(
  async (app: FastifyInstance, { ctx }) => {
    const pub = createRedis(ctx.env.REDIS_URL, 'io-pub');
    const sub = createRedis(ctx.env.REDIS_URL, 'io-sub');

    const io: AppIo = new Server(app.server, {
      path: '/socket.io',
      serveClient: false,
      transports: ['websocket', 'polling'],
      cors: { origin: ctx.env.CORS_ORIGINS, credentials: true },
      // No session recovery: the Redis adapter cannot replay missed events.
      // On reconnect, clients rejoin and the join reply carries fresh counts
      // and the list version, so they catch up from there.
      pingInterval: 25_000,
      pingTimeout: 20_000,
      maxHttpBufferSize: 16 * 1024,
      adapter: createAdapter(pub, sub),
    });

    io.use(async (socket, next) => {
      const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof token !== 'string' || token.length === 0) return next(new Error(SOCKET_ERRORS.unauthorized));
      try {
        const { user, expiresAt } = await verifyAccessToken(app, ctx, token);
        if (user.mustChangePassword) return next(new Error(SOCKET_ERRORS.unauthorized));
        socket.data.user = user;
        socket.data.audits = new Set();
        // Drop the socket when the token runs out. The app refreshes and reconnects.
        const ms = Math.max(1_000, expiresAt - Date.now());
        const timer = setTimeout(() => socket.disconnect(true), Math.min(ms, 2 ** 31 - 1));
        timer.unref();
        socket.once('disconnect', () => clearTimeout(timer));
        next();
      } catch (err) {
        const code = (err as { code?: string }).code;
        next(new Error(code === 'token_expired' ? SOCKET_ERRORS.tokenExpired : SOCKET_ERRORS.unauthorized));
      }
    });

    io.on('connection', (socket: AppSocket) => {
      const user = socket.data.user;
      void socket.join(rooms.user(user.id));
      if (user.role !== 'AUDITOR') void socket.join(rooms.supervisors);

      socket.on('audit:join', async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => undefined;
        const parsed = AuditPayload.safeParse(payload);
        if (!parsed.success) return reply({ ok: false, error: 'bad_request' });
        const { auditId } = parsed.data;
        try {
          const audit = await ctx.db.audit.findUnique({ where: { id: auditId }, select: { listVersion: true } });
          if (!audit || !(await canSeeAudit(ctx, auditId, { kind: 'user', user }))) {
            return reply({ ok: false, error: 'not_found' });
          }
          await socket.join(rooms.audit(auditId));
          socket.data.audits.add(auditId);
          await ctx.presence.touch(auditId, user);
          reply({
            ok: true,
            auditId,
            counts: await ctx.progress.get(auditId),
            listVersion: audit.listVersion,
            present: await ctx.presence.list(auditId),
          });
        } catch (err) {
          app.log.error({ err }, 'audit:join failed');
          reply({ ok: false, error: 'server_error' });
        }
      });

      socket.on('audit:leave', async (payload) => {
        const parsed = AuditPayload.safeParse(payload);
        if (!parsed.success) return;
        await socket.leave(rooms.audit(parsed.data.auditId));
        socket.data.audits.delete(parsed.data.auditId);
        await ctx.presence.leave(parsed.data.auditId, user.id).catch(() => undefined);
      });

      socket.on('presence:heartbeat', async (payload) => {
        const parsed = AuditPayload.safeParse(payload);
        if (!parsed.success || !socket.data.audits.has(parsed.data.auditId)) return;
        await ctx.presence.touch(parsed.data.auditId, user).catch(() => undefined);
      });
    });

    app.decorate('io', io);

    app.addHook('onClose', async () => {
      await io.close();
      // quit() waits for replies still in flight; disconnect() would drop them.
      await Promise.allSettled([pub.quit(), sub.quit()]);
    });
  },
  { name: 'realtime', dependencies: ['auth'] },
);
