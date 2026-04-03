#!/bin/bash
# Comprueba si el API está corriendo en :5555.
# Si no, lo levanta y espera hasta que esté listo.
# Luego ejecuta el cron-status y registra la ejecución en BD.

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
  echo "[cron-status-runner] API no está corriendo. Levantando..."
  nohup bash "$DEV_SH" api >> "$API_LOG" 2>&1 &

  echo "[cron-status-runner] Esperando a que el API esté lista..."
  for i in $(seq 1 30); do
    sleep 2
    if api_ready; then
      echo "[cron-status-runner] API lista tras $((i * 2))s."
      break
    fi
    if [[ $i -eq 30 ]]; then
      echo "[cron-status-runner] ERROR: El API no respondió tras 60s. Abortando."
      exit 1
    fi
  done
else
  echo "[cron-status-runner] API ya está corriendo."
fi

# ─── Registrar inicio de ejecución ───────────────────────────────────────────
RUN_ID=$(curl -s -X POST "$API_URL/api/cron/log/start" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"runner":"cron-status-runner"}' \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try{ console.log(JSON.parse(d).id ?? '') }catch{ console.log('') } })")

echo "[cron-status-runner] run_id=${RUN_ID}"

# ─── Ejecutar cron-status y capturar resultado ────────────────────────────────
RESPONSE=$(curl -s "$API_URL/api/cron/projects-status" \
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
