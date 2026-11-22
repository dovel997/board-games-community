#!/usr/bin/env bash
# Runs on the VPS (called by GitHub Actions over SSH).
# Usage: ./deploy.sh <image> [expected-version]
#   <image>            e.g. ghcr.io/owner/board-games-community-api:<git-sha>
#   [expected-version] git SHA the health endpoint must report (optional)
set -euo pipefail

IMAGE="${1:?usage: deploy.sh <image> [expected-version]}"
EXPECTED_VERSION="${2:-}"
HEALTH_URL="http://127.0.0.1:5000/api/health"

cd "$(dirname "$0")"

echo "==> Deploying $IMAGE"
echo "API_IMAGE=$IMAGE" > .env

docker compose pull api
docker compose up -d --remove-orphans

echo "==> Waiting for $HEALTH_URL"
for _ in $(seq 1 30); do
  if body="$(curl -fsS "$HEALTH_URL" 2>/dev/null)"; then
    if [ -z "$EXPECTED_VERSION" ] || grep -q "$EXPECTED_VERSION" <<<"$body"; then
      echo "$body"
      echo "==> Healthy. Removing unused images."
      docker image prune -f >/dev/null
      exit 0
    fi
  fi
  sleep 2
done

echo "==> Health check failed. Last container logs:" >&2
docker compose logs --tail 100 api >&2
exit 1
