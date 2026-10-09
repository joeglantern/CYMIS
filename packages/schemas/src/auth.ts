import { z } from 'zod';
import { Id, IsoDateTime, Password, StaffId } from './common.js';
import { Role } from './enums.js';

export const ClientKind = z.enum(['web', 'mobile']);
export type ClientKind = z.infer<typeof ClientKind>;

export const LoginBody = z.object({
  staffId: StaffId,
  // No length rule on login, only on set. Old passwords must still work.
  password: z.string().min(1).max(128),
  client: ClientKind.default('mobile'),
  deviceLabel: z.string().trim().max(100).optional(),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const Me = z.object({
  id: Id,
  staffId: z.string(),
  fullName: z.string(),
  role: Role,
  mustChangePassword: z.boolean(),
});
export type Me = z.infer<typeof Me>;

/**
 * Mobile gets the refresh token in the body (it goes in SecureStore). Web gets
 * it as an httpOnly cookie, so the field is left out.
 */
export const AuthResponse = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: IsoDateTime,
  refreshToken: z.string().optional(),
  refreshTokenExpiresAt: IsoDateTime,
  user: Me,
});
export type AuthResponse = z.infer<typeof AuthResponse>;

export const RefreshBody = z.object({
  refreshToken: z.string().min(20).max(200).optional(),
});
export type RefreshBody = z.infer<typeof RefreshBody>;

export const LogoutBody = RefreshBody;

export const ChangePasswordBody = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: Password,
    /** Fresh tokens come back after a change. Tells the API whether to use a cookie or the body. */
    client: ClientKind.default('mobile'),
  })
  .refine((b) => b.currentPassword !== b.newPassword, {
    message: 'New password must be different',
    path: ['newPassword'],
  });
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>;
