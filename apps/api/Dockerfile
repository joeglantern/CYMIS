# API image. Build from the repo root:
#   docker build -f apps/api/Dockerfile -t cymis-api .
#
# The "build" stage keeps the full toolchain and is also used to run
# migrations and the seed. The "runtime" stage only carries what the API needs.

FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true PRISMA_HIDE_UPDATE_MESSAGE=1
# Prisma's migration engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/app/package.json ./apps/app/package.json

RUN pnpm install --frozen-lockfile --filter "@cymis/api..."
RUN pnpm --filter "./packages/*" run build \
 && pnpm --filter @cymis/api run build \
 && pnpm --filter @cymis/api deploy --legacy --prod /out

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
