#!/bin/bash

export PATH="$HOME/.bun/bin:$PATH"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

kill_app() {
  local port=$1
  local pid
  pid=$(lsof -ti :"$port" 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "Matando proceso en :$port (PID $pid)..."
    kill -9 $pid 2>/dev/null
    sleep 0.5
  fi
}

clear_cache() {
  local app=$1
  rm -rf "$REPO_ROOT/apps/$app/.next"
  echo "Caché de $app eliminada."
}

restart_api() {
  kill_app 3002
  clear_cache api
  echo "Arrancando API en http://localhost:3002 ..."
  cd "$REPO_ROOT/apps/api" && bun --bun next dev -p 3002
}

restart_app() {
  kill_app 3000
  clear_cache app
  echo "Arrancando APP en http://localhost:3000 ..."
  cd "$REPO_ROOT/apps/app" && bun --bun next dev -p 3000
}

case "$1" in
  api)
    restart_api
    ;;
  app)
    restart_app
    ;;
  all)
    kill_app 3000
    kill_app 3002
    clear_cache app
    clear_cache api
    echo "Arrancando APP y API..."
    (cd "$REPO_ROOT/apps/app" && bun --bun next dev -p 3000) &
    (cd "$REPO_ROOT/apps/api" && bun --bun next dev -p 3002) &
    echo "APP → http://localhost:3000"
    echo "API → http://localhost:3002"
    echo "Pulsa Ctrl+C para parar ambos."
    wait
    ;;
  *)
    echo "Uso: ./restart.sh [all|api|app]"
    echo ""
    echo "  all   — Reinicia APP (:3000) y API (:3002)"
    echo "  api   — Reinicia el API en localhost:3002"
    echo "  app   — Reinicia la APP en localhost:3000"
    ;;
esac
