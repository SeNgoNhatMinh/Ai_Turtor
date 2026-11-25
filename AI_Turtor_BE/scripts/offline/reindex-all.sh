#!/usr/bin/env bash
# Re-embed every course's materials with the local embedding model into the
# offline Elasticsearch index. Required once after switching embedding model.
# Uses the admin account from .env.deploy (never printed).
# Materials are keyed by the course code (e.g. PRJ301), not the course document id.
# Usage: scripts/offline/reindex-all.sh [api_base]   (default http://localhost:8085)
source "$(dirname "$0")/common.sh"
API="${1:-http://localhost:8085}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

EMAIL="$(env_value "$BE_DIR/.env.deploy" ADMIN_ACCOUNT_EMAIL || true)"
PASS="$(env_value "$BE_DIR/.env.deploy" ADMIN_ACCOUNT_PASSWORD || true)"
python3 -I -c 'import json,sys;print(json.dumps({"email":sys.argv[1],"password":sys.argv[2]}))' \
  "${EMAIL:-admin@system.local}" "${PASS:-admin123}" > "$TMP/login.json"
curl -sf -H 'Content-Type: application/json' --data @"$TMP/login.json" "$API/api/users/login" > "$TMP/login_resp.json"
TOKEN="$(python3 -I -c '
import json,sys
def f(o):
    if isinstance(o,dict):
        for k,v in o.items():
            if k in ("accessToken","token") and isinstance(v,str): return v
            r=f(v)
            if r: return r
print(f(json.load(open(sys.argv[1]))) or "")' "$TMP/login_resp.json")"
[[ -n "$TOKEN" ]] || { echo "Admin login failed" >&2; exit 1; }

curl -sf -H "Authorization: Bearer $TOKEN" "$API/api/courses" > "$TMP/courses.json"
python3 -I -c '
import json,sys
for c in json.load(open(sys.argv[1])): print(c["id"], c.get("courseId",""))' "$TMP/courses.json" > "$TMP/ids.txt"
echo "Courses: $(wc -l < "$TMP/ids.txt" | tr -d ' ')"

while read -r id code; do
  start=$(date +%s)
  code_http=$(curl -s -o "$TMP/r.json" -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" \
    "$API/api/courses/$code/materials/reindex")
  echo "[$code] HTTP $code_http in $(( $(date +%s) - start ))s: $(head -c 300 "$TMP/r.json")"
done < "$TMP/ids.txt"

curl -sf -X POST -H "Authorization: Bearer $TOKEN" "$API/api/admin/materials/reindex-approved-knowledge" \
  -o "$TMP/k.json" -w 'approved knowledge HTTP %{http_code}\n' || true
