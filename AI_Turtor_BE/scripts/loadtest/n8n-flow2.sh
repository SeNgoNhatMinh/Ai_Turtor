#!/usr/bin/env bash
# Switch n8n "Flow 2" (student chat) between the cloud Groq model and local Ollama.
#   scripts/loadtest/n8n-flow2.sh cloud   original workflow (Groq credential "Groq account")
#   scripts/loadtest/n8n-flow2.sh local   offline workflow (Ollama gemma3:4b)
# Both files are the exports kept in backup/n8n/. n8n is restarted to load the change.
set -euo pipefail
cd "$(dirname "$0")/../.."
case "${1:-}" in
  cloud) file=backup/n8n/lxdFNHkMqxIGkyf5.json ;;
  local) file=backup/n8n/flow2_gemma3_4b.json ;;
  *) echo "usage: $0 cloud|local" >&2; exit 2 ;;
esac
docker cp -q "$file" ai-tutor-n8n:/tmp/flow2.json
docker exec ai-tutor-n8n n8n import:workflow --input=/tmp/flow2.json 2>&1 | grep -E "imported|rror" || true
docker exec ai-tutor-n8n n8n publish:workflow --id=lxdFNHkMqxIGkyf5 >/dev/null 2>&1 || true
docker restart ai-tutor-n8n >/dev/null
for i in $(seq 1 30); do docker logs --since 60s ai-tutor-n8n 2>&1 | grep -q 'Activated workflow "AI tutor - Flow 2' && break; sleep 2; done
docker logs --since 60s ai-tutor-n8n 2>&1 | grep -E 'Activated workflow' | sed 's/^/  /'
