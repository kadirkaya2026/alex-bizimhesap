#!/usr/bin/env bash
# Pull recent alex-bizimhesap logs to logs/railway-recent.log (requires railway login)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
if ! railway whoami >/dev/null 2>&1; then
  echo "Önce: railway login"
  exit 1
fi
railway logs --service alex-bizimhesap 2>&1 | tee logs/railway-recent.log
echo "Kaydedildi: logs/railway-recent.log"
