#!/bin/sh
set -eu

# Railway mounts a new volume as root. n8n runs as the unprivileged `node`
# user, so grant that user ownership before n8n creates its config/database.
N8N_DATA_DIR="/home/node/.n8n"

mkdir -p "$N8N_DATA_DIR"
chown -R node:node "$N8N_DATA_DIR"
chmod 0700 "$N8N_DATA_DIR"

export HOME="/home/node"
export USER="node"
export LOGNAME="node"

if [ "$#" -gt 0 ]; then
  exec su -p node -s /bin/sh -c 'exec /docker-entrypoint.sh "$0" "$@"' "$@"
fi

exec su -p node -s /bin/sh -c 'exec /docker-entrypoint.sh'
