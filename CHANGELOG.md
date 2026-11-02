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

### Yards and block shapes

Additive. Old clients keep working.

- `YardDto`, `CreateYardBody`, `UpdateYardBody`: yards inside a facility, for the new `POST /yards` and `PATCH /yards/:id` (admin only).
- `FacilityDto.yards`: the facility's yards.
- `SectionDto.yardId` and `SectionDto.boundary`: both nullable. Null means not in a yard, and no shape.
- `CreateSectionBody` and `UpdateSectionBody` accept optional `yardId` and `boundary`. Sending null clears them.
- `LatLng`, `Boundary`, `boundaryProblem`, `BOUNDARY_MIN_POINTS`, `BOUNDARY_MAX_POINTS`: a block's shape, 3 to 50 points with no repeats and no crossing edges.
- New error codes: `yard_has_active_sections`, `yard_turned_off`, `yard_other_facility`.
- Migration `20261102120000_yards_and_block_shapes`.

## 0.4.0 (2026-11-02)

- `BaysResponse`, `BayDto`, `BayBlock`, `BayCounts`: counts per bay, for the new `GET /audits/:id/bays`. Open to anyone who can see the plan, and it names nobody.
- `YardMapResponse`, `MapBlock`, `ScanPoint`: shapes and recent scan positions, for the new `GET /audits/:id/map`. Admins and supervisors only.
- `splitLocation`: moved here from the app, so the grid and the server split a location the same way.
- Behaviour: `scan:created`, `scan:updated` and `flag:raised` now go only to staff in a plan's room, because they carry a clerk's name and position. Clerks still get `audit:progress`, `audit:status`, `expected:updated` and `presence:update`.
- Behaviour: for a clerk, `GET /audits/:id/scans` returns only their own scans and `GET /scans/:id` refuses anyone else's. The app's clerk screens never called either.
