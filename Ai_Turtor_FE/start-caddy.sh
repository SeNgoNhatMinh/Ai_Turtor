#!/bin/sh
set -eu

PORT="${PORT:-8080}"
echo "caddy listening on 0.0.0.0:${PORT}"

forward() {
  extra="$1"
  if [ "${extra}" = "${PORT}" ]; then
    return 0
  fi
  echo "forward 0.0.0.0:${extra} -> 127.0.0.1:${PORT}"
  socat TCP-LISTEN:"${extra}",bind=0.0.0.0,fork,reuseaddr TCP:127.0.0.1:"${PORT}" &
}

# Railway public domains often pin 80/3000/8080 while $PORT is different.
forward 80 || true
forward 3000 || true
forward 8080 || true

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
