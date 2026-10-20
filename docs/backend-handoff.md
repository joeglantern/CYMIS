# Backend handoff

This is the plan for the second half of the backend. The first half (the API core) is built and tested. Read this whole page before writing code: most of it is about decisions already made and the reasons behind them, because those are the things that are easy to break by accident.

The original system plan is in `docs/reference/system-plan.pdf`. Pages 18 to 34 of it were never written, so where this page and the PDF disagree, this page wins.

## What is already done

All of this is in `apps/api` and covered by tests that run against real Postgres, Redis and S3 containers.

| Area | Where | Notes |
|---|---|---|
| Auth | `modules/auth`, `plugins/auth.ts` | argon2id, lockout after 5 tries, forced change on first sign in, 15 min access JWT with a password version claim, rotating refresh tokens with reuse detection, httpOnly cookie for web, body token for mobile |
| Users | `modules/users` | Admin only writes. Cannot remove the last admin or change your own role |
| Facilities, sections | `modules/facilities` | Sections carry `locationCodes` used to filter imports |
| Audits | `modules/audits` | Status moves with atomic updates, crew assignment, delta download of the expected list, results by bucket |
| Imports | `modules/imports` | SheetJS parser with header row detection, mapping suggestions, saved mappings, row checks, chunked upsert commit, API push for system to system |
| Scan sync | `modules/scans` | Idempotent batch sync, advisory lock per container, duplicates, review (approve, correct, reject) with promotion of the next scan |
| Photos | `modules/photos` | Signed PUT upload, completion check (size, JPEG bytes), queues the CV job, signed view links |
| Reports | `modules/reports` | XLSX, CSV (formula safe), PDF with thumbnails, built in a background job |
| Realtime | `plugins/realtime.ts`, `infra/broadcaster.ts` | Socket.IO with Redis adapter, JWT handshake, rooms per audit and user, presence, progress coalesced to once a second |
| CV results consumer | `jobs/cv-results.ts` | Reads `cv:results`, applies flags, dead letter stream after 5 deliveries |
| Service accounts | `modules/admin` | Scoped API keys for a terminal operator to read results or push expected lists |
| Activity log | `lib/activity.ts` | Sign ins, imports, status changes, reviews, user changes |

Run the API with `WORKERS_IN_PROCESS=true` locally and the workers run inside it. In production they run as a separate process from the same image (`dist/worker.js`).

## Your part, in order

Each item says what done looks like. Please keep to the order: the CV worker unblocks the real end to end test, and the deploy work unblocks everyone else testing on phones.

### 1. The Python CV worker (`services/cv-worker`)

This is the biggest piece. The Node side is finished and waiting for it.

**The contract.** It is defined in `apps/api/src/infra/streams.ts`. Read that file first; it is short.

- Read jobs from the Redis stream `cv:jobs` with consumer group `cv-workers`. The API creates the group at start up with id `0`, so jobs added before your worker starts are still delivered. Create it yourself too and ignore `BUSYGROUP`.
- Each entry has one field, `data`, holding JSON: `scanId`, `photoId`, `storageKey`, `thumbKey`, `deviceNumber`, `attempt`.
- Write each result to `cv:results` as one field, `data`, holding JSON matching the `CvResult` schema: `scanId`, `photoId`, `ok`, `error`, `colour {name, hex, confidence}`, `ocr {number, confidence}`, `thumbKey`. Use `XADD ... MAXLEN ~ 100000`.
- `XACK` the job only after the result is written.
- **Never write to Postgres.** Only the Node API writes to the database. This keeps one owner for every rule about flags and buckets.

**Colour.** Follow section 3.3 of the PDF: crop the body below the number area, downscale to about 200 px wide, convert to Lab, k-means with 4 or 5 clusters, drop clusters that are near black (shadow) or near white (glare, sky), keep the largest left, then the nearest named colour in Lab space. The names must be exactly the ten in `ColourName` in `packages/schemas/src/enums.ts`. Pick reference Lab values from real container paint, not pure RGB primaries; container "blue" is much darker and greyer than `#0000ff`. Confidence should reflect both cluster share and distance to the nearest name. The API only raises a colour flag at confidence 0.6 or more, so a timid detector is safe and a confident wrong one is not.

