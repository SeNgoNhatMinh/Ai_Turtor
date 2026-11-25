#!/usr/bin/env bash
# Restore an archive into the OFFLINE local MongoDB only. Never uses --drop.
# Usage: scripts/offline/restore-local.sh [archive.gz]   (default: latest Atlas dump)
# Refuses to run if tutor_db already contains documents (to avoid mixing data).
source "$(dirname "$0")/common.sh"
ARCHIVE="${1:-$(cat "$BACKUP_DIR/LATEST_atlas")}"
[[ -f "$ARCHIVE" ]] || { echo "Archive not found: $ARCHIVE" >&2; exit 1; }
(cd "$(dirname "$ARCHIVE")" && shasum -a 256 -c "$(basename "$ARCHIVE").sha256")

export DST_URI="$(local_root_uri)"
[[ "$DST_URI" != *mongodb.net* && "$DST_URI" == *"@mongodb:27017"* ]] || { echo "Refusing: target is not the local offline Mongo" >&2; exit 1; }
NET="$(offline_network)"

EXISTING="$(docker run --rm --network "$NET" -e DST_URI "$MONGO_IMAGE" \
  mongosh "$DST_URI" --quiet --eval "let n=0; db.getSiblingDB('$APP_DB').getCollectionNames().forEach(c=>n+=db.getSiblingDB('$APP_DB').getCollection(c).estimatedDocumentCount()); print(n)")"
if [[ "$EXISTING" != "0" && "${ALLOW_NON_EMPTY:-}" != "yes" ]]; then
  echo "Refusing: local $APP_DB already has $EXISTING documents. Take a local dump first; see docs." >&2
  exit 1
fi

BASENAME="$(basename "$ARCHIVE")"
docker run --rm --network "$NET" -e DST_URI -v "$(dirname "$ARCHIVE")":/backup:ro "$MONGO_IMAGE" \
  sh -c "mongorestore --uri=\"\$DST_URI\" --archive=/backup/$BASENAME --gzip --nsInclude='$APP_DB.*' --stopOnError" \
  2>&1 | mask | tee "$BACKUP_DIR/$BASENAME.restore.log" | tail -4
