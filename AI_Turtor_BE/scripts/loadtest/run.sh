#!/usr/bin/env bash
# Run the chaos load test with k6 in Docker against the frontend proxy (port 80),
# i.e. the same path LAN clients use. Results land in loadtest-results/<timestamp>/.
#   VUS=500 HOLD=5m RAMP=2m AI_SHARE=0.2 scripts/loadtest/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
docker exec ai-tutor-api sh -c 'case "$SPRING_DATA_MONGODB_URI" in *tutor_db_loadtest*) ;; *) exit 1;; esac' \
  || { echo "ai-tutor-api is not on tutor_db_loadtest; start it with scripts/loadtest/compose.sh up -d ai-tutor-api" >&2; exit 1; }
OUT="loadtest-results/$(date +%Y%m%dT%H%M%S)"
mkdir -p "$OUT"
cp scripts/loadtest/endpoints.json loadtest-results/id-pool.json loadtest-results/users.json "$OUT/"
docker run --rm -i --add-host=host.docker.internal:host-gateway \
  -e BASE_URL="${BASE_URL:-http://host.docker.internal}" -e VUS="${VUS:-500}" -e HOLD="${HOLD:-5m}" \
  -e RAMP="${RAMP:-2m}" -e AI_SHARE="${AI_SHARE:-0.2}" \
  -v "$PWD/scripts/loadtest/chaos.js:/work/chaos.js:ro" -v "$PWD/$OUT:/results" -w /results \
  grafana/k6:0.54.0 run --quiet --no-color --console-output=/results/findings.log \
  --summary-export=/results/k6-summary.json /work/chaos.js 2>&1 | tee "$OUT/k6-stdout.log" | tail -60
echo "results: $OUT"
