# Cymis

Container audits for port yards. A supervisor imports the terminal system's container list, the crew scan boxes with their phones, and every container ends up found, missing, unexpected or flagged for review, live on a dashboard.

## Status

- **Backend core:** built and tested. See `docs/backend-handoff.md` for what is done and what comes next.
- **CV worker, deployment, ops:** in progress, see the handoff.
- **Mobile app and dashboard:** being designed.

## Start here

- `CONTRIBUTING.md`: house rules, project layout and conventions. Read it first.
- `docs/backend-handoff.md`: backend plan, decisions and open questions.
- `docs/reference/system-plan.pdf`: the original system plan.
- API reference: run the API locally and open `/docs`.

## Quick start

```
pnpm install
pnpm dev:infra
cp apps/api/.env.example apps/api/.env
pnpm --filter @cymis/api db:migrate
pnpm --filter @cymis/api db:seed
pnpm dev
```

`pnpm check` runs the text check, lint, typecheck and every test. It must pass before a merge.
