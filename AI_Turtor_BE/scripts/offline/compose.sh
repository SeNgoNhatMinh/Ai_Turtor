#!/usr/bin/env bash
# docker compose wrapper for the offline stack (local MongoDB instead of Atlas).
# Examples:
#   scripts/offline/compose.sh up -d
#   scripts/offline/compose.sh ps
#   scripts/offline/compose.sh logs -f ai-tutor-api
set -euo pipefail
cd "$(dirname "$0")/../.."
exec docker compose -f docker-compose.deploy.yml -f docker-compose.offline.yml \
  --env-file .env.deploy --env-file .env.offline "$@"
