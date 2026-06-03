#!/usr/bin/env bash
# Bizimhesap FirmID + API key → Railway variables
# Kullanım: npm run railway:bizimhesap -- <FIRM_ID> <API_KEY>
set -euo pipefail
cd "$(dirname "$0")/.."
SERVICE="${RAILWAY_SERVICE:-alex-bizimhesap}"
PROJECT="${RAILWAY_PROJECT_ID:-a3b3d0fa-b151-4ca9-a6d2-327ad9d4a5b1}"
ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"
RAILWAY_PROJECT_ARGS=(-p "$PROJECT" -e "$ENVIRONMENT")

FIRM_ID="${1:-}"
API_KEY="${2:-}"

if [[ -z "$FIRM_ID" || -z "$API_KEY" ]]; then
  echo "Kullanım: npm run railway:bizimhesap -- <BIZIMHESAP_FIRM_ID> <BIZIMHESAP_API_KEY>"
  exit 1
fi

if ! railway whoami >/dev/null 2>&1; then
  echo "Önce: railway login"
  exit 1
fi

echo "==> Bizimhesap variables project=$PROJECT service=$SERVICE"
railway variable set "${RAILWAY_PROJECT_ARGS[@]}" --service "$SERVICE" \
  "BIZIMHESAP_FIRM_ID=$FIRM_ID" \
  "BIZIMHESAP_API_KEY=$API_KEY"

echo "==> Tamam. Redeploy sonrası seed tenant güncellenir."
echo "Yerel test: .env doldurup npm run test:addinvoice"
