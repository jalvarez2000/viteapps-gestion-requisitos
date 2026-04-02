#!/bin/bash
# Despliega el schema de Prisma a staging o producción.
# Uso: ./scripts/despliegue/bbdd/push.sh [staging|pro]

set -euo pipefail

export PATH="$HOME/.bun/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DB_URLS_FILE="$REPO_ROOT/scripts/despliegue/bbdd/.db-urls"

ENV="${1:-}"

# ─── URLs ────────────────────────────────────────────────────────────────────
STAGING_URL=$(grep "^DB_STAGING_OWNER_URL=" "$DB_URLS_FILE" 2>/dev/null \
  | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

PROD_URL=$(grep "^DB_PRO_OWNER_URL=" "$DB_URLS_FILE" 2>/dev/null \
  | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

# ─── Validaciones ─────────────────────────────────────────────────────────────
if [[ -z "$ENV" ]]; then
  echo "Error: debes indicar el entorno."
  echo "Uso: $0 [staging|pro]"
  exit 1
fi

if [[ "$ENV" != "staging" && "$ENV" != "pro" ]]; then
  echo "Error: entorno desconocido '${ENV}'. Usa 'staging' o 'pro'."
  exit 1
fi

if [[ "$ENV" == "staging" && -z "$STAGING_URL" ]]; then
  echo "Error: no se encontró DB_STAGING_OWNER_URL en scripts/despliegue/bbdd/.db-urls"
  exit 1
fi

if [[ "$ENV" == "pro" && -z "$PROD_URL" ]]; then
  echo "Error: no se encontró DB_PRO_OWNER_URL en scripts/despliegue/bbdd/.db-urls"
  exit 1
fi

# ─── Push ─────────────────────────────────────────────────────────────────────
if [[ "$ENV" == "staging" ]]; then
  echo "→ Desplegando schema a STAGING..."
  echo "  Host: $(echo "$STAGING_URL" | sed 's/.*@//' | cut -d/ -f1)"
  TARGET_URL="$STAGING_URL"
else
  echo "→ Desplegando schema a PRODUCCIÓN..."
  echo "  Host: $(echo "$PROD_URL" | sed 's/.*@//' | cut -d/ -f1)"
  echo ""
  read -r -p "  ¿Confirmas el push a producción? [s/N] " confirm
  if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    echo "Cancelado."
    exit 0
  fi
  TARGET_URL="$PROD_URL"
fi

cd "$REPO_ROOT"
export DATABASE_URL="$TARGET_URL"
pnpm db:push

echo ""
echo "✓ Schema desplegado a ${ENV} correctamente."
