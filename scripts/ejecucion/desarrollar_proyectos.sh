#!/bin/bash
# Obtiene proyectos en ENTORNO_CONSTRUIDO, los pasa a CREANDO_CODIGO
# y lanza un agente Claude Code por proyecto en paralelo.
# Al terminar cada agente, actualiza el estado a CODIGO_CREADO (o deja en CREANDO_CODIGO si hay error).
# Uso: desarrollar_proyectos.sh [RUN_ID]

set -euo pipefail

export PATH="$HOME/.bun/bin:$PATH"
export PATH="/usr/local/bin:$PATH"   # asegura que claude esté en PATH

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_URL="http://localhost:5555"
LOG_DIR="/tmp/claude-dev"
RUN_ID="${1:-}"
ENV="${2:-staging}"

echo "[desarrollar] entorno=$ENV run_id=${RUN_ID:-none}"

CRON_SECRET=$(grep "^CRON_SECRET=" "$REPO_ROOT/apps/api/.env.local" 2>/dev/null \
  | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

mkdir -p "$LOG_DIR"

log_entry() {
  local code="$1"
  local status="$2"
  local log_file="$3"

  if [[ -z "$RUN_ID" ]]; then
    return
  fi

  local log_content=""
  if [[ -f "$log_file" ]]; then
    # Limitar a los últimos 10000 caracteres para no saturar la BD
    log_content="$(tail -c 10000 "$log_file" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.stringify(d)))")"
  fi

  local body="{\"runId\":\"$RUN_ID\",\"projectCode\":\"$code\",\"status\":\"$status\",\"log\":$log_content}"
  curl -s -X POST "$API_URL/api/cron/log/entry" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    -d "$body" > /dev/null
}

# ─── 1. Obtener proyectos y pasar a CREANDO_CODIGO ───────────────────────────
echo "[desarrollar] Consultando proyectos en ENTORNO_CONSTRUIDO..."
RESPONSE=$(curl -s "$API_URL/api/cron/desarrollar" \
  -H "Authorization: Bearer ${CRON_SECRET}")

PROJECTS=$(echo "$RESPONSE" | node -e "
  let data = '';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    const json = JSON.parse(data);
    (json.projects || []).forEach(p => console.log(p.id + ' ' + p.code));
  });
")

if [[ -z "$PROJECTS" ]]; then
  echo "[desarrollar] No hay proyectos en ENTORNO_CONSTRUIDO."
  exit 0
fi

echo "[desarrollar] Proyectos a desarrollar:"
echo "$PROJECTS"

# ─── 2. Lanzar agente Claude en paralelo por proyecto ────────────────────────
PROMPT_BASE="Eres un desarrollador experto en aplicaciones web con Vite + React + TypeScript.
Tu tarea es implementar completamente todos los requisitos funcionales descritos en el fichero
requirements/USER_REQUIREMENTS.txt de este proyecto.

Sigue este proceso:
1. Lee requirements/USER_REQUIREMENTS.txt para entender qué hay que implementar.
2. Analiza la estructura del proyecto existente.
3. Implementa cada requisito de forma ordenada.
4. Asegúrate de que la aplicación compila sin errores (ejecuta el build si es necesario).
5. Verifica que no hay errores evidentes de funcionalidad.

Continúa trabajando hasta que TODO esté implementado y funcionando correctamente.
No te detengas hasta haber completado todos los requisitos."

declare -a PIDS=()
declare -a IDS=()
declare -a CODES=()
declare -a LOGS=()

while IFS=' ' read -r PROJECT_ID PROJECT_CODE; do
  PROJECT_DIR="$REPO_ROOT/viteapps-projects/$PROJECT_CODE"
  LOG_FILE="$LOG_DIR/${PROJECT_CODE}-$(date +%Y%m%d-%H%M%S).log"

  if [[ ! -d "$PROJECT_DIR" ]]; then
    echo "[desarrollar] WARN: directorio $PROJECT_DIR no encontrado. Saltando."
    continue
  fi

  echo "[desarrollar] Lanzando agente para $PROJECT_CODE → $PROJECT_DIR"

  (
    cd "$PROJECT_DIR"
    claude --dangerously-skip-permissions \
      --output-format text \
      -p "$PROMPT_BASE" \
      >> "$LOG_FILE" 2>&1
  ) &

  PIDS+=($!)
  IDS+=("$PROJECT_ID")
  CODES+=("$PROJECT_CODE")
  LOGS+=("$LOG_FILE")
done <<< "$PROJECTS"

# ─── 3. Esperar y actualizar estados ─────────────────────────────────────────
echo "[desarrollar] Esperando a que terminen ${#PIDS[@]} agente(s)..."

for i in "${!PIDS[@]}"; do
  PID="${PIDS[$i]}"
  ID="${IDS[$i]}"
  CODE="${CODES[$i]}"
  LOG_FILE="${LOGS[$i]}"

  if wait "$PID"; then
    SUCCESS="true"
    echo "[desarrollar] $CODE completado con éxito."

    PROJECT_DIR="$REPO_ROOT/viteapps-projects/$CODE"
    echo "[desarrollar] $CODE — commiteando cambios en GitHub..."
    gh auth setup-git
    git -C "$PROJECT_DIR" add -A
    if git -C "$PROJECT_DIR" diff --cached --quiet; then
      echo "[desarrollar] $CODE — sin cambios que commitear."
    else
      git -C "$PROJECT_DIR" commit -m "feat: implementación de requisitos"
      git -C "$PROJECT_DIR" push
      echo "[desarrollar] $CODE — cambios subidos a GitHub."
    fi

    log_entry "$CODE" "OK" "$LOG_FILE"
  else
    SUCCESS="false"
    echo "[desarrollar] $CODE terminó con error. Revisa $LOG_FILE"
    log_entry "$CODE" "ERROR" "$LOG_FILE"
  fi

  curl -s -X POST "$API_URL/api/cron/desarrollar/complete" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$ID\",\"success\":$SUCCESS}" > /dev/null
done

echo "[desarrollar] Proceso completado. Logs en $LOG_DIR/"
