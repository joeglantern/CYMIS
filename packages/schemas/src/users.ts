import { z } from 'zod';
import { CursorQuery, Id, IsoDateTime, Password, StaffId } from './common.js';
import { Role } from './enums.js';

export const FullName = z.string().trim().min(2).max(120);

export const UserDto = z.object({
  id: Id,
  staffId: z.string(),
  fullName: z.string(),
  role: Role,
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
  lockedUntil: IsoDateTime.nullable(),
  lastLoginAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type UserDto = z.infer<typeof UserDto>;

export const UserSummary = z.object({ id: Id, staffId: z.string(), fullName: z.string() });
export type UserSummary = z.infer<typeof UserSummary>;

export const CreateUserBody = z.object({
  staffId: StaffId,
  fullName: FullName,
  role: Role,
  /** Given to the person by hand. They must change it on first sign in. */
  temporaryPassword: Password,
});
export type CreateUserBody = z.infer<typeof CreateUserBody>;

export const UpdateUserBody = z
  .object({
    fullName: FullName.optional(),
    role: Role.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
export type UpdateUserBody = z.infer<typeof UpdateUserBody>;

export const ResetPasswordBody = z.object({ temporaryPassword: Password });
export type ResetPasswordBody = z.infer<typeof ResetPasswordBody>;

export const UserListQuery = CursorQuery.extend({
  q: z.string().trim().max(60).optional(),
  role: Role.optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type UserListQuery = z.infer<typeof UserListQuery>;
