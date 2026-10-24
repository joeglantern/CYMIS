#!/usr/bin/env bash
# After the server restarts, the Cloudflare quick tunnels come back with new
# addresses. This prints them and points photo uploads at the new storage
# address, then restarts the API.
#
#   infra/staging/refresh-urls.sh liban@156.67.25.84
#
# Afterwards set EXPO_PUBLIC_API_URL in apps/app/.env.local (and eas.json) to
# the new web address.
set -euo pipefail
TARGET="${1:?Usage: refresh-urls.sh user@host}"

ssh "$TARGET" bash -s <<'REMOTE'
set -euo pipefail
cd ~/cymis-staging/infra/staging
url_of() {
  docker compose -p cymis-staging logs "$1" 2>/dev/null | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1 || true
}
WEB_URL="$(url_of tunnel-web)"
S3_URL="$(url_of tunnel-s3)"
if [ -n "$S3_URL" ] && ! grep -q "^S3_PUBLIC_ENDPOINT=$S3_URL$" .env; then
  sed -i "s#^S3_PUBLIC_ENDPOINT=.*#S3_PUBLIC_ENDPOINT=$S3_URL#" .env
  docker compose -p cymis-staging up -d api >/dev/null
  echo "Photo uploads now go to $S3_URL"
fi
echo "WEB_URL=$WEB_URL"
echo "S3_URL=$S3_URL"
REMOTE
