#!/usr/bin/env bash
# =============================================================================
# setup-vercel-env.sh
# Configura todas las variables de entorno en Vercel para staging y producción.
#
# USO:
#   ./ejecucion/setup-vercel-env.sh staging
#   ./ejecucion/setup-vercel-env.sh production
#   ./ejecucion/setup-vercel-env.sh all       # ambos entornos
#
# REQUISITOS:
#   - Vercel CLI instalado (npm i -g vercel)
#   - Autenticado: vercel login
#   - Repositorio ya conectado a los proyectos Vercel
#   - Completar las variables marcadas con TODO antes de ejecutar
# =============================================================================

set -euo pipefail

SCOPE="jalvarez2000-5936s-projects"
APP_PROJECT="gestion-requisitos-app"
API_PROJECT="gestion-requisitos-api"

# ─── Neon connection strings ──────────────────────────────────────────────────
# Neon tiene dos usuarios por branch:
#   neondb_owner  — para migraciones (prisma.config.ts / pnpm db:push)
#   app_user      — para el runtime (DATABASE_APP_URL en keys.ts)
#
# Obtener las URLs exactas desde: https://console.neon.tech/
# Project: steep-scene-28139500 → Branches → production / staging → Connection string
# Seleccionar rol "app_user" para DATABASE_APP_URL.

# Neon connection strings para el rol app_user
# Obtener desde: https://console.neon.tech/ → Project → Branches → Connection string → rol app_user
# Exportar antes de ejecutar:
#   export DB_STAGING_APP="postgresql://app_user:<PASSWORD>@ep-damp-rice-aljp6evx.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
#   export DB_PRODUCTION_APP="postgresql://app_user:<PASSWORD>@ep-nameless-term-alppqd65.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
DB_STAGING_APP="${DB_STAGING_APP:?Falta DB_STAGING_APP}"
DB_PRODUCTION_APP="${DB_PRODUCTION_APP:?Falta DB_PRODUCTION_APP}"

# ─── Clerk ────────────────────────────────────────────────────────────────────
# Staging usa las test keys (pk_test_..., sk_test_...)
# Producción necesita las live keys desde: https://dashboard.clerk.com/
# Clerk keys — obtener en https://dashboard.clerk.com/
# Staging: exportar CLERK_PUBLISHABLE_STAGING y CLERK_SECRET_STAGING (pk_test_... / sk_test_...)
# Producción: exportar CLERK_PUBLISHABLE_PRODUCTION y CLERK_SECRET_PRODUCTION (pk_live_... / sk_live_...)
CLERK_PUBLISHABLE_STAGING="${CLERK_PUBLISHABLE_STAGING:?Falta CLERK_PUBLISHABLE_STAGING}"
CLERK_SECRET_STAGING="${CLERK_SECRET_STAGING:?Falta CLERK_SECRET_STAGING}"
CLERK_PUBLISHABLE_PRODUCTION="${CLERK_PUBLISHABLE_PRODUCTION:?Falta CLERK_PUBLISHABLE_PRODUCTION}"
CLERK_SECRET_PRODUCTION="${CLERK_SECRET_PRODUCTION:?Falta CLERK_SECRET_PRODUCTION}"

# ─── Gmail OAuth2 ─────────────────────────────────────────────────────────────
GMAIL_CLIENT_ID="${GMAIL_CLIENT_ID:?Falta GMAIL_CLIENT_ID}"
GMAIL_CLIENT_SECRET="${GMAIL_CLIENT_SECRET:?Falta GMAIL_CLIENT_SECRET}"
GMAIL_REFRESH_TOKEN="${GMAIL_REFRESH_TOKEN:?Falta GMAIL_REFRESH_TOKEN — ejecutar get-gmail-token.mjs}"
GMAIL_TARGET="viteappsbreizh@gmail.com"

# ─── Cron secret ─────────────────────────────────────────────────────────────
# Generar con: openssl rand -hex 32
# Exportar antes de ejecutar: export CRON_SECRET=$(openssl rand -hex 32)
CRON_SECRET="${CRON_SECRET:?Falta CRON_SECRET — exportar: export CRON_SECRET=\$(openssl rand -hex 32)}"

# ─── Portal session secret ────────────────────────────────────────────────────
# Mínimo 32 caracteres. Genera uno con: openssl rand -hex 32
PORTAL_SESSION_SECRET_STAGING="$(openssl rand -hex 32)"
PORTAL_SESSION_SECRET_PRODUCTION="$(openssl rand -hex 32)"

# ─── URLs públicas ────────────────────────────────────────────────────────────
# Ajusta estos valores cuando tengas dominio propio.
# Para staging Vercel asigna una URL automática del tipo:
#   gestion-requisitos-app-git-staging-jalvarez.vercel.app
APP_URL_STAGING="https://gestion-requisitos-app-git-staging-jalvarez.vercel.app"
APP_URL_PRODUCTION="https://gestion-requisitos-app.vercel.app"  # TODO: dominio final
API_URL_STAGING="https://gestion-requisitos-api-git-staging-jalvarez.vercel.app"
API_URL_PRODUCTION="https://gestion-requisitos-api.vercel.app"  # TODO: dominio final

