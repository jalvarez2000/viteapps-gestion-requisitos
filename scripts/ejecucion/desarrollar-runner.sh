#!/bin/bash
# Runner para el crontab: valida que la API esté corriendo antes de desarrollar.

export PATH="$HOME/.bun/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEV_SH="$SCRIPT_DIR/dev.sh"
API_LOG="/tmp/api-dev.log"
API_URL="http://localhost:5555"

CRON_SECRET=$(grep "^CRON_SECRET=" "$REPO_ROOT/apps/api/.env.local" 2>/dev/null \
  | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

api_ready() {
  curl -s --max-time 2 "$API_URL" > /dev/null 2>&1
}

if ! api_ready; then
  echo "[desarrollar-runner] API no está corriendo. Levantando..."
  nohup bash "$DEV_SH" api >> "$API_LOG" 2>&1 &

  for i in $(seq 1 30); do
    sleep 2
    if api_ready; then
      echo "[desarrollar-runner] API lista tras $((i * 2))s."
      break
    fi
    if [[ $i -eq 30 ]]; then
      echo "[desarrollar-runner] ERROR: El API no respondió tras 60s. Abortando."
      exit 1
    fi
  done
else
  echo "[desarrollar-runner] API ya está corriendo."
fi

# ─── Registrar inicio de ejecución ───────────────────────────────────────────
RUN_ID=$(curl -s -X POST "$API_URL/api/cron/log/start" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"runner":"desarrollar-runner"}' \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try{ console.log(JSON.parse(d).id ?? '') }catch{ console.log('') } })")

echo "[desarrollar-runner] run_id=${RUN_ID}"

bash "$SCRIPT_DIR/desarrollar_proyectos.sh" "$RUN_ID"

curl -s -X POST "$API_URL/api/cron/log/finish" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"runId\":\"$RUN_ID\"}" > /dev/null

echo "[desarrollar-runner] Ejecución registrada (run_id=${RUN_ID})"
