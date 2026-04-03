#!/bin/bash
# Librería compartida para gestionar el entorno (staging/pro) de la API.
# Sourcear desde los runners: source "$(dirname "$0")/api-env-lib.sh"
#
# Función disponible:
#   ensure_api_env <staging|pro>

API_URL="http://localhost:5555"
SENTINEL="/tmp/api-current-env"
LOCK_DIR="/tmp/api-env-lock.dir"

api_ready() {
  curl -s --max-time 2 "$API_URL" > /dev/null 2>&1
}

_acquire_lock() {
  local waited=0
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    sleep 1
    waited=$((waited + 1))
    if [[ $waited -ge 90 ]]; then
      echo "[api-env] ERROR: timeout esperando el lock. Abortando."
      return 1
    fi
  done
  return 0
}

_release_lock() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

ensure_api_env() {
  local env_name="${1:-staging}"
  local env_file="$REPO_ROOT/apps/api/.env.local.$env_name"

  if [[ ! -f "$env_file" ]]; then
    echo "[api-env] ERROR: no existe $env_file"
    return 1
  fi

  # Caso rápido: API corriendo con el entorno correcto (sin lock)
  if api_ready; then
    local current=""
    [[ -f "$SENTINEL" ]] && current="$(cat "$SENTINEL")"
    if [[ "$current" == "$env_name" ]]; then
      echo "[api-env] API ya corriendo en $env_name."
      return 0
    fi
  fi

  # Necesitamos cambiar o levantar la API — adquirir lock
  _acquire_lock || return 1

  # Re-verificar tras adquirir el lock (otro runner puede haberlo resuelto ya)
  if api_ready; then
    local current=""
    [[ -f "$SENTINEL" ]] && current="$(cat "$SENTINEL")"
    if [[ "$current" == "$env_name" ]]; then
      echo "[api-env] API ya corriendo en $env_name (resuelta por otro proceso)."
      _release_lock
      return 0
    fi
    echo "[api-env] API corriendo en '${current:-desconocido}', necesito '$env_name'. Reiniciando..."
    local pid
    pid=$(lsof -ti:5555 2>/dev/null || true)
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
      sleep 3
      if api_ready; then
        kill -9 "$pid" 2>/dev/null || true
        sleep 2
      fi
    fi
  else
    echo "[api-env] API no está corriendo. Levantando con entorno '$env_name'..."
  fi

  cp "$env_file" "$REPO_ROOT/apps/api/.env.local"
  echo "$env_name" > "$SENTINEL"
  nohup bash "$DEV_SH" api >> "$API_LOG" 2>&1 &

  _release_lock

  echo "[api-env] Esperando a que la API esté lista..."
  for i in $(seq 1 60); do
    sleep 2
    if api_ready; then
      echo "[api-env] API lista en $env_name tras $((i * 2))s."
      # Espera extra para que Next.js compile las rutas
      sleep 5
      return 0
    fi
  done

  echo "[api-env] ERROR: La API no respondió tras 60s. Abortando."
  return 1
}
