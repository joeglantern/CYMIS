#!/usr/bin/env bash
# Puts the current working copy on the staging server and (re)starts it.
#
#   infra/staging/deploy.sh liban@156.67.25.84
#
# What it does:
#   1. Builds the web app locally, pointed at its own address.
#   2. Copies the source the API needs, the web build and this folder to
#      ~/cymis-staging on the server.
#   3. The first time only, makes random secrets on the server (.env, s3.json).
#      They never leave the server, except the admin's first password, which is
#      saved to infra/staging/.credentials on this machine (gitignored).
#   4. Builds and starts the cymis-staging stack, then reads the two tunnel
#      addresses and points photo uploads at the right one.
#
# It only touches the cymis-staging compose project and ~/cymis-staging.
set -euo pipefail

TARGET="${1:?Usage: deploy.sh user@host}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE_DIR="cymis-staging"
cd "$ROOT"

echo "Building the web app"
(cd apps/app && EXPO_PUBLIC_API_URL=same-origin npx expo export --platform web --output-dir dist-staging --clear >/dev/null)

echo "Packing the source"
TMP="$(mktemp -d)"
git ls-files -co --exclude-standard -- package.json pnpm-lock.yaml pnpm-workspace.yaml .dockerignore packages apps/api apps/app/package.json infra/staging \
  | grep -v -E '(^|/)(\.env|\.credentials|s3\.json)$' > "$TMP/files"
tar -czf "$TMP/src.tgz" -T "$TMP/files"
tar -czf "$TMP/web.tgz" -C apps/app/dist-staging .

echo "Copying to $TARGET"
ssh "$TARGET" "mkdir -p ~/$REMOTE_DIR"
scp -q "$TMP/src.tgz" "$TMP/web.tgz" "$TARGET:$REMOTE_DIR/"
rm -rf "$TMP"

OUT="$(ssh "$TARGET" bash -s <<'REMOTE'
set -euo pipefail
cd ~/cymis-staging
tar -xzf src.tgz && rm src.tgz
rm -rf infra/staging/web && mkdir -p infra/staging/web && tar -xzf web.tgz -C infra/staging/web && rm web.tgz
cd infra/staging
umask 077

rand() { head -c 48 /dev/urandom | base64 | tr -d '/+=\n' | cut -c1-"$1"; }

if [ ! -f .env ]; then
  ADMIN_PW="$(rand 6)-$(rand 6)-$(rand 6)"
  cat > .env <<ENV
POSTGRES_PASSWORD=$(rand 40)
JWT_SECRET=$(rand 64)
COOKIE_SECRET=$(rand 64)
S3_ACCESS_KEY_ID=cymis$(rand 12)
S3_SECRET_ACCESS_KEY=$(rand 40)
CORS_ORIGINS=http://localhost:8081
SEED_ADMIN_STAFF_ID=ADMIN
SEED_ADMIN_PASSWORD=$ADMIN_PW
S3_PUBLIC_ENDPOINT=
ENV
  echo "FIRST_ADMIN_PASSWORD=$ADMIN_PW" > .first-admin
fi

set -a; . ./.env; set +a
cat > s3.json <<JSON
{"identities":[{"name":"cymis","credentials":[{"accessKey":"$S3_ACCESS_KEY_ID","secretKey":"$S3_SECRET_ACCESS_KEY"}],"actions":["Admin","Read","Write","List","Tagging"]}]}
JSON
# The storage container runs as its own user, so it needs to read this file.
# The folder above it is private to this account, so nobody else on the
# server can get to it.
chmod 700 ~/cymis-staging
chmod 644 s3.json

docker compose -p cymis-staging up -d --build --remove-orphans

url_of() {
  for _ in $(seq 1 60); do
    u="$(docker compose -p cymis-staging logs "$1" 2>/dev/null | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1 || true)"
    [ -n "$u" ] && { echo "$u"; return; }
    sleep 2
  done
}
WEB_URL="$(url_of tunnel-web)"
S3_URL="$(url_of tunnel-s3)"

if [ -n "$S3_URL" ] && ! grep -q "^S3_PUBLIC_ENDPOINT=$S3_URL$" .env; then
  sed -i "s#^S3_PUBLIC_ENDPOINT=.*#S3_PUBLIC_ENDPOINT=$S3_URL#" .env
  docker compose -p cymis-staging up -d api
fi

echo "WEB_URL=$WEB_URL"
echo "S3_URL=$S3_URL"
[ -f .first-admin ] && cat .first-admin && rm .first-admin
docker compose -p cymis-staging ps --format '{{.Service}} {{.Status}}'
REMOTE
)"

# Keep the first admin password out of the terminal: it goes to a private file.
if grep -q '^FIRST_ADMIN_PASSWORD=' <<<"$OUT"; then
  umask 077
  grep '^FIRST_ADMIN_PASSWORD=' <<<"$OUT" | sed 's/^FIRST_ADMIN_PASSWORD=/ADMIN first password: /' > "$ROOT/infra/staging/.credentials"
  echo "Saved the first admin password to infra/staging/.credentials"
fi
grep -v '^FIRST_ADMIN_PASSWORD=' <<<"$OUT"
