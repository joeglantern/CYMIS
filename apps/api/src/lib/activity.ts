import type { Db, Prisma } from '../infra/db.js';

export interface ActivityInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ip?: string | null;
  data?: Prisma.InputJsonValue;
}

type Writer = Pick<Db, 'activityLog'>;

/** Writes one line to the activity log. Pass a transaction client to keep it in the same transaction. */
export async function logActivity(db: Writer, input: ActivityInput): Promise<void> {
  await db.activityLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      ip: input.ip ?? null,
      data: input.data,
    },
  });
}
