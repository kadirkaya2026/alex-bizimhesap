#!/usr/bin/env bash
# Alex Bizimhesap — Railway otomatik kurulum (CLI)
# Ön koşul: railway login  VEYA  export RAILWAY_TOKEN=...
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "==> Alex Bizimhesap Railway kurulumu"
echo "    Dizin: $ROOT"

if ! command -v railway >/dev/null 2>&1; then
  echo "Hata: railway CLI yok. Kurulum: brew install railway"
  exit 1
fi

if ! railway whoami >/dev/null 2>&1; then
  echo ""
  echo "Railway oturumu yok."
  echo "  1) Terminalde: railway login"
  echo "  2) Veya: https://railway.app/account/tokens → token al → export RAILWAY_TOKEN=..."
  echo "  Sonra bu scripti tekrar çalıştırın: npm run railway:setup"
  exit 1
fi

echo "==> Giriş: $(railway whoami 2>/dev/null || true)"

if ! railway status >/dev/null 2>&1; then
  if [[ -n "${RAILWAY_PROJECT_ID:-}" ]]; then
    echo "==> Proje bağlanıyor: $RAILWAY_PROJECT_ID"
    railway link -p "$RAILWAY_PROJECT_ID"
  else
    echo ""
    echo "Bu klasör henüz Railway projesine bağlı değil."
    echo "  railway link   (listeden alex-bizimhesap projesini seçin)"
    echo "  veya: RAILWAY_PROJECT_ID=<id> npm run railway:setup"
    exit 1
  fi
fi

echo "==> Proje durumu:"
railway status

SERVICE="${RAILWAY_SERVICE:-alex-bizimhesap}"

echo "==> Hedef servis: $SERVICE"

echo "==> PostgreSQL ekleniyor (yoksa)..."
railway add --database postgres --json 2>/dev/null || echo "    (Postgres zaten var veya manuel ekleyin)"

WEBHOOK_TOKEN="${WEBHOOK_VERIFY_TOKEN:-}"
if [[ -z "$WEBHOOK_TOKEN" ]]; then
  WEBHOOK_TOKEN=$(openssl rand -hex 32)
fi

echo "==> Ortam değişkenleri..."
# Postgres servis adı projede "Postgres" olmalı (Railway varsayılanı)
railway variable set --service "$SERVICE" \
  "NODE_ENV=production" \
  "WEBHOOK_VERIFY_TOKEN=$WEBHOOK_TOKEN" \
  'DATABASE_URL=${{Postgres.DATABASE_URL}}' \
  "ALEX_ALLOWED_PHONES=${ALEX_ALLOWED_PHONES:-+905551234567}" \
  "TENANT_NAME=${TENANT_NAME:-Pilot Firma}" \
  "DEFAULT_TAX_RATE=20" \
  "DEFAULT_DUE_DAYS=30" \
  "DEFAULT_CURRENCY=TL" \
  "SKIP_WHATSAPP_SIGNATURE=false"

# Opsiyonel: kullanıcı .env'den aktarabilir
if [[ -f .env ]]; then
  echo "==> .env dosyasından secret aktarımı (varsa)..."
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "$line" ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in
      WHATSAPP_ACCESS_TOKEN|WHATSAPP_PHONE_NUMBER_ID|WHATSAPP_APP_SECRET|OPENAI_API_KEY|BIZIMHESAP_FIRM_ID|BIZIMHESAP_API_KEY|ALEX_ALLOWED_PHONES)
        if [[ -n "$val" && "$val" != *"xxxx"* && "$val" != "REPLACE"* ]]; then
          railway variable set --service "$SERVICE" "$key=$val" 2>/dev/null || true
        fi
        ;;
    esac
  done < <(grep -E '^(WHATSAPP_|OPENAI_|BIZIMHESAP_|ALEX_ALLOWED)' .env 2>/dev/null || true)
fi

echo "==> Public domain oluşturuluyor..."
DOMAIN_OUT=$(railway domain --service "$SERVICE" --json 2>/dev/null || railway domain --service "$SERVICE" 2>/dev/null || true)

echo ""
echo "============================================"
echo " Kurulum adımları tamamlandı (CLI)"
echo "============================================"
echo ""
echo "WEBHOOK_VERIFY_TOKEN (Meta ile aynı olmalı):"
echo "  $WEBHOOK_TOKEN"
echo ""
if [[ -n "$DOMAIN_OUT" ]]; then
  echo "Domain çıktısı:"
  echo "$DOMAIN_OUT"
fi
echo ""
echo "Manuel kontrol listesi:"
echo "  1) Railway → $SERVICE → Variables → WHATSAPP_*, OPENAI_*, BIZIMHESAP_* doldurun"
echo "  2) Deploy bitince: https://<domain>/health"
echo "  3) Railway shell: npm run db:seed"
echo "  4) Meta webhook: https://<domain>/webhooks/whatsapp"
echo ""
