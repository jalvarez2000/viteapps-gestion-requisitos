#!/bin/bash

export PATH="$HOME/.bun/bin:$PATH"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "$1" in
  api)
    rm -rf "$REPO_ROOT/apps/api/.next"
    echo "Arrancando API en http://localhost:3002 ..."
    cd "$REPO_ROOT/apps/api" && bun --bun next dev -p 3002
    ;;
  app)
    rm -rf "$REPO_ROOT/apps/app/.next"
    echo "Arrancando APP en http://localhost:3000 ..."
    cd "$REPO_ROOT/apps/app" && bun --bun next dev -p 3000
    ;;
  all)
    rm -rf "$REPO_ROOT/apps/app/.next" "$REPO_ROOT/apps/api/.next"
    echo "Arrancando APP y API..."
    (cd "$REPO_ROOT/apps/app" && bun --bun next dev -p 3000) &
    (cd "$REPO_ROOT/apps/api" && bun --bun next dev -p 3002) &
    echo "APP → http://localhost:3000"
    echo "API → http://localhost:3002"
    echo "Pulsa Ctrl+C para parar ambos."
    wait
    ;;
  cron)
    echo "Ejecutando cron de Gmail..."
    curl -s http://localhost:3002/api/cron/gmail \
      -H "Authorization: Bearer CRON_SECRET_PLACEHOLDER" | jq .
    ;;
  *)
    echo "Uso: ./dev.sh [all|api|app|cron]"
    echo ""
    echo "  all   — Arranca APP (:3000) y API (:3002) juntos"
    echo "  api   — Arranca el API en localhost:3002"
    echo "  app   — Arranca la APP en localhost:3000"
    echo "  cron  — Dispara el cron de Gmail (requiere api corriendo)"
    ;;
esac
