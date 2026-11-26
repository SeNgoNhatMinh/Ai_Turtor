#!/usr/bin/env bash
# Isolated database for load/chaos tests. Random PUT/POST/DELETE calls must never
# touch the real tutor_db, so the API is pointed at a copy while testing.
#
#   scripts/loadtest/db.sh clone [archive]  copy tutor_db -> tutor_db_loadtest (from a local dump)
#   scripts/loadtest/db.sh drop             delete tutor_db_loadtest only
#
# The app user (tutor_app) gets readWrite on the copy; its authSource stays tutor_db.
source "$(dirname "$0")/../offline/common.sh"
TEST_DB="tutor_db_loadtest"

mongosh_root() { # mongosh_root JS
  JS="$1" ROOT_URI="$(local_root_uri)" docker run --rm --network "$(offline_network)" -e ROOT_URI -e JS "$MONGO_IMAGE" \
    sh -c 'mongosh --quiet "$ROOT_URI" --eval "$JS"' 2>&1 | mask
}

case "${1:-}" in
  clone)
    archive="$(basename "${2:-$(cat "$BACKUP_DIR/LATEST_local")}")"
    [[ -f "$BACKUP_DIR/$archive" ]] || { echo "Archive not found: $archive" >&2; exit 1; }
    existing="$(mongosh_root "print(db.getSiblingDB('$TEST_DB').getCollectionNames().length)" | tail -1)"
    [[ "$existing" == "0" ]] || { echo "$TEST_DB already has $existing collections; run 'drop' first" >&2; exit 1; }
    ROOT_URI="$(local_root_uri)" docker run --rm --network "$(offline_network)" -e ROOT_URI \
      -v "$BACKUP_DIR":/backup:ro "$MONGO_IMAGE" \
      sh -c "mongorestore --uri=\"\$ROOT_URI\" --archive=/backup/$archive --gzip \
        --nsInclude='$APP_DB.*' --nsFrom='$APP_DB.*' --nsTo='$TEST_DB.*' --stopOnError" 2>&1 | mask | tail -2
    mongosh_root "db.getSiblingDB('$APP_DB').grantRolesToUser('$(env_value "$BE_DIR/.env.offline" MONGO_APP_USERNAME)', [{role:'readWrite', db:'$TEST_DB'}]); print('granted readWrite on $TEST_DB')"
    ;;
  drop)
    mongosh_root "const r = db.getSiblingDB('$TEST_DB').dropDatabase(); printjson(r);
      db.getSiblingDB('$APP_DB').revokeRolesFromUser('$(env_value "$BE_DIR/.env.offline" MONGO_APP_USERNAME)', [{role:'readWrite', db:'$TEST_DB'}]);
      print('dropped $TEST_DB')"
    ;;
  *) echo "usage: $0 clone [archive] | drop" >&2; exit 2 ;;
esac
