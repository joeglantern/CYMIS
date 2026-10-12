import type { ApiScope } from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import type { Prisma } from '../../infra/db.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { Principal } from '../../plugins/auth.js';

/**
 * Loads an audit if the caller may see it. Admins and supervisors see all
 * audits. Auditors only see audits they are assigned to; for anything else
 * they get "not found", so they cannot probe which audits exist. Service
 * accounts need one of the given scopes.
 */
export async function loadAuditFor<T extends Prisma.AuditInclude | undefined = undefined>(
  ctx: AppContext,
  auditId: string,
  principal: Principal | null,
  options: { scopes?: readonly ApiScope[]; include?: T } = {},
): Promise<Prisma.AuditGetPayload<{ include: T }>> {
  if (!principal) throw new ForbiddenError();
  const audit = await ctx.db.audit.findUnique({
    where: { id: auditId },
    ...(options.include ? { include: options.include } : {}),
  });
  if (!audit) throw new NotFoundError('Audit');

  if (principal.kind === 'service') {
    const allowed = options.scopes ?? [];
    if (!principal.account.scopes.some((s) => allowed.includes(s))) throw new ForbiddenError();
    return audit as Prisma.AuditGetPayload<{ include: T }>;
  }

  if (principal.user.role === 'AUDITOR') {
    const assigned = await ctx.db.auditAssignment.findUnique({
      where: { auditId_userId: { auditId, userId: principal.user.id } },
      select: { auditId: true },
    });
    if (!assigned) throw new NotFoundError('Audit');
  }
  return audit as Prisma.AuditGetPayload<{ include: T }>;
}

/** Same check, for code that already has the audit row. */
export async function canSeeAudit(ctx: AppContext, auditId: string, principal: Principal): Promise<boolean> {
  if (principal.kind === 'service') return true;
  if (principal.user.role !== 'AUDITOR') return true;
  const assigned = await ctx.db.auditAssignment.findUnique({
    where: { auditId_userId: { auditId, userId: principal.user.id } },
    select: { auditId: true },
  });
  return assigned !== null;
}
