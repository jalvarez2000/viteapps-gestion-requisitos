#!/bin/bash

export PATH="$HOME/.bun/bin:$PATH"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

CRON_SECRET=$(grep "^CRON_SECRET=" "$REPO_ROOT/apps/api/.env.local" 2>/dev/null \
  | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

case "$1" in
  api)
    rm -rf "$REPO_ROOT/apps/api/.next"
    echo "Arrancando API en http://localhost:5555 ..."
    cd "$REPO_ROOT/apps/api" && bun --bun next dev -p5555 
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
    (cd "$REPO_ROOT/apps/api" && bun --bun next dev -p 5555) &
    echo "APP → http://localhost:3000"
    echo "API → http://localhost:5555"
    echo "Pulsa Ctrl+C para parar ambos."
    wait
    ;;
  cron)
    echo "Ejecutando cron de Gmail..."
    curl -s http://localhost:5555/api/cron/gmail \
      -H "Authorization: Bearer ${CRON_SECRET}" | jq .
    ;;
  cron-status)
    echo "Ejecutando cron de estado de proyectos SOLICITADO..."
    curl -s http://localhost:5555/api/cron/projects-status \
      -H "Authorization: Bearer ${CRON_SECRET}" | jq .
    ;;
  *)
    echo "Uso: ./dev.sh [all|api|app|cron|cron-status]"
    echo ""
    echo "  all          — Arranca APP (:3000) y API (:5555) juntos"
    echo "  api          — Arranca el API en localhost:5555"
    echo "  app          — Arranca la APP en localhost:3000"
    echo "  cron         — Dispara el cron de Gmail (requiere api corriendo)"
    echo "  cron-status  — Dispara el cron de proyectos SOLICITADO (requiere api corriendo)"
    ;;
esac
