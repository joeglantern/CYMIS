import fastifyJwt from '@fastify/jwt';
import type { ApiScope, Role } from '@cymis/schemas';
import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import type { AppContext } from '../context.js';
import { sha256Hex } from '../lib/crypto.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

export interface UserPrincipal {
  kind: 'user';
  user: { id: string; staffId: string; fullName: string; role: Role; mustChangePassword: boolean };
  /** The sign in this token came from. Missing on tokens issued before sessions existed. */
  sessionId?: string;
}

export interface ServicePrincipal {
  kind: 'service';
  account: { id: string; name: string; scopes: ApiScope[] };
}

export type Principal = UserPrincipal | ServicePrincipal;

export interface AccessTokenPayload {
  sub: string;
  typ: 'access';
  /** Password version. A token stops working the moment the password changes. */
  pv: number;
  /** Session (refresh token family). Signing a device out stops its tokens at once. */
  fam?: string;
}

/** Redis key that marks a signed out session until its last access token has expired. */
export const revokedSessionKey = (sessionId: string) => `revoked-session:${sessionId}`;

declare module 'fastify' {
  interface FastifyRequest {
    principal: Principal | null;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload & { iat: number; exp: number };
  }
}

export const API_KEY_PREFIX = 'cym_';
const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;

export interface GuardOptions {
  /** Roles allowed. 'any' means any signed in person. Leave out to block people (service only route). */
  roles?: readonly Role[] | 'any';
  /** API key scopes allowed. Leave out to block service accounts. */
  scopes?: readonly ApiScope[];
  /** Allow the route even if the person still has to change their password. */
  allowPasswordChange?: boolean;
}

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

async function authenticateUser(app: FastifyInstance, ctx: AppContext, token: string): Promise<UserPrincipal> {
  let payload: AccessTokenPayload & { iat: number };
  try {
    payload = app.jwt.verify<AccessTokenPayload & { iat: number }>(token);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'FAST_JWT_EXPIRED') throw new UnauthorizedError('Your session has expired', 'token_expired');
    throw new UnauthorizedError();
  }
  if (payload.typ !== 'access') throw new UnauthorizedError();
  if (payload.fam && (await ctx.redis.exists(revokedSessionKey(payload.fam)))) {
    throw new UnauthorizedError('This device was signed out. Sign in again', 'session_revoked');
  }

  const user = await ctx.db.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      staffId: true,
      fullName: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      passwordChangedAt: true,
    },
  });
  if (!user || !user.isActive) throw new UnauthorizedError();
  // Tokens issued before the last password change stop working.
  const currentVersion = user.passwordChangedAt ? user.passwordChangedAt.getTime() : 0;
  if (payload.pv !== currentVersion) {
    throw new UnauthorizedError('Your password was changed. Please sign in again', 'password_changed');
  }
  return {
    kind: 'user',
    user: {
      id: user.id,
      staffId: user.staffId,
      fullName: user.fullName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
    ...(payload.fam ? { sessionId: payload.fam } : {}),
  };
}

async function authenticateService(ctx: AppContext, key: string): Promise<ServicePrincipal> {
  const account = await ctx.db.serviceAccount.findUnique({ where: { keyHash: sha256Hex(key) } });
  if (!account || account.revokedAt) throw new UnauthorizedError('API key is not valid', 'invalid_api_key');
  if (!account.lastUsedAt || Date.now() - account.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
    await ctx.db.serviceAccount.update({ where: { id: account.id }, data: { lastUsedAt: new Date() } });
  }
  return {
    kind: 'service',
    account: { id: account.id, name: account.name, scopes: account.scopes as ApiScope[] },
  };
}

/** Verifies an access token for a socket handshake. Returns the user or throws. */
export async function verifyAccessToken(app: FastifyInstance, ctx: AppContext, token: string) {
  const principal = await authenticateUser(app, ctx, token);
  const decoded = app.jwt.decode<{ exp: number }>(token);
  return { user: principal.user, expiresAt: decoded ? decoded.exp * 1000 : Date.now() };
}

declare module 'fastify' {
  interface FastifyInstance {
    guard: (options: GuardOptions) => preHandlerAsyncHookHandler;
  }
}

export const authPlugin = fp<{ ctx: AppContext }>(
  async (app, { ctx }) => {
    await app.register(fastifyJwt, {
      secret: ctx.env.JWT_SECRET,
      sign: { algorithm: 'HS256', expiresIn: ctx.env.ACCESS_TOKEN_TTL_SECONDS },
      verify: { algorithms: ['HS256'] },
    });

    app.decorateRequest('principal', null);

    app.decorate('guard', (options: GuardOptions): preHandlerAsyncHookHandler => {
      return async (request) => {
        const token = bearer(request);
        if (!token) throw new UnauthorizedError();

        if (token.startsWith(API_KEY_PREFIX)) {
          const principal = await authenticateService(ctx, token);
          const allowed = options.scopes ?? [];
          if (!principal.account.scopes.some((s) => allowed.includes(s))) {
            throw new ForbiddenError('This API key cannot use this route');
          }
          request.principal = principal;
          return;
        }

        const principal = await authenticateUser(app, ctx, token);
        if (!options.roles) throw new ForbiddenError();
        if (options.roles !== 'any' && !options.roles.includes(principal.user.role)) {
          throw new ForbiddenError();
        }
        if (principal.user.mustChangePassword && !options.allowPasswordChange) {
          throw new ForbiddenError('Change your password to continue', 'password_change_required');
        }
        request.principal = principal;
      };
    });
  },
  { name: 'auth' },
);

/** The signed in person on a guarded route. Throws if the caller is a service account. */
export function requireUser(request: FastifyRequest): UserPrincipal['user'] {
  const p = request.principal;
  if (!p || p.kind !== 'user') throw new ForbiddenError();
  return p.user;
}

/** Id to record as the actor in logs and events. Service accounts have no user id. */
export function actorId(request: FastifyRequest): string | null {
  return request.principal?.kind === 'user' ? request.principal.user.id : null;
}

export const STAFF_ROLES: readonly Role[] = ['ADMIN', 'SUPERVISOR'];
export const ALL_ROLES: readonly Role[] = ['ADMIN', 'SUPERVISOR', 'AUDITOR'];