# =============================================================================
# Helpers
# =============================================================================

# Vercel environment targets:
#   production  → despliegues de la rama producción
#   preview     → PRs y ramas no-production (aquí se usan las vars de staging)
#   development → vercel env pull en local

add_var() {
  local project="$1"
  local name="$2"
  local value="$3"
  local targets="${4:-production,preview,development}"  # coma-separado
  local sensitive="${5:-false}"

  echo "  → $name [$targets]"

  # Eliminar si ya existe (evita conflictos de duplicados)
  vercel env rm "$name" production --yes --scope "$SCOPE" --cwd "/dev/null" 2>/dev/null || true
  vercel env rm "$name" preview    --yes --scope "$SCOPE" --cwd "/dev/null" 2>/dev/null || true
  vercel env rm "$name" development --yes --scope "$SCOPE" --cwd "/dev/null" 2>/dev/null || true

  IFS=',' read -ra TARGET_LIST <<< "$targets"
  for target in "${TARGET_LIST[@]}"; do
    if [ "$sensitive" = "true" ]; then
      printf '%s' "$value" | vercel env add "$name" "$target" \
        --scope "$SCOPE" --project "$project" --sensitive --force
    else
      printf '%s' "$value" | vercel env add "$name" "$target" \
        --scope "$SCOPE" --project "$project" --force
    fi
  done
}

add_var_per_env() {
  # Variable con valor distinto en staging (preview) y producción
  local project="$1"
  local name="$2"
  local staging_val="$3"
  local prod_val="$4"
  local sensitive="${5:-false}"

  echo "  → $name [preview=staging, production=prod]"
  if [ "$sensitive" = "true" ]; then
    printf '%s' "$staging_val"  | vercel env add "$name" preview \
      --scope "$SCOPE" --project "$project" --sensitive --force
    printf '%s' "$prod_val" | vercel env add "$name" production \
      --scope "$SCOPE" --project "$project" --sensitive --force
  else
    printf '%s' "$staging_val"  | vercel env add "$name" preview \
      --scope "$SCOPE" --project "$project" --force
    printf '%s' "$prod_val" | vercel env add "$name" production \
      --scope "$SCOPE" --project "$project" --force
  fi
}

# =============================================================================
# Configurar gestion-requisitos-app
# =============================================================================

setup_app() {
  local env="$1"   # staging | production | all

  echo ""
  echo "══════════════════════════════════════════════"
  echo "  gestion-requisitos-app  [$env]"
  echo "══════════════════════════════════════════════"

  cd apps/app

  if [ "$env" = "staging" ] || [ "$env" = "all" ]; then
    echo ""
    echo "── STAGING (preview) ──"

    add_var "$APP_PROJECT" "DATABASE_APP_URL"                  "$DB_STAGING_APP"             "preview,development" "true"
    add_var "$APP_PROJECT" "CLERK_SECRET_KEY"                  "$CLERK_SECRET_STAGING"       "preview,development" "true"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "$CLERK_PUBLISHABLE_STAGING"  "preview,development"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_CLERK_SIGN_IN_URL"     "/sign-in"                    "preview,development"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_CLERK_SIGN_UP_URL"     "/sign-up"                    "preview,development"
    add_var "$APP_PROJECT" "GMAIL_CLIENT_ID"                   "$GMAIL_CLIENT_ID"            "preview,development"
    add_var "$APP_PROJECT" "GMAIL_CLIENT_SECRET"               "$GMAIL_CLIENT_SECRET"        "preview,development" "true"
    add_var "$APP_PROJECT" "GMAIL_REFRESH_TOKEN"               "$GMAIL_REFRESH_TOKEN"        "preview,development" "true"
    add_var "$APP_PROJECT" "GMAIL_TARGET_ADDRESS"              "$GMAIL_TARGET"               "preview,development"
    add_var "$APP_PROJECT" "PORTAL_SESSION_SECRET"             "$PORTAL_SESSION_SECRET_STAGING" "preview,development" "true"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_APP_URL"               "$APP_URL_STAGING"            "preview,development"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_WEB_URL"               "$APP_URL_STAGING"            "preview,development"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_API_URL"               "$API_URL_STAGING"            "preview,development"
  fi

  if [ "$env" = "production" ] || [ "$env" = "all" ]; then
    echo ""
    echo "── PRODUCTION ──"

    add_var "$APP_PROJECT" "DATABASE_APP_URL"                  "$DB_PRODUCTION_APP"           "production" "true"
    add_var "$APP_PROJECT" "CLERK_SECRET_KEY"                  "$CLERK_SECRET_PRODUCTION"     "production" "true"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "$CLERK_PUBLISHABLE_PRODUCTION" "production"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_CLERK_SIGN_IN_URL"     "/sign-in"                     "production"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_CLERK_SIGN_UP_URL"     "/sign-up"                     "production"
    add_var "$APP_PROJECT" "GMAIL_CLIENT_ID"                   "$GMAIL_CLIENT_ID"             "production"
    add_var "$APP_PROJECT" "GMAIL_CLIENT_SECRET"               "$GMAIL_CLIENT_SECRET"         "production" "true"
    add_var "$APP_PROJECT" "GMAIL_REFRESH_TOKEN"               "$GMAIL_REFRESH_TOKEN"         "production" "true"
    add_var "$APP_PROJECT" "GMAIL_TARGET_ADDRESS"              "$GMAIL_TARGET"                "production"
    add_var "$APP_PROJECT" "PORTAL_SESSION_SECRET"             "$PORTAL_SESSION_SECRET_PRODUCTION" "production" "true"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_APP_URL"               "$APP_URL_PRODUCTION"          "production"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_WEB_URL"               "$APP_URL_PRODUCTION"          "production"
    add_var "$APP_PROJECT" "NEXT_PUBLIC_API_URL"               "$API_URL_PRODUCTION"          "production"
  fi

  cd ../..
}