**Second read.** PaddleOCR on the full photo. Clean the text exactly the way `packages/iso6346/src/ocr.ts` does (strip, find 4 letters and 7 digits, fix letter and digit confusions by position, check digit). Port that logic to Python and port its tests with the same vectors, so both sides agree on what a number is. The API raises a number flag only when your read has a valid check digit, confidence 0.8 or more, and differs from the phone's read.

**Thumbnail.** Write a JPEG about 480 px on the long side, quality around 75, to `thumbKey` in the same bucket. Reports and lists use it. Respect EXIF orientation, phones store rotated images.

**Retries.** On start and every minute, claim entries idle for over 60 seconds (`XAUTOCLAIM`). Check the delivery count with `XPENDING`; after 3 failed tries, post a result with `ok: false` and a short `error`, then ack. A photo that crashes OpenCV must not loop forever.

**Packaging.** Python 3.12, CPU only PaddlePaddle, pinned versions in a lock file, its own Dockerfile, non root user. Download the OCR models at image build time, not at first job, so the first scan of the day is not slow. Settings from env: `REDIS_URL`, the `S3_*` values the API uses, and a concurrency number.

**Done when:** `pytest` passes on fixture photos (at least one per colour, a clear number, a dirty number, a night shot), and with the worker running, uploading a photo through the API ends with `cvStatus` `DONE` on the scan and a flag when you deliberately feed a mismatched colour.

### 2. The rest of the integration tests

`test/auth.test.ts` and `test/flow.test.ts` exist. Write these next to them, in this order:

1. **Route sweep for auth and roles.** Collect every route with an `onRoute` hook, call each one with no token and expect 401, except `/auth/login`, `/auth/refresh`, `/auth/logout` and `/health/*`. Then check a few role rules per module (an auditor cannot create audits, users, imports; a supervisor cannot create users). This is the test that catches a forgotten guard on a new route, so make it fail loudly.
2. **Auditor isolation.** An auditor gets 404 (not 403) for audits they are not assigned to, on every audit route, the socket join, scan sync and photo routes.
3. **Scan concurrency.** Fire 10 syncs of the same container in parallel with different scan ids. Exactly one must be primary, nine `DUPLICATE`. Then reject the primary and check the earliest duplicate is promoted and the others now point at it. Then correct a number and check both containers end up right.
4. **Imports edge cases.** CSV with a UTF 8 BOM, a legacy `.xls`, a file over the size cap (413), a renamed `.exe` called `.xlsx` (400), a sheet with 50,001 rows, replace mode after scans exist (409), append that turns an `UNEXPECTED` scan into `MATCHED`, the saved mapping being picked up for a second file with the same headers in a different order.
5. **Photos against real storage.** Presign, `fetch` PUT to the signed URL, complete, check an entry landed in `cv:jobs`. Then upload PNG bytes under a JPEG name and check it is rejected and the object deleted.
6. **Sockets.** Use `socket.io-client` against `app.listen({ port: 0 })`. Bad token rejected, expired token gets `token_expired`, unassigned join gets `not_found`, two clients in one audit both receive `scan:created`, `audit:progress` arrives within about 1.5 s of a sync.
7. **CV consumer.** `XADD` a good result and a malformed one to `cv:results`; check the scan is updated and the bad one ends in `cv:results:dead`.
8. **Reports.** CSV and PDF reach `READY`; CSV cells starting with `=` come out with a leading apostrophe.
9. **Unit tests for `imports/parser.ts` and `imports/rows.ts`.** Header detection with title rows, merged header cells, mapping suggestions for odd header names.

