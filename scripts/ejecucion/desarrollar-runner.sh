#!/bin/bash
# Comprueba que la API esté corriendo en el entorno correcto,
# la levanta/reinicia si hace falta, y ejecuta el pipeline de desarrollo.
# Uso: ./desarrollar-runner.sh [staging|pro]  (default: staging)

export PATH="$HOME/.bun/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEV_SH="$SCRIPT_DIR/dev.sh"
API_LOG="/tmp/api-dev.log"
ENV="${1:-staging}"

source "$SCRIPT_DIR/api-env-lib.sh"

CRON_SECRET=$(grep "^CRON_SECRET=" "$REPO_ROOT/apps/api/.env.local" 2>/dev/null \
  | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

ensure_api_env "$ENV"

# ─── Registrar inicio de ejecución ───────────────────────────────────────────
RUN_ID=$(curl -s -X POST "$API_URL/api/cron/log/start" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"runner\":\"desarrollar-runner ($ENV)\"}" \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try{ console.log(JSON.parse(d).id ?? '') }catch{ console.log('') } })")

echo "[desarrollar-runner] entorno=$ENV run_id=${RUN_ID}"

bash "$SCRIPT_DIR/desarrollar_proyectos.sh" "$RUN_ID" "$ENV"

curl -s -X POST "$API_URL/api/cron/log/finish" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"runId\":\"$RUN_ID\"}" > /dev/null

echo "[desarrollar-runner] Ejecución registrada (run_id=${RUN_ID})"
