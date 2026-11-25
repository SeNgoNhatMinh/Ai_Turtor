#!/usr/bin/env bash
# Read-only dump of tutor_db to backup/<source>_tutor_db_<timestamp>.archive.gz
# Usage: scripts/offline/dump.sh atlas|local
# Never writes to the source database.
source "$(dirname "$0")/common.sh"
SOURCE="${1:?usage: dump.sh atlas|local}"
TS="$(date +%Y%m%dT%H%M%S)"
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
NAME="${SOURCE}_${APP_DB}_${TS}.archive.gz"

case "$SOURCE" in
  atlas) export SRC_URI="$(atlas_uri)"; NET_ARGS=() ;;
  local) export SRC_URI="$(local_root_uri)"; NET_ARGS=(--network "$(offline_network)") ;;
  *) echo "unknown source $SOURCE" >&2; exit 2 ;;
esac

echo "Dumping $SOURCE/$APP_DB -> backup/$NAME"
docker run --rm ${NET_ARGS[@]+"${NET_ARGS[@]}"} -e SRC_URI -v "$BACKUP_DIR":/backup "$MONGO_IMAGE" \
  sh -c "mongodump --uri=\"\$SRC_URI\" --db=$APP_DB --archive=/backup/$NAME --gzip" \
  2>&1 | mask | tee "$BACKUP_DIR/$NAME.dump.log"

# Integrity: gzip stream + mongorestore dry run (parses every BSON document, writes nothing).
verify_archive "$NAME"
(cd "$BACKUP_DIR" && shasum -a 256 "$NAME" > "$NAME.sha256")
chmod 600 "$BACKUP_DIR/$NAME" "$BACKUP_DIR/$NAME.sha256"
echo "OK: $BACKUP_DIR/$NAME ($(du -h "$BACKUP_DIR/$NAME" | cut -f1))"
echo "$BACKUP_DIR/$NAME" > "$BACKUP_DIR/LATEST_${SOURCE}"
