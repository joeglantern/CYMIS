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

Additive. Old clients keep working.

- `YardDto`, `CreateYardBody`, `UpdateYardBody`: yards inside a facility, for the new `POST /yards` and `PATCH /yards/:id` (admin only).
- `FacilityDto.yards`: the facility's yards.
- `SectionDto.yardId` and `SectionDto.boundary`: both nullable. Null means not in a yard, and no shape.
- `CreateSectionBody` and `UpdateSectionBody` accept optional `yardId` and `boundary`. Sending null clears them.
- `LatLng`, `Boundary`, `boundaryProblem`, `BOUNDARY_MIN_POINTS`, `BOUNDARY_MAX_POINTS`: a block's shape, 3 to 50 points with no repeats and no crossing edges.
- New error codes: `yard_has_active_sections`, `yard_turned_off`, `yard_other_facility`.
- Migration `20261102120000_yards_and_block_shapes`.