# =============================================================================
# Configurar gestion-requisitos-api
# =============================================================================

setup_api() {
  local env="$1"

  echo ""
  echo "══════════════════════════════════════════════"
  echo "  gestion-requisitos-api  [$env]"
  echo "══════════════════════════════════════════════"

  cd apps/api

  if [ "$env" = "staging" ] || [ "$env" = "all" ]; then
    echo ""
    echo "── STAGING (preview) ──"

    add_var "$API_PROJECT" "DATABASE_APP_URL"    "$DB_STAGING_APP"       "preview,development" "true"
    add_var "$API_PROJECT" "CLERK_SECRET_KEY"    "$CLERK_SECRET_STAGING" "preview,development" "true"
    add_var "$API_PROJECT" "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "$CLERK_PUBLISHABLE_STAGING" "preview,development"
    add_var "$API_PROJECT" "GMAIL_CLIENT_ID"     "$GMAIL_CLIENT_ID"      "preview,development"
    add_var "$API_PROJECT" "GMAIL_CLIENT_SECRET" "$GMAIL_CLIENT_SECRET"  "preview,development" "true"
    add_var "$API_PROJECT" "GMAIL_REFRESH_TOKEN" "$GMAIL_REFRESH_TOKEN"  "preview,development" "true"
    add_var "$API_PROJECT" "GMAIL_TARGET_ADDRESS" "$GMAIL_TARGET"        "preview,development"
    add_var "$API_PROJECT" "CRON_SECRET"         "$CRON_SECRET"          "preview,development" "true"
    add_var "$API_PROJECT" "NEXT_PUBLIC_APP_URL" "$APP_URL_STAGING"      "preview,development"
    add_var "$API_PROJECT" "NEXT_PUBLIC_WEB_URL" "$APP_URL_STAGING"      "preview,development"
  fi

  if [ "$env" = "production" ] || [ "$env" = "all" ]; then
    echo ""
    echo "── PRODUCTION ──"

    add_var "$API_PROJECT" "DATABASE_APP_URL"    "$DB_PRODUCTION_APP"        "production" "true"
    add_var "$API_PROJECT" "CLERK_SECRET_KEY"    "$CLERK_SECRET_PRODUCTION"  "production" "true"
    add_var "$API_PROJECT" "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "$CLERK_PUBLISHABLE_PRODUCTION" "production"
    add_var "$API_PROJECT" "GMAIL_CLIENT_ID"     "$GMAIL_CLIENT_ID"          "production"
    add_var "$API_PROJECT" "GMAIL_CLIENT_SECRET" "$GMAIL_CLIENT_SECRET"      "production" "true"
    add_var "$API_PROJECT" "GMAIL_REFRESH_TOKEN" "$GMAIL_REFRESH_TOKEN"      "production" "true"
    add_var "$API_PROJECT" "GMAIL_TARGET_ADDRESS" "$GMAIL_TARGET"            "production"
    add_var "$API_PROJECT" "CRON_SECRET"         "$CRON_SECRET"              "production" "true"
    add_var "$API_PROJECT" "NEXT_PUBLIC_APP_URL" "$APP_URL_PRODUCTION"       "production"
    add_var "$API_PROJECT" "NEXT_PUBLIC_WEB_URL" "$APP_URL_PRODUCTION"       "production"
  fi

  cd ../..
}

# =============================================================================
# Main
# =============================================================================

TARGET="${1:-all}"

if [[ ! "$TARGET" =~ ^(staging|production|all)$ ]]; then
  echo "Uso: $0 [staging|production|all]"
  exit 1
fi

# Asegurarse de estar en la raíz del repo
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

setup_app "$TARGET"
setup_api "$TARGET"

echo ""
echo "✓ Variables configuradas para: $TARGET"
echo ""
echo "Próximos pasos:"
echo "  1. Habilitar AI Gateway en Vercel dashboard → gestion-requisitos-api → Settings → AI"
echo "  2. Añadir BLOB_READ_WRITE_TOKEN (Vercel Marketplace → Storage → Blob)"
echo "  3. Conectar repo GitHub a ambos proyectos Vercel (Settings → Git)"
echo "  4. Verificar que la rama 'main' despliega a production y 'staging' a preview"
