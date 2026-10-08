# Contributing to Cymis

Container audit app for port yards. A supervisor imports a terminal system export (for example a KWATOS Excel file), crew scan containers with their phones, and every container ends up found, missing, unexpected or mismatched, live on a dashboard.

Cymis is its own product. It is not made for or by any port authority and it is not connected to any terminal operating system. It reads their exports and is built so a terminal operator can connect it later through the adapters and the API.

## House rules

These apply to everything: code, comments, docs, commit messages, UI copy.

1. **No em dashes or en dashes.** Use a comma, colon, full stop or brackets. `pnpm check:text` fails the build if it finds one.
2. **Write like a person.** Short sentences, plain words. Do not use: delve, seamless, robust, leverage, elevate, empower, cutting-edge, streamline, "in today's world". These are blocked by the same check.
3. **No gradients** anywhere in the UI. Flat colour, with texture where the design calls for it.
4. **No native dialogs.** Never `alert()`, `confirm()` or `prompt()`. Use the app's own alert and confirm components.
5. **KPA colours, not KPA branding.** The palette uses KPA colours as accents on a white and black base (see `docs/brand/colours.md`). The KPA logo is not shown in the app and nothing says "built for KPA".
6. **Security first.** Validate every input with zod, check roles on every route, never log secrets, never send stack traces to clients.

## Layout

```
apps/api              Fastify API, Socket.IO, BullMQ workers, Prisma
services/cv-worker    Python colour detection and second pass OCR
packages/iso6346      Container number check digit and OCR clean up
packages/schemas      Zod schemas shared by the API and the apps
packages/tsconfig     Shared TypeScript settings
infra                 Docker compose files, Caddy, backup scripts
docs                  Architecture, manuals, legal, decisions
```

## Commands

```
pnpm install
pnpm dev:infra        start Postgres, Redis and MinIO in Docker
pnpm --filter @cymis/api db:migrate
pnpm --filter @cymis/api db:seed
pnpm dev              run the API with reload
pnpm check            text check, lint, typecheck and all tests
```

## Conventions

- ESM everywhere, TypeScript strict, imports end in `.js`.
- One folder per feature in `apps/api/src/modules/<name>/`: `routes.ts`, `service.ts`, tests next to them.
- Services take what they need as arguments and throw `AppError` subclasses. Routes stay thin.
- Ids are UUIDv7. Phones create scan and photo ids themselves so retries are safe.
- Only the Node API writes to Postgres. The CV worker talks through Redis streams.
- Prisma is pinned to 7.10.x. Do not upgrade to 8 until it leaves release candidate.
