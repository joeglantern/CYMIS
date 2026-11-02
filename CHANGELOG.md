# Changelog

Contract changes (anything in `packages/schemas`) must be listed here.

## 0.1.0 (2026-10-20)

- First backend core: auth, users, facilities and sections, audits, imports, scan sync, review, photos, reports, realtime, CV results consumer, service accounts, activity log.
- Shared packages `@cymis/iso6346` and `@cymis/schemas`.

## 0.2.0 (2026-10-29)

- `SessionDto`, `SessionsResponse` and `EndedSessionsResponse`: signed in devices, for `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/sessions/end-others` and `POST /users/:id/sign-out-everywhere`.
- `AppConfigResponse`: minimum and latest app version, feature switches and a notice, for `GET /app-config`.
- `ClientErrorBody`: crash reports from the apps, for `POST /client-errors`.
- `/health/live` now also returns `version` and `commit`.
- `ErrorResponse.error.requestId`: a reference for support, also sent as the `x-request-id` header.
- `AuthResponse.previousSignIn`: on sign in, when the account was last used, on what, and wrong passwords since.
- `AppConfigResponse.environment`: production, staging or development.

## 0.3.0 (2026-11-02)

- `ShiftDto`, `ShiftBrief`, `CreateShiftBody`, `UpdateShiftBody`, `ShiftListQuery` and `ShiftListResponse`: shift planning, for `GET /shifts`, `POST /shifts`, `PATCH /shifts/:id` and `DELETE /shifts/:id`. Admins and supervisors only.
- `AuditDto.shifts`: the shifts on a yard plan, soonest first. A clerk gets only their own, with only their own id in `clerkIds`.
- `AuditDto.viaShiftIds`: assignees who are on the plan only through a shift. Empty for clerks.
- Both are new fields. No existing field changed meaning, so old phones and integrations keep working by ignoring them.
- `POST /sync/scans`: a scan from someone who has lost a yard plan is accepted if it was captured at or before the moment they lost it. No schema change. Reads stay refused.
