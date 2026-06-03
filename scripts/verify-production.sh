#!/usr/bin/env bash
# Production smoke checks (plan: Railway log yorumu)
set -euo pipefail

BASE_URL="${BASE_URL:-https://alex-bizimhesap-production.up.railway.app}"
PASS=0
FAIL=0

ok() { echo "  OK  $1"; PASS=$((PASS + 1)); }
bad() { echo "  FAIL $1"; FAIL=$((FAIL + 1)); }

echo "==> Health: $BASE_URL/health"
HEALTH=$(curl -sS -w "%{http_code}" -o /tmp/alex-health.json "$BASE_URL/health" || echo "000")
if [[ "$HEALTH" == "200" ]] && grep -q '"ok":true' /tmp/alex-health.json && grep -q '"db":"up"' /tmp/alex-health.json; then
  ok "health 200, db up"
else
  bad "health check (HTTP $HEALTH)"
  cat /tmp/alex-health.json 2>/dev/null || true
fi

echo "==> Webhook security"
W403=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1")
W401=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/webhooks/whatsapp" -H "Content-Type: application/json" -d '{}')
[[ "$W403" == "403" ]] && ok "GET wrong verify token -> 403" || bad "GET verify expected 403 got $W403"
[[ "$W401" == "401" ]] && ok "POST without signature -> 401" || bad "POST signature expected 401 got $W401"

if command -v railway >/dev/null 2>&1 && railway whoami >/dev/null 2>&1; then
  echo "==> Railway status"
  RAILWAY_STATUS=$(railway status 2>&1 || true)
  echo "$RAILWAY_STATUS" | grep -qi 'online' && ok "service Online" || bad "service not Online"
  echo "==> Recent deploy logs (allowlist / started)"
  RAILWAY_LOGS=$(railway logs --service alex-bizimhesap 2>&1 || true)
  echo "$RAILWAY_LOGS" | grep -q "Allowlist: +905368592017" && ok "allowlist +905368592017 in logs" || bad "allowlist line not found in recent logs"
  echo "$RAILWAY_LOGS" | grep -q "alex-bizimhesap started" && ok "app started in logs" || bad "started line not found in recent logs"
  echo "==> Env keys (railway run — SET/MISSING, can differ from running container)"
  if [[ -f scripts/check-railway-env.mjs ]]; then
    railway run --service alex-bizimhesap -- node scripts/check-railway-env.mjs 2>/dev/null || true
  fi
else
  echo "  (skip Railway CLI checks — run: railway login)"
fi

echo ""
echo "==> Manual WhatsApp smoke (sizin telefonunuzdan)"
echo "  1) Alex hattına: merhaba  → yardım metni (yetkili değil olmamalı)"
echo "  2) eKatalox PDF linki veya PDF dosyası → önizleme"
echo "  3) ONAYLA → Bizimhesap (WHATSAPP_*, OPENAI_*, BIZIMHESAP_* Railway Variables dolu olmalı)"
echo ""
echo "Sonuç: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
