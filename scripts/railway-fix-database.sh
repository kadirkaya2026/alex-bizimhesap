#!/usr/bin/env bash
# accurate-analysis (veya bağlı proje): localhost DATABASE_URL düzeltmesi
set -euo pipefail
cd "$(dirname "$0")/.."
SERVICE="${RAILWAY_SERVICE:-alex-bizimhesap}"
PROJECT="${RAILWAY_PROJECT_ID:-a3b3d0fa-b151-4ca9-a6d2-327ad9d4a5b1}"
ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"
RAILWAY_PROJECT_ARGS=(-p "$PROJECT" -e "$ENVIRONMENT")

if ! railway whoami >/dev/null 2>&1; then
  echo "Önce: railway login"
  exit 1
fi

echo "==> Hedef proje ID: $PROJECT (env=$ENVIRONMENT)"
echo "==> DATABASE_URL → Postgres referansı (Postgres servisi gerekli)"
railway variable set "${RAILWAY_PROJECT_ARGS[@]}" --service "$SERVICE" \
  'DATABASE_URL=${{Postgres.DATABASE_URL}}' \
  "NODE_ENV=production" \
  "SKIP_WHATSAPP_SIGNATURE=false"

echo ""
echo "Postgres yoksa Railway panel: + New → Database → PostgreSQL"
echo "Sonra: npm run railway:import-secrets && redeploy"
