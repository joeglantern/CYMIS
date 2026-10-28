import {
  AuthResponse,
  ChangePasswordBody,
  EndedSessionsResponse,
  IdParams,
  LoginBody,
  LogoutBody,
  Me,
  OkResponse,
  RefreshBody,
  SessionsResponse,
  type ClientKind,
} from '@cymis/schemas';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { sha256Hex } from '../../lib/crypto.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { requireUser } from '../../plugins/auth.js';
import {
  changePassword,
  login,
  logout,
  passwordVersion,
  refresh,
  toMe,
  type IssuedTokens,
  type SignAccess,
} from './service.js';
import { endOtherSessions, endSession, listSessions } from './sessions.js';

export const REFRESH_COOKIE = 'cymis_rt';
const COOKIE_PATH = '/api/v1/auth';

export const authRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  const sign: SignAccess = (user, sessionId) => {
    const token = app.jwt.sign({ sub: user.id, typ: 'access', pv: passwordVersion(user.passwordChangedAt), fam: sessionId });
    return { token, expiresAt: new Date(Date.now() + ctx.env.ACCESS_TOKEN_TTL_SECONDS * 1000) };
  };

  function sendTokens(reply: FastifyReply, client: ClientKind, issued: IssuedTokens) {
    if (client === 'web') {
      reply.setCookie(REFRESH_COOKIE, issued.refreshToken, {
        httpOnly: true,
        secure: ctx.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: COOKIE_PATH,
        expires: issued.refreshExpiresAt,
      });
    }
    return issued.response;
  }

  function tokenFrom(request: FastifyRequest, bodyToken: string | undefined): { token?: string; client: ClientKind } {
    if (bodyToken) return { token: bodyToken, client: 'mobile' };
    const cookie = request.cookies[REFRESH_COOKIE];
    return { token: cookie, client: 'web' };
  }

  const meta = (request: FastifyRequest) => ({ ip: request.ip ?? null });

  // A whole shift often signs in from one yard Wi-Fi address at the same
  // minute, so the sign in limit counts tries per person on that address, not
  // per address. Guessing one account is still stopped by the lockout after 5
  // wrong tries, and the global limit still caps a single address overall.
  // These run after the body is parsed so the staff ID and token are known.
  const loginKey = (request: FastifyRequest) => {
    const staffId = String((request.body as { staffId?: unknown } | undefined)?.staffId ?? '')
      .trim()
      .toUpperCase()
      .slice(0, 32);
    return `login:${request.ip}:${staffId}`;
  };
  const refreshKey = (request: FastifyRequest) => {
    const token = (request.body as { refreshToken?: unknown } | undefined)?.refreshToken ?? request.cookies[REFRESH_COOKIE] ?? '';
    return `refresh:${request.ip}:${sha256Hex(String(token)).slice(0, 24)}`;
  };

  app.post(
    '/login',
    {
      schema: { tags: ['auth'], body: LoginBody, response: { 200: AuthResponse } },
      config: { rateLimit: { max: 10, timeWindow: '1 minute', hook: 'preHandler', keyGenerator: loginKey } },
    },
    async (request, reply) => {
      const issued = await login(ctx, sign, request.body, meta(request));
      return sendTokens(reply, request.body.client, issued);
    },
  );

  app.post(
    '/refresh',
    {
      schema: { tags: ['auth'], body: RefreshBody.nullish(), response: { 200: AuthResponse } },
      config: { rateLimit: { max: 30, timeWindow: '1 minute', hook: 'preHandler', keyGenerator: refreshKey } },
    },
    async (request, reply) => {
      const { token, client } = tokenFrom(request, request.body?.refreshToken);
      if (!token) throw new UnauthorizedError();
      const issued = await refresh(ctx, sign, token, client, meta(request));
      return sendTokens(reply, client, issued);
    },
  );

  app.post(
    '/logout',
    { schema: { tags: ['auth'], body: LogoutBody.nullish(), response: { 200: OkResponse } } },
    async (request, reply) => {
      const { token } = tokenFrom(request, request.body?.refreshToken);
      await logout(ctx, token, meta(request));
      reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
      return { ok: true as const };
    },
  );

  app.get(
    '/me',
    {
      schema: { tags: ['auth'], response: { 200: Me } },
      preHandler: app.guard({ roles: 'any', allowPasswordChange: true }),
    },
    async (request) => toMe(requireUser(request)),
  );

  app.post(
    '/change-password',
    {
      schema: { tags: ['auth'], body: ChangePasswordBody, response: { 200: AuthResponse } },
      preHandler: app.guard({ roles: 'any', allowPasswordChange: true }),
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const user = requireUser(request);
      const issued = await changePassword(ctx, sign, user.id, request.body, meta(request));
      return sendTokens(reply, request.body.client, issued);
    },
  );

  // Signed in devices. Lets someone sign out a phone they lost or handed back.
  app.get(
    '/sessions',
    { schema: { tags: ['auth'], response: { 200: SessionsResponse } }, preHandler: app.guard({ roles: 'any', allowPasswordChange: true }) },
    async (request) => {
      const user = requireUser(request);
      const sessionId = request.principal?.kind === 'user' ? request.principal.sessionId : undefined;
      return { sessions: await listSessions(ctx, user.id, sessionId) };
    },
  );

  app.delete(
    '/sessions/:id',
    {
      schema: { tags: ['auth'], params: IdParams, response: { 200: OkResponse } },
      preHandler: app.guard({ roles: 'any' }),
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request) => {
      await endSession(ctx, requireUser(request).id, request.params.id, request.ip ?? null);
      return { ok: true as const };
    },
  );

  app.post(
    '/sessions/end-others',
    {
      schema: { tags: ['auth'], response: { 200: EndedSessionsResponse } },
      preHandler: app.guard({ roles: 'any' }),
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request) => {
      const keep = request.principal?.kind === 'user' ? request.principal.sessionId : undefined;
      return { ended: await endOtherSessions(ctx, requireUser(request).id, keep, request.ip ?? null) };
    },
  );
};
