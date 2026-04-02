#!/bin/bash
# Runner para el crontab: valida que la API esté corriendo antes de desarrollar.

export PATH="$HOME/.bun/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEV_SH="$SCRIPT_DIR/dev.sh"
API_LOG="/tmp/api-dev.log"
API_URL="http://localhost:5555"

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

bash "$SCRIPT_DIR/desarrollar_proyectos.sh"
