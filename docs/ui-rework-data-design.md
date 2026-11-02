# UI rework: data design for stages 4 to 7

Written by the lead before any of this is built, so the helpers build one design. See `ui-rework-queue.md` for the why. If something here turns out wrong, tell the lead instead of working around it.

## Rules for every data change

- Additive only. New tables and nullable columns. Nothing renamed or dropped. One migration per stage.
- Old phones keep working. A phone on the old build sends scans without the new fields and reads responses with extra fields, so new body fields are optional and no existing response field changes meaning.
- Offline first stays. A scan never waits for the network, and the phone creates its own ids.
- Every route: zod on input and output, a role guard, an activity log entry on writes, `AppError` subclasses. Routes stay thin.
- Anything in `packages/schemas` is listed in `CHANGELOG.md`.
- Tests next to the code, plus a case in `apps/api/test` for roles and for the old phone payload.
- User words: yard plan, clerk, block. Code names stay audit and section.

## Stage 5: yards and block shapes

```prisma
model Yard {
  id         String   @id @default(uuid(7)) @db.Uuid
  facilityId String   @db.Uuid
  code       String
  name       String
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now()) @db.Timestamptz(3)
  updatedAt  DateTime @updatedAt @db.Timestamptz(3)
  facility   Facility  @relation(fields: [facilityId], references: [id])
  sections   Section[]
  @@unique([facilityId, code])
  @@map("yards")
}
// Section gains:
yardId   String? @db.Uuid   // null: not in a yard yet
boundary Json?              // [{ lat, lng }, ...], see below
```

- `boundary`: 3 to 50 points, valid lat and lng, no two points the same, edges must not cross. Validate in a shared zod schema with tests. Not limited to rectangles, because the recording is unclear at 05:36 and this covers both.
- `FacilityDto` gains `yards`. `SectionDto` gains `yardId` and `boundary`, both nullable.
- `POST /yards` and `PATCH /yards/:id`, admin only. Sections accept `yardId` and `boundary`. A section's yard must be in the same facility. A yard with active sections cannot be switched off (conflict error with a clear message).
- Yard management page: facility, then its yards, then their blocks, then a "Not in a yard" group. Add yard. Add block with a yard picker. Each block has **Choose coordinates**: a map opens, tap the corners, the shape draws, undo and clear, save.
- Map: Leaflet, pinned, in a `.web.tsx` file with a native stub that says to open this on a computer, the same split `WebReader` uses. No native rebuild. Tile address comes from one setting, with attribution shown. OpenStreetMap is the default. Our web server sends `Referrer-Policy: no-referrer`, and OpenStreetMap can refuse tile requests with no referrer, so set Leaflet's `referrerPolicy` option on the tile layer and test it on the deployed test server, not only on localhost. See the open question on imagery.
- Admin only, as today.

## Stage 4: misplaced boxes

No GPS and no block shapes needed. The clerk is standing at the box and can see the list says somewhere else.

```prisma
// Scan gains:
foundLocation String?   // where the clerk says the box really is
// enum ScanFlag gains: LOCATION_MISMATCH
```

- Result panel, when the box is on the list with a location: **Scan next** stays the main action. A quiet second action, **It is somewhere else**, asks for the location with the plate keypad style input, starting from the last location that clerk entered, then **Send for approval**.
- `SyncScanItem` gains optional `foundLocation`. The server sets `LOCATION_MISMATCH` and review `PENDING` when it is present and differs from the list. No foundLocation means today's behaviour exactly. The offline queue stores it.
- Review queue: a new filter, and the row reads "List says A01-02-3, found at A05-01-1".
- Approve means the list was wrong: update `ExpectedContainer.location`, bump `version` and `listVersion` so phones pick it up, and record a container event. Reject means the box must be moved back: note required, as today, but the count stays found. Both in the existing locked transaction.
- A rejected location scan must not run the existing "promote next primary" path as if the scan itself were bad. Test this.
- Reports gain a found location column.
- Later and separate: GPS against block shapes as a hint.

## Stage 6: shifts

```prisma
model Shift {
  id          String   @id @default(uuid(7)) @db.Uuid
  auditId     String   @db.Uuid
  name        String
  startsAt    DateTime @db.Timestamptz(3)
  endsAt      DateTime @db.Timestamptz(3)
  createdById String   @db.Uuid
  createdAt   DateTime @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @db.Timestamptz(3)
  // relations to Audit (cascade), User and ShiftAssignment
  @@index([auditId, startsAt])
  @@map("shifts")
}
model ShiftAssignment {
  shiftId String @db.Uuid
  userId  String @db.Uuid
  @@id([shiftId, userId])
  @@index([userId])
  @@map("shift_assignments")
}
```

- Access to a plan still comes only from `AuditAssignment`. Adding a clerk to a shift also adds them to the plan. Removing them drops the plan assignment only if no other shift holds them and they were not assigned directly: record that choice in a test.
- Shift times do not block scans. A clerk with a late scan or an offline phone must still save. Times are for planning and display.
- Admin and supervisor create, change and delete. End must be after start. Show East Africa Time; store UTC.
- `/dashboard/shifts` replaces the holding page: shifts by day, new shift with plan, name, times and clerks. Keep the Clerks step in the wizard working.
- Clerk home card shows "Your shift: Day, 06:00 to 14:00". The phone caches this with the plan so it shows offline.

## Stage 7: live map

- Existing `YardMap` bay grid: updates live from socket events where they exist, with polling as the fallback. Correct stays grey, misplaced stands out. Filters: all blocks, by block, misplaced only.
- Web map from stage 5 draws block shapes, colours a block by its mismatch count, and plots recent scan GPS points with the clerk's initials. Scans with no location are counted, not guessed.
- Clerks see the map for their own plan only.
- No 3D. That is stage 8 and it is parked.

## Decided by Joe on 2 November 2026

1. **Whole yard plans use a section.** A section with no location codes keeps every row, so one "whole yard" section is how a plan covers a yard. No yard level plan for now. Yard management should make this easy to set up and easy to understand.
2. **Map imagery.** Start on OpenStreetMap. Satellite imagery needs its licence and cost checked before production. Switching is one setting.
3. **Design.** Every screen uses the `impeccable` design skill and follows `docs/brand`.
