#!/bin/sh
set -eu

PORT="${PORT:-3000}"
if [ "${PORT}" = "80" ]; then
  CADDY_SITE="http://:80"
else
  # Railway's Caddy base image exposes 80. Listen there too so a
  # mis-detected target port still reaches the SPA.
  CADDY_SITE="http://:${PORT}, http://:80"
fi
export CADDY_SITE

echo "caddy site=${CADDY_SITE}"
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
