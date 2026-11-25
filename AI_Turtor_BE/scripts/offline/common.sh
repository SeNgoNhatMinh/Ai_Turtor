#!/usr/bin/env bash
# Shared helpers. Secrets are read from env files into variables and passed to
# containers through environment variables; they are never printed.
set -euo pipefail

BE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPTS_DIR="$BE_DIR/scripts/offline"
BACKUP_DIR="${MONGO_BACKUP_DIR_HOST:-$BE_DIR/backup}"
MONGO_IMAGE="mongo:8.0.17"
APP_DB="tutor_db"
OFFLINE_CONTAINER="ai-tutor-mongodb-offline"

env_value() { # env_value FILE KEY
  local file="$1" key="$2"
  [[ -f "$file" ]] || { echo "Missing $file" >&2; return 1; }
  grep -E "^${key}=" "$file" | tail -1 | cut -d= -f2-
}

offline_network() {
  docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$OFFLINE_CONTAINER" | awk '{print $1}'
}

local_root_uri() {
  local u p
  u="$(env_value "$BE_DIR/.env.offline" MONGO_ROOT_USERNAME)"
  p="$(env_value "$BE_DIR/.env.offline" MONGO_ROOT_PASSWORD)"
  printf 'mongodb://%s:%s@mongodb:27017/?authSource=admin' "$u" "$p"
}

atlas_uri() {
  local v="${MONGO_ATLAS_URI:-}"
  [[ -n "$v" ]] || v="$(env_value "$BE_DIR/.env.deploy" SPRING_DATA_MONGODB_URI)"
  [[ "$v" == *mongodb.net* ]] || { echo "Atlas URI not found (expected *.mongodb.net)" >&2; return 1; }
  printf '%s' "$v"
}

# verify_archive NAME: gzip stream test + mongorestore --dryRun (parses the archive,
# writes nothing; it still needs a server to connect to, so it uses the offline Mongo).
verify_archive() {
  local name="$1"
  gzip -t "$BACKUP_DIR/$name"
  DRY_URI="$(local_root_uri)" docker run --rm --network "$(offline_network)" -e DRY_URI \
    -v "$BACKUP_DIR":/backup:ro "$MONGO_IMAGE" \
    sh -c "mongorestore --uri=\"\$DRY_URI\" --dryRun --archive=/backup/$name --gzip --nsInclude='$APP_DB.*'" \
    2>&1 | mask | tail -2
}

mask() { sed -E 's#mongodb(\+srv)?://[^ "]*#<uri-hidden>#g'; }
