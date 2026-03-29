#!/bin/bash
# Despliega el schema de Prisma a staging o producción.
# Uso: ./scripts/despliegue/bbdd/push.sh [staging|pro]

set -euo pipefail

export PATH="$HOME/.bun/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DB_ENV="$REPO_ROOT/packages/database/.env"
DB_ENV_BACKUP="$REPO_ROOT/packages/database/.env.bak"

ENV="${1:-}"

# ─── URLs ────────────────────────────────────────────────────────────────────
# El push usa siempre DATABASE_URL (neondb_owner, BYPASSRLS) — necesario para DDL.
# DATABASE_APP_URL (app_user) es solo para el runtime de la app.
STAGING_URL=$(grep "^DATABASE_URL=" "$REPO_ROOT/apps/api/.env.local" 2>/dev/null \
  | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

PROD_URL=$(grep "^DATABASE_URL=" "$DB_ENV" 2>/dev/null \
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
  echo "Error: no se encontró DATABASE_URL (neondb_owner) en apps/api/.env.local"
  exit 1
fi

if [[ "$ENV" == "pro" && -z "$PROD_URL" ]]; then
  echo "Error: no se encontró DATABASE_URL en packages/database/.env"
  exit 1
fi

# ─── Función de restauración ──────────────────────────────────────────────────
restore_env() {
  if [[ -f "$DB_ENV_BACKUP" ]]; then
    mv "$DB_ENV_BACKUP" "$DB_ENV"
  fi
}
trap restore_env EXIT

# ─── Push ─────────────────────────────────────────────────────────────────────
if [[ "$ENV" == "staging" ]]; then
  echo "→ Desplegando schema a STAGING..."
  echo "  Host: $(echo "$STAGING_URL" | sed 's/.*@//' | cut -d/ -f1)"

  # Backup y reemplaza .env con la URL de staging
  cp "$DB_ENV" "$DB_ENV_BACKUP"
  echo "DATABASE_URL=\"${STAGING_URL}\"" > "$DB_ENV"
else
  echo "→ Desplegando schema a PRODUCCIÓN..."
  echo "  Host: $(echo "$PROD_URL" | sed 's/.*@//' | cut -d/ -f1)"
  echo ""
  read -r -p "  ¿Confirmas el push a producción? [s/N] " confirm
  if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    echo "Cancelado."
    exit 0
  fi
  # En pro, la URL ya está en .env — no hay que tocar nada
fi

cd "$REPO_ROOT"
pnpm db:push

echo ""
echo "✓ Schema desplegado a ${ENV} correctamente."
