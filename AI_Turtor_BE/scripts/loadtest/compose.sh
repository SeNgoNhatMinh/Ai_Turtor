#!/usr/bin/env bash
# Offline stack + load-test override (isolated DB, cloud chat). Later env files win.
cd "$(dirname "$0")/../.."
exec docker compose -f docker-compose.deploy.yml -f docker-compose.offline.yml -f docker-compose.loadtest.yml \
  --env-file .env.deploy --env-file .env.offline --env-file .env.loadtest "$@"
