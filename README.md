# Cymis

Container audits for port yards. A supervisor imports the terminal system's container list, the crew scan boxes with their phones or tablets, and every container ends up found, missing, unexpected or flagged for review, live on a dashboard.

## Status

- **Crew app and supervisor dashboard:** built. One Expo app in `apps/app` runs on phones, tablets and the web.
- **API and database:** built and tested.
- **Test server:** running on a VPS in Docker, see `infra/staging`.
- **Photo checking service, production setup:** in progress. See `docs/backend-handoff.md`.

## Start here

- `CONTRIBUTING.md`: house rules, project layout and conventions. Read it first.
- `docs/backend-handoff.md`: what the backend still needs, the decisions behind it, and how to work together.
- `docs/open-questions.md`: what we are waiting on from the client.
- `docs/manuals/` and `docs/legal/`: user guides and legal drafts.
- `docs/reference/system-plan.pdf`: the original system plan.
- API reference: run the API locally and open `/docs`.

## Run it locally

You need Node 22 or newer, pnpm 10 and Docker Desktop running.

```
pnpm install
pnpm dev:infra
cp apps/api/.env.example apps/api/.env
pnpm --filter @cymis/api db:migrate
pnpm --filter @cymis/api db:seed
pnpm dev
```

The API listens on `http://localhost:4000`. To fill it with a supervisor, three crew and a live audit:

```
node scripts/demo-data.mjs
```

Then start the app in another terminal:

```
cd apps/app
cp .env.example .env.local
npx expo start --clear
```

Press `w` for the web dashboard, or scan the QR code with Expo Go. A phone cannot reach `localhost` on your machine, so for a phone set `EXPO_PUBLIC_API_URL` in `apps/app/.env.local` to your computer's LAN address or to the test server.

On-device text reading (Google ML Kit) needs a development build: `npx eas-cli build --profile development`. Expo Go and the web use a slower built in reader instead.

## Test server

`infra/staging/deploy.sh user@host` builds the web app, copies the code to the server and starts the `cymis-staging` Docker stack. Nothing is published on the server's ports; access is through Cloudflare tunnels. If the server restarts, the tunnel addresses change: run `infra/staging/refresh-urls.sh user@host` to see the new ones and re-point photo uploads.

`scripts/showcase-data.mjs` fills a server with a realistic day of data for demos.

## Checks

`pnpm check` runs the text check, lint, typecheck and every test. It must pass before a merge.
