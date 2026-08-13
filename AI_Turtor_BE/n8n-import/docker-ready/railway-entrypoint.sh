#!/bin/sh
set -eu

# Railway mounts a new volume as root. n8n runs as the unprivileged `node`
# user, so grant that user ownership before n8n creates its config/database.
N8N_DATA_DIR="/home/node/.n8n"
WORKFLOW_SOURCE_DIR="/opt/ai-tutor-workflows"
WORKFLOW_IMPORT_DIR="/tmp/ai-tutor-workflows"
WORKFLOW_BUNDLE_VERSION="20260814-1"
WORKFLOW_MARKER="$N8N_DATA_DIR/.ai-tutor-workflows-$WORKFLOW_BUNDLE_VERSION"
BACKEND_BASE_URL="${AI_TUTOR_API_BASE_URL:-http://ai-tutor-api:8085}"

echo "AI Tutor n8n Railway entrypoint: preparing persistent data directory"
mkdir -p "$N8N_DATA_DIR"
chown -R node:node "$N8N_DATA_DIR"
chmod 0700 "$N8N_DATA_DIR"

export HOME="/home/node"
export USER="node"
export LOGNAME="node"

if [ ! -f "$WORKFLOW_MARKER" ]; then
  echo "AI Tutor n8n Railway entrypoint: importing bundled workflows"
  rm -rf "$WORKFLOW_IMPORT_DIR"
  mkdir -p "$WORKFLOW_IMPORT_DIR"
  cp "$WORKFLOW_SOURCE_DIR"/*.json "$WORKFLOW_IMPORT_DIR"/
  sed -i "s|http://ai-tutor-api:8085|$BACKEND_BASE_URL|g" "$WORKFLOW_IMPORT_DIR"/*.json
  chown -R node:node "$WORKFLOW_IMPORT_DIR"

  for workflow_file in "$WORKFLOW_IMPORT_DIR"/*.json; do
    echo "AI Tutor n8n Railway entrypoint: importing $(basename "$workflow_file")"
    su -p node -s /bin/sh -c 'exec n8n import:workflow --input="$0"' "$workflow_file"
  done

  for workflow_id in \
    bdFmRV9u8BFGBfpL \
    AI_TUTOR_TEACHER_AI_GRADING \
    AI_TUTOR_V2_PROACTIVE; do
    echo "AI Tutor n8n Railway entrypoint: publishing $workflow_id"
    su -p node -s /bin/sh -c 'exec n8n publish:workflow --id="$0"' "$workflow_id"
  done

  touch "$WORKFLOW_MARKER"
  chown node:node "$WORKFLOW_MARKER"
  rm -rf "$WORKFLOW_IMPORT_DIR"
fi

echo "AI Tutor n8n Railway entrypoint: starting n8n as node (uid 1000)"

if [ "$#" -gt 0 ]; then
  exec su -p node -s /bin/sh -c 'exec /docker-entrypoint.sh "$0" "$@"' "$@"
fi

exec su -p node -s /bin/sh -c 'exec /docker-entrypoint.sh'
