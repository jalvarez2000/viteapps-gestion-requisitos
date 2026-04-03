#!/bin/bash
# Comprueba que la API esté corriendo en el entorno correcto,
# la levanta/reinicia si hace falta, y ejecuta el cron-status.
# Uso: ./cron-status-runner.sh [staging|pro]  (default: staging)

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
  -d "{\"runner\":\"cron-status-runner ($ENV)\"}" \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try{ console.log(JSON.parse(d).id ?? '') }catch{ console.log('') } })")

echo "[cron-status-runner] entorno=$ENV run_id=${RUN_ID}"

# ─── Ejecutar cron-status y capturar resultado ────────────────────────────────
RESPONSE=$(curl -s --max-time 300 "$API_URL/api/cron/projects-status" \
  -H "Authorization: Bearer ${CRON_SECRET}")

echo "[cron-status-runner] Respuesta: $RESPONSE"

# ─── Registrar entrada por proyecto ──────────────────────────────────────────
if [[ -n "$RUN_ID" ]]; then
  echo "$RESPONSE" | node -e "
    let d = '';
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      try {
        const json = JSON.parse(d);
        (json.results || []).forEach(r => {
          const status = r.error ? 'ERROR' : 'OK';
          const logText = r.error || '';
          const body = JSON.stringify({ runId: '$RUN_ID', projectCode: r.code, status, log: logText });
          require('child_process').execSync(
            \`curl -s -X POST '$API_URL/api/cron/log/entry' -H 'Authorization: Bearer $CRON_SECRET' -H 'Content-Type: application/json' -d '\${body.replace(/'/g, \"'\\\\''\")}'\`
          );
        });
      } catch(e) { console.error('Error parsing response:', e.message); }
    });
  "

  curl -s -X POST "$API_URL/api/cron/log/finish" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    -d "{\"runId\":\"$RUN_ID\"}" > /dev/null

  echo "[cron-status-runner] Ejecución registrada (run_id=${RUN_ID})"
fi