Things that will bite you in tests:
- Sign in is rate limited to 10 a minute per address, and every injected request comes from 127.0.0.1. Flush Redis in `beforeEach` in files that sign in a lot.
- Integration files share one database and run one at a time. Call `resetData` in `beforeAll`.
- Prisma can refuse `migrate reset` in a non interactive shell. For a local reset, drop the dev Docker volume instead.

### 3. Deployment

Two Contabo VPS, as in the plan. VPS A runs Caddy, the API, the Node worker, Redis and Postgres. VPS B runs the CV worker.

- **One Node image, two commands.** `node:26-slim`, multi stage, `pnpm deploy --prod` to get a pruned bundle, `prisma generate` at build time, run as a non root user. API runs `dist/server.js`, worker runs `dist/worker.js`. Migrations run as a one off step before the new API starts (`prisma migrate deploy`), never at API start up.
- **Caddy** terminates TLS and proxies both REST and `/socket.io` (websocket upgrade). Set `TRUST_PROXY=true` on the API so rate limits and logs see real addresses. Turn on `WORKERS_IN_PROCESS=false` in production.
- **Internal only.** The API must not be open to the whole internet. Put both servers and the supervisors' machines on a private network (Tailscale is the simple option), or at minimum an IP allow list in Caddy. Phones in the yard need a path too, so agree this with whoever runs the network.
- **Postgres.** Two roles: one that owns the schema and runs migrations, one the app uses with only data rights (`SELECT, INSERT, UPDATE, DELETE`). No superuser in `DATABASE_URL`.
- **Redis.** AOF on and `maxmemory-policy noeviction`. BullMQ breaks if Redis evicts keys. Password protected, not exposed outside the private network.
- **Storage.** One private Contabo bucket. No public read. Set `S3_PUBLIC_ENDPOINT` if phones reach storage on a different address than the API does. Keep the `WHEN_REQUIRED` checksum settings in `infra/storage.ts`; Contabo rejects the newer default checksums on signed uploads.
- **Backups.** Nightly `pg_dump` to a separate bucket, 30 days kept. Do a real restore into a scratch database and write the steps into `docs/runbook.md`. A backup nobody has restored is a guess.
- **CI.** GitHub Actions: `pnpm check:text`, lint, typecheck, unit and integration tests (Docker is available on the standard runners), build both images. `pnpm audit --prod` and `pip-audit`.

**Done when:** a fresh pair of servers can be brought up from the runbook alone, and the health check at `/health/ready` reports db, redis and storage all true.

### 4. Housekeeping jobs

Add these as BullMQ repeatable jobs in the worker process:

- Delete refresh tokens that expired more than 30 days ago.
- Delete photo rows still `PENDING_UPLOAD` after 7 days, and their objects if any.
- Delete original import files 90 days after commit (the rows are already in the database). Check with the client first; they may want them kept for evidence.
- Trim `cv:results:dead` and log a warning if it is not empty.

### 5. Load test and security pass

- A k6 script that signs in 10 crew, each syncing batches of 20 scans every few seconds into the same audit, plus 2 supervisors polling results. Target p95 under 300 ms on the API with the expected list at 20,000 rows. Note the numbers in `docs/runbook.md`.
- Run `/security-review` on the whole backend and fix what it finds.

### 6. Technical docs

Plain voice, no dashes (the text check enforces it). Write these in `docs/`:

- `architecture.md`: the parts and how they talk.
- `data-model.md`: copy the bucket rules from the comment at the top of `infra/progress.ts`, and explain primary versus duplicate scans.
- `offline-sync.md`: the contract the mobile app follows. Ids made on the phone, sync order (scans first, then photos), what each `rejected` code means and what the app should do about it, the delta download. **I need this one for the frontend, so please do it early.**
- `realtime.md`: events, rooms, reconnect behaviour.
- `cv-worker.md`, `security.md`, `deployment.md`, `runbook.md`.
- `decisions/`: one short file per decision listed under "Decisions to keep" below.

The user manuals and the legal pages describe screens, so they will be written with the frontend. Leave those.

## Decisions to keep

These are deliberate. Changing one needs a conversation first.

