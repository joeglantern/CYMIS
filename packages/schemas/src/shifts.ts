import { z } from 'zod';
import { Id, IsoDateTime } from './common.js';
import { AuditStatus } from './enums.js';
import { UserSummary } from './users.js';

const after = (start: string, end: string) => new Date(end).getTime() > new Date(start).getTime();
const END_AFTER_START = { message: 'A shift must end after it starts', path: ['endsAt'] };

const ShiftName = z.string().trim().min(2).max(60);

/** A shift as it travels with its yard plan. A clerk gets only their own shifts, with only their own id. */
export const ShiftBrief = z.object({
  id: Id,
  name: z.string(),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  clerkIds: z.array(Id),
});
export type ShiftBrief = z.infer<typeof ShiftBrief>;

export const ShiftDto = z.object({
  id: Id,
  name: z.string(),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  audit: z.object({
    id: Id,
    name: z.string(),
    status: AuditStatus,
    section: z.object({ id: Id, name: z.string() }),
  }),
  clerks: z.array(UserSummary),
  createdAt: IsoDateTime,
});
export type ShiftDto = z.infer<typeof ShiftDto>;

export const CreateShiftBody = z
  .object({
    auditId: Id,
    name: ShiftName,
    startsAt: IsoDateTime,
    endsAt: IsoDateTime,
    clerkIds: z.array(Id).max(200).default([]),
  })
  .refine((b) => after(b.startsAt, b.endsAt), END_AFTER_START);
export type CreateShiftBody = z.infer<typeof CreateShiftBody>;

/** A shift stays on its yard plan, so the plan cannot be changed here. clerkIds is the full new list. */
export const UpdateShiftBody = z
  .object({
    name: ShiftName.optional(),
    startsAt: IsoDateTime.optional(),
    endsAt: IsoDateTime.optional(),
    clerkIds: z.array(Id).max(200).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' })
  .refine((b) => !b.startsAt || !b.endsAt || after(b.startsAt, b.endsAt), END_AFTER_START);
export type UpdateShiftBody = z.infer<typeof UpdateShiftBody>;

export const ShiftListQuery = z.object({
  auditId: Id.optional(),
  /** Only shifts ending at or after this time. */
  endsFrom: IsoDateTime.optional(),
  /** Only shifts ending before this time. */
  endsBefore: IsoDateTime.optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type ShiftListQuery = z.infer<typeof ShiftListQuery>;

export const ShiftListResponse = z.object({ items: z.array(ShiftDto) });
export type ShiftListResponse = z.infer<typeof ShiftListResponse>;
