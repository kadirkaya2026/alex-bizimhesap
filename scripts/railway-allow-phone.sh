#!/usr/bin/env bash
# Pilot numarayı Railway allowlist + DB seed'e ekler.
# Ön koşul: railway login && railway link (veya proje zaten bağlı)
set -euo pipefail

cd "$(dirname "$0")/.."
PHONE="${1:-+905368592017}"
SERVICE="${RAILWAY_SERVICE:-alex-bizimhesap}"

if ! railway whoami >/dev/null 2>&1; then
  echo "Önce: railway login"
  exit 1
fi

echo "==> Railway ALEX_ALLOWED_PHONES=$PHONE"
railway variable set --service "$SERVICE" "ALEX_ALLOWED_PHONES=$PHONE"

echo "==> Redeploy (container içinde migrate + seed çalışır)"
railway redeploy --service "$SERVICE" --yes 2>/dev/null || railway redeploy --service "$SERVICE"

echo "==> Deploy logları (seed: Allowlist satırı arayın)"
sleep 8
railway logs --service "$SERVICE" 2>&1 | tail -40

echo "Tamam. WhatsApp'tan test mesajı gönderin."
