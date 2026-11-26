#!/usr/bin/env bash
# Run a mongosh script file as root against the offline Mongo (output URIs masked).
#   scripts/loadtest/mongo-eval.sh FILE.js
source "$(dirname "$0")/../offline/common.sh"
JS="$(cat "$1")" ROOT_URI="$(local_root_uri)" docker run --rm --network "$(offline_network)" -e ROOT_URI -e JS "$MONGO_IMAGE" \
  sh -c 'mongosh --quiet "$ROOT_URI" --eval "$JS"' 2>&1 | mask
