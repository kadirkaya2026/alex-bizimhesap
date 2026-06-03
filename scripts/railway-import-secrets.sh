#!/usr/bin/env bash
# Railway'e .env.railway.secrets dosyasındaki değişkenleri yükler (gitignore'da).
set -euo pipefail
cd "$(dirname "$0")/.."
SECRETS_FILE="${1:-.env.railway.secrets}"
SERVICE="${RAILWAY_SERVICE:-alex-bizimhesap}"
# Meta webhook accurate-analysis: a3b3d0fa-b151-4ca9-a6d2-327ad9d4a5b1
PROJECT="${RAILWAY_PROJECT_ID:-a3b3d0fa-b151-4ca9-a6d2-327ad9d4a5b1}"
ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"
RAILWAY_PROJECT_ARGS=(-p "$PROJECT" -e "$ENVIRONMENT")

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Dosya yok: $SECRETS_FILE"
  exit 1
fi

if ! railway whoami >/dev/null 2>&1; then
  echo "Önce: railway login"
  exit 1
fi

ARGS=()
while IFS= read -r line; do
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "${line// }" ]] && continue
  ARGS+=("$line")
done < "$SECRETS_FILE"

echo "==> Railway project=$PROJECT env=$ENVIRONMENT service=$SERVICE: ${#ARGS[@]} değişken"
railway variable set "${RAILWAY_PROJECT_ARGS[@]}" --service "$SERVICE" "${ARGS[@]}"
echo "==> Tamam. Deploy bitince: npm run logs:pull"
