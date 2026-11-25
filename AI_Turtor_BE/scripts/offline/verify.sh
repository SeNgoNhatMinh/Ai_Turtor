#!/usr/bin/env bash
# Compare Atlas vs local offline Mongo (read-only on both sides).
# Usage: scripts/offline/verify.sh
source "$(dirname "$0")/common.sh"
OUT="$BACKUP_DIR/verify_$(date +%Y%m%dT%H%M%S)"; mkdir -p "$OUT"
export SRC_URI="$(atlas_uri)" DST_URI="$(local_root_uri)"

docker run --rm -e SRC_URI -e DBNAME="$APP_DB" -v "$SCRIPTS_DIR":/s:ro "$MONGO_IMAGE" \
  sh -c 'mongosh "$SRC_URI" --quiet --file /s/fingerprint.js' > "$OUT/atlas.json"
docker run --rm --network "$(offline_network)" -e DST_URI -e DBNAME="$APP_DB" -v "$SCRIPTS_DIR":/s:ro "$MONGO_IMAGE" \
  sh -c 'mongosh "$DST_URI" --quiet --file /s/fingerprint.js' > "$OUT/local.json"

python3 -I - "$OUT/atlas.json" "$OUT/local.json" <<'PY'
import json, sys
a, l = (json.load(open(p)) for p in sys.argv[1:3])
bad = 0
for name in sorted(set(a) | set(l)):
    x, y = a.get(name), l.get(name)
    if x is None or y is None:
        print(f"MISSING  {name}: atlas={'yes' if x else 'no'} local={'yes' if y else 'no'}"); bad += 1; continue
    issues = [k for k in ("count", "sha256", "indexes", "validator") if x[k] != y[k]]
    status = "OK      " if not issues else "DIFF    "
    bad += bool(issues)
    print(f"{status}{name}: atlas={x['count']} local={y['count']}" + (f"  differs: {','.join(issues)}" if issues else ""))
ta, tl = sum(v["count"] for v in a.values()), sum(v["count"] for v in l.values())
print(f"\ncollections atlas={len(a)} local={len(l)}  documents atlas={ta} local={tl}  mismatched={bad}")
sys.exit(1 if bad else 0)
PY
