#!/usr/bin/env bash
# Run the browser UI/UX audit (Ai_Turtor_FE/scripts/ux-audit.mjs) against the LAN address.
# Accounts: loadtest001 + the teacher/senior prepared by ux-accounts.js (copy DB only), admin from .env.deploy.
#   UX_ROLES=student,teacher scripts/loadtest/ux-run.sh
set -euo pipefail
BE="$(cd "$(dirname "$0")/../.." && pwd)"
source "$BE/scripts/offline/common.sh"
IP="$(ipconfig getifaddr en0 || echo localhost)"
OUT="$BE/loadtest-results/ux-$(date +%Y%m%dT%H%M%S)"
PW="${LOADTEST_PASSWORD:-Loadtest@123}"
AE="$(env_value "$BE/.env.deploy" ADMIN_ACCOUNT_EMAIL || true)"; AP="$(env_value "$BE/.env.deploy" ADMIN_ACCOUNT_PASSWORD || true)"
export UX_ACCOUNTS="$(python3 -I -c 'import json,sys; pw,ae,ap=sys.argv[1:4]; print(json.dumps({
 "student":{"email":"loadtest001@loadtest.local","password":pw},
 "teacher":{"email":"an.nguyen@university.edu","password":pw},
 "senior":{"email":"em.vo@university.edu","password":pw},
 "admin":{"email":ae or "admin@system.local","password":ap or "admin123"}}))' "$PW" "$AE" "$AP")"
export UX_BASE="${UX_BASE:-http://$IP}" UX_OUT="$OUT"
cd "$BE/../Ai_Turtor_FE"
node scripts/ux-audit.mjs
echo "results: $OUT"