1. **Only Node writes to Postgres.** The CV worker talks through Redis streams. Flags and buckets have one owner.
2. **Scans go over REST, sockets only broadcast.** REST gives a reply per scan and is safe to retry, which offline sync needs. Mixing scan writes into sockets would make retries and ordering much harder.
3. **Phones create scan and photo ids (UUIDv7).** The server upserts by id, so a retried upload never makes a second scan.
4. **One advisory lock per audit and container number.** `lockContainer` in `modules/scans/service.ts`. It is what makes "first scan wins, the rest are duplicates" true under load. When a change touches two containers, lock both in sorted order to avoid deadlocks (see `reviewScan`).
5. **Bucket rules live in two places that must agree:** the SQL in `infra/progress.ts` (counts) and `scanBucketWhere` plus the missing query in `modules/audits/service.ts` (lists). If you change one, change the other, and `flow.test.ts` will tell you if they drift.
6. **Every response goes through a DTO mapper in `lib/dto.ts`.** Never return a Prisma row. That is how `passwordHash` and friends stay private.
7. **Response schemas must not use `.transform()`.** The Zod type provider (v7) serialises with `encode`, which cannot run a transform backwards. Request schemas can transform freely.
8. **Prisma is pinned to 7.10.x.** npm's `latest` tag points at an 8.0 release candidate without migrations. Do not upgrade until 8 is final.
9. **SheetJS comes from its own CDN, not npm.** The npm `xlsx` package is stuck on an old version with known security holes. ExcelJS cannot read `.xls` and has open security issues.
10. **Redis streams, not the Python BullMQ client, for CV.** The Python client is alpha and has to match BullMQ's internal format. Streams are plain Redis and need no matching.
11. **Auditors get 404, not 403, on audits that are not theirs.** It stops them probing which audits exist.
12. **A commit job runs once.** If it fails, the import goes back to `READY` and a person retries. It never retries on its own, because a double commit writes duplicate journey events.

## Working together

- **The API contract is `packages/schemas`.** I am building the frontend against it now. If you need to change a request or response shape, add fields rather than renaming or removing them, and tell me before you merge. Note every contract change in `CHANGELOG.md`.
- Work on branches, small pull requests, and `pnpm check` must pass before merge.
- Errors are thrown as `AppError` subclasses from `lib/errors.ts`. Their messages are shown to crew and supervisors, so write them as plain sentences a person in the yard understands.
- House rules from `CONTRIBUTING.md` apply to code, comments, commit messages and docs: no em or en dashes, no filler words, no native browser dialogs, no port authority branding.

## Open questions waiting on the client

- **The sample KWATOS export.** When it arrives, add it (with real container numbers scrambled) as a test fixture, check the header row detection and mapping suggestions against it, and add its header names to `FIELD_PATTERNS` in `imports/parser.ts` if needed.
- **Which sections the crew audits today** (PDF question Q1). This only changes seed and configuration.
- **Whether they get EDI files** (PDF question Q2). If yes, an EDI adapter is a new file next to `parser.ts` that produces the same `CanonicalRow` list. Nothing else changes.
- **Time zone for display.** Everything is stored in UTC. Reports print UTC today; the client probably wants East Africa Time on paper.
- **How long to keep photos and import files.** Feeds the housekeeping jobs and the data retention page.

## Small known gaps

- If two photos of one scan finish uploading at the same moment, the CV job can be queued twice. The result handler is safe to run twice, so this costs CPU, not correctness. Fix it if you touch that code.
- `GET /audits/:id/expected` returns the whole list in one response. Fine up to about 50,000 rows with compression; page it if lists get bigger.
- Done: sign in and refresh limits now count per person on an address (`loginKey` and `refreshKey` in `modules/auth/routes.ts`), so a shift on one Wi-Fi is not locked out. The per account lockout and the global per address cap are unchanged. A test covers it in `test/auth.test.ts`.
- `scripts/demo-data.mjs` fills a local API with a supervisor, three crew and a live audit. Handy when testing the apps against your changes.
