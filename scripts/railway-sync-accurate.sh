#!/usr/bin/env bash
# accurate-analysis projesine secret + DB sync (Meta webhook burada)
set -euo pipefail
cd "$(dirname "$0")/.."

export RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-a3b3d0fa-b151-4ca9-a6d2-327ad9d4a5b1}"
export RAILWAY_ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"
export RAILWAY_SERVICE="${RAILWAY_SERVICE:-alex-bizimhesap}"

echo "==> Proje: accurate-analysis ($RAILWAY_PROJECT_ID)"
echo "==> 1/3 DATABASE_URL düzelt"
npm run railway:fix-db
echo "==> 2/3 Secret import (.env.railway.secrets)"
npm run railway:import-secrets
echo "==> 3/4 Redeploy"
railway redeploy -p "$RAILWAY_PROJECT_ID" -e "$RAILWAY_ENVIRONMENT" -s "$RAILWAY_SERVICE" -y
echo "==> 4/4 WhatsApp token (Railway env)"
railway run -p "$RAILWAY_PROJECT_ID" -e "$RAILWAY_ENVIRONMENT" -s "$RAILWAY_SERVICE" -- node scripts/verify-whatsapp-token.mjs || true
echo ""
echo "==> Doğrulama:"
echo "curl https://alex-bizimhesap-production-c144.up.railway.app/health"
echo "Beklenen: whatsapp.graphApiOk=true, firmIdSuffix=90C5"
