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
#   - Exportar las variables requeridas antes de ejecutar (ver secciones abajo)
# =============================================================================

set -euo pipefail

SCOPE="jalvarez2000-5936s-projects"
APP_PROJECT="gestion-requisitos-app"
API_PROJECT="gestion-requisitos-api"

# ─── Neon connection strings ──────────────────────────────────────────────────
# Obtener desde: https://console.neon.tech/
# Project → Branches → production / staging → Connection string → rol "app_user"
#
#   export DB_STAGING_APP="postgresql://app_user:<PASSWORD>@ep-damp-rice-aljp6evx.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
#   export DB_PRODUCTION_APP="postgresql://app_user:<PASSWORD>@ep-nameless-term-alppqd65.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
DB_STAGING_APP="${DB_STAGING_APP:?Falta DB_STAGING_APP}"
DB_PRODUCTION_APP="${DB_PRODUCTION_APP:?Falta DB_PRODUCTION_APP}"

# ─── Session secrets ──────────────────────────────────────────────────────────
# Generar una vez con: openssl rand -hex 32
# IMPORTANTE: usar siempre el mismo valor; cambiarlo invalida todas las sesiones activas.
#
#   export AUTH_SESSION_SECRET="$(openssl rand -hex 32)"
#   export PORTAL_SESSION_SECRET="$(openssl rand -hex 32)"
AUTH_SESSION_SECRET="${AUTH_SESSION_SECRET:?Falta AUTH_SESSION_SECRET — exportar: export AUTH_SESSION_SECRET=\$(openssl rand -hex 32)}"
PORTAL_SESSION_SECRET="${PORTAL_SESSION_SECRET:?Falta PORTAL_SESSION_SECRET — exportar: export PORTAL_SESSION_SECRET=\$(openssl rand -hex 32)}"

# ─── Gmail OAuth2 ─────────────────────────────────────────────────────────────
# Obtener desde Google Cloud Console → APIs & Services → Credentials
#
#   export GMAIL_CLIENT_ID="..."
#   export GMAIL_CLIENT_SECRET="..."
#   export GMAIL_REFRESH_TOKEN="..."   # ejecutar get-gmail-token.mjs
GMAIL_CLIENT_ID="${GMAIL_CLIENT_ID:?Falta GMAIL_CLIENT_ID}"
GMAIL_CLIENT_SECRET="${GMAIL_CLIENT_SECRET:?Falta GMAIL_CLIENT_SECRET}"
GMAIL_REFRESH_TOKEN="${GMAIL_REFRESH_TOKEN:?Falta GMAIL_REFRESH_TOKEN — ejecutar get-gmail-token.mjs}"
GMAIL_TARGET="viteappsbreizh@gmail.com"

# ─── Cron secret ─────────────────────────────────────────────────────────────
# Generar con: openssl rand -hex 32
#
#   export CRON_SECRET="$(openssl rand -hex 32)"
CRON_SECRET="${CRON_SECRET:?Falta CRON_SECRET}"

# ─── Stripe ───────────────────────────────────────────────────────────────────
# Obtener desde: https://dashboard.stripe.com/ → Developers → API keys
# Webhook secret: Developers → Webhooks → endpoint → Signing secret
# Price IDs: Products → precio → copiar ID (price_...)
#
#   export STRIPE_SECRET_KEY="sk_live_..."
#   export STRIPE_WEBHOOK_SECRET="whsec_..."
#   export STRIPE_PRICE_ID_XS="price_..."  (y S, M, L, XL)
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:?Falta STRIPE_SECRET_KEY}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:?Falta STRIPE_WEBHOOK_SECRET}"
STRIPE_PRICE_ID_XS="${STRIPE_PRICE_ID_XS:?Falta STRIPE_PRICE_ID_XS}"
STRIPE_PRICE_ID_S="${STRIPE_PRICE_ID_S:?Falta STRIPE_PRICE_ID_S}"
STRIPE_PRICE_ID_M="${STRIPE_PRICE_ID_M:?Falta STRIPE_PRICE_ID_M}"
STRIPE_PRICE_ID_L="${STRIPE_PRICE_ID_L:?Falta STRIPE_PRICE_ID_L}"
STRIPE_PRICE_ID_XL="${STRIPE_PRICE_ID_XL:?Falta STRIPE_PRICE_ID_XL}"

# ─── URLs públicas ────────────────────────────────────────────────────────────
APP_URL_STAGING="https://gestion-requisitos-app-git-staging-jalvarez.vercel.app"
APP_URL_PRODUCTION="https://gestion-requisitos-app.vercel.app"   # TODO: dominio final
API_URL_STAGING="https://gestion-requisitos-api-git-staging-jalvarez.vercel.app"
API_URL_PRODUCTION="https://gestion-requisitos-api.vercel.app"   # TODO: dominio final

# =============================================================================
# Helpers
# =============================================================================

add_var() {
  local project="$1"
  local name="$2"
  local value="$3"
  local targets="${4:-production}"
  local sensitive="${5:-false}"

  echo "  → $name [$targets]"

  vercel env rm "$name" production   --yes --scope "$SCOPE" --cwd "/dev/null" 2>/dev/null || true
  vercel env rm "$name" preview      --yes --scope "$SCOPE" --cwd "/dev/null" 2>/dev/null || true
  vercel env rm "$name" development  --yes --scope "$SCOPE" --cwd "/dev/null" 2>/dev/null || true

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

# =============================================================================
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TARGET="${1:-all}"

if [[ ! "$TARGET" =~ ^(staging|production|all)$ ]]; then
  echo "Uso: $0 [staging|production|all]"
  exit 1
fi

# =============================================================================
# gestion-requisitos-app
# =============================================================================

echo ""
echo "══════════════════════════════════════════════"
echo "  gestion-requisitos-app  [$TARGET]"
echo "══════════════════════════════════════════════"

cd apps/app

if [ "$TARGET" = "staging" ] || [ "$TARGET" = "all" ]; then
  echo ""
  echo "── STAGING (preview + development) ──"
  add_var "$APP_PROJECT" "DATABASE_APP_URL"      "$DB_STAGING_APP"        "preview,development" "true"
  add_var "$APP_PROJECT" "AUTH_SESSION_SECRET"   "$AUTH_SESSION_SECRET"   "preview,development" "true"
  add_var "$APP_PROJECT" "PORTAL_SESSION_SECRET" "$PORTAL_SESSION_SECRET" "preview,development" "true"
  add_var "$APP_PROJECT" "GMAIL_CLIENT_ID"       "$GMAIL_CLIENT_ID"       "preview,development"
  add_var "$APP_PROJECT" "GMAIL_CLIENT_SECRET"   "$GMAIL_CLIENT_SECRET"   "preview,development" "true"
  add_var "$APP_PROJECT" "GMAIL_REFRESH_TOKEN"   "$GMAIL_REFRESH_TOKEN"   "preview,development" "true"
  add_var "$APP_PROJECT" "GMAIL_TARGET_ADDRESS"  "$GMAIL_TARGET"          "preview,development"
  add_var "$APP_PROJECT" "NEXT_PUBLIC_APP_URL"   "$APP_URL_STAGING"       "preview,development"
  add_var "$APP_PROJECT" "NEXT_PUBLIC_WEB_URL"   "$APP_URL_STAGING"       "preview,development"
  add_var "$APP_PROJECT" "NEXT_PUBLIC_API_URL"   "$API_URL_STAGING"       "preview,development"
  add_var "$APP_PROJECT" "STRIPE_SECRET_KEY"     "$STRIPE_SECRET_KEY"     "preview,development" "true"
  add_var "$APP_PROJECT" "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET" "preview,development" "true"
  add_var "$APP_PROJECT" "STRIPE_PRICE_ID_XS"    "$STRIPE_PRICE_ID_XS"   "preview,development"
  add_var "$APP_PROJECT" "STRIPE_PRICE_ID_S"     "$STRIPE_PRICE_ID_S"    "preview,development"
  add_var "$APP_PROJECT" "STRIPE_PRICE_ID_M"     "$STRIPE_PRICE_ID_M"    "preview,development"
  add_var "$APP_PROJECT" "STRIPE_PRICE_ID_L"     "$STRIPE_PRICE_ID_L"    "preview,development"
  add_var "$APP_PROJECT" "STRIPE_PRICE_ID_XL"    "$STRIPE_PRICE_ID_XL"   "preview,development"
fi

if [ "$TARGET" = "production" ] || [ "$TARGET" = "all" ]; then
  echo ""
  echo "── PRODUCTION ──"
  add_var "$APP_PROJECT" "DATABASE_APP_URL"      "$DB_PRODUCTION_APP"     "production" "true"
  add_var "$APP_PROJECT" "AUTH_SESSION_SECRET"   "$AUTH_SESSION_SECRET"   "production" "true"
  add_var "$APP_PROJECT" "PORTAL_SESSION_SECRET" "$PORTAL_SESSION_SECRET" "production" "true"
  add_var "$APP_PROJECT" "GMAIL_CLIENT_ID"       "$GMAIL_CLIENT_ID"       "production"
  add_var "$APP_PROJECT" "GMAIL_CLIENT_SECRET"   "$GMAIL_CLIENT_SECRET"   "production" "true"
  add_var "$APP_PROJECT" "GMAIL_REFRESH_TOKEN"   "$GMAIL_REFRESH_TOKEN"   "production" "true"
  add_var "$APP_PROJECT" "GMAIL_TARGET_ADDRESS"  "$GMAIL_TARGET"          "production"
  add_var "$APP_PROJECT" "NEXT_PUBLIC_APP_URL"   "$APP_URL_PRODUCTION"    "production"
  add_var "$APP_PROJECT" "NEXT_PUBLIC_WEB_URL"   "$APP_URL_PRODUCTION"    "production"
  add_var "$APP_PROJECT" "NEXT_PUBLIC_API_URL"   "$API_URL_PRODUCTION"    "production"
  add_var "$APP_PROJECT" "STRIPE_SECRET_KEY"     "$STRIPE_SECRET_KEY"     "production" "true"
  add_var "$APP_PROJECT" "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET" "production" "true"
  add_var "$APP_PROJECT" "STRIPE_PRICE_ID_XS"    "$STRIPE_PRICE_ID_XS"   "production"
  add_var "$APP_PROJECT" "STRIPE_PRICE_ID_S"     "$STRIPE_PRICE_ID_S"    "production"
  add_var "$APP_PROJECT" "STRIPE_PRICE_ID_M"     "$STRIPE_PRICE_ID_M"    "production"
  add_var "$APP_PROJECT" "STRIPE_PRICE_ID_L"     "$STRIPE_PRICE_ID_L"    "production"
  add_var "$APP_PROJECT" "STRIPE_PRICE_ID_XL"    "$STRIPE_PRICE_ID_XL"   "production"
fi

cd ../..

# =============================================================================
# gestion-requisitos-api
# =============================================================================

echo ""
echo "══════════════════════════════════════════════"
echo "  gestion-requisitos-api  [$TARGET]"
echo "══════════════════════════════════════════════"

cd apps/api

if [ "$TARGET" = "staging" ] || [ "$TARGET" = "all" ]; then
  echo ""
  echo "── STAGING (preview + development) ──"
  add_var "$API_PROJECT" "DATABASE_APP_URL"      "$DB_STAGING_APP"        "preview,development" "true"
  add_var "$API_PROJECT" "GMAIL_CLIENT_ID"       "$GMAIL_CLIENT_ID"       "preview,development"
  add_var "$API_PROJECT" "GMAIL_CLIENT_SECRET"   "$GMAIL_CLIENT_SECRET"   "preview,development" "true"
  add_var "$API_PROJECT" "GMAIL_REFRESH_TOKEN"   "$GMAIL_REFRESH_TOKEN"   "preview,development" "true"
  add_var "$API_PROJECT" "GMAIL_TARGET_ADDRESS"  "$GMAIL_TARGET"          "preview,development"
  add_var "$API_PROJECT" "CRON_SECRET"           "$CRON_SECRET"           "preview,development" "true"
  add_var "$API_PROJECT" "NEXT_PUBLIC_APP_URL"   "$APP_URL_STAGING"       "preview,development"
  add_var "$API_PROJECT" "NEXT_PUBLIC_WEB_URL"   "$APP_URL_STAGING"       "preview,development"
  add_var "$API_PROJECT" "STRIPE_SECRET_KEY"     "$STRIPE_SECRET_KEY"     "preview,development" "true"
  add_var "$API_PROJECT" "STRIPE_PRICE_ID_XS"    "$STRIPE_PRICE_ID_XS"   "preview,development"
  add_var "$API_PROJECT" "STRIPE_PRICE_ID_S"     "$STRIPE_PRICE_ID_S"    "preview,development"
  add_var "$API_PROJECT" "STRIPE_PRICE_ID_M"     "$STRIPE_PRICE_ID_M"    "preview,development"
  add_var "$API_PROJECT" "STRIPE_PRICE_ID_L"     "$STRIPE_PRICE_ID_L"    "preview,development"
  add_var "$API_PROJECT" "STRIPE_PRICE_ID_XL"    "$STRIPE_PRICE_ID_XL"   "preview,development"
fi

if [ "$TARGET" = "production" ] || [ "$TARGET" = "all" ]; then
  echo ""
  echo "── PRODUCTION ──"
  add_var "$API_PROJECT" "DATABASE_APP_URL"      "$DB_PRODUCTION_APP"     "production" "true"
  add_var "$API_PROJECT" "GMAIL_CLIENT_ID"       "$GMAIL_CLIENT_ID"       "production"
  add_var "$API_PROJECT" "GMAIL_CLIENT_SECRET"   "$GMAIL_CLIENT_SECRET"   "production" "true"
  add_var "$API_PROJECT" "GMAIL_REFRESH_TOKEN"   "$GMAIL_REFRESH_TOKEN"   "production" "true"
  add_var "$API_PROJECT" "GMAIL_TARGET_ADDRESS"  "$GMAIL_TARGET"          "production"
  add_var "$API_PROJECT" "CRON_SECRET"           "$CRON_SECRET"           "production" "true"
  add_var "$API_PROJECT" "NEXT_PUBLIC_APP_URL"   "$APP_URL_PRODUCTION"    "production"
  add_var "$API_PROJECT" "NEXT_PUBLIC_WEB_URL"   "$APP_URL_PRODUCTION"    "production"
  add_var "$API_PROJECT" "STRIPE_SECRET_KEY"     "$STRIPE_SECRET_KEY"     "production" "true"
  add_var "$API_PROJECT" "STRIPE_PRICE_ID_XS"    "$STRIPE_PRICE_ID_XS"   "production"
  add_var "$API_PROJECT" "STRIPE_PRICE_ID_S"     "$STRIPE_PRICE_ID_S"    "production"
  add_var "$API_PROJECT" "STRIPE_PRICE_ID_M"     "$STRIPE_PRICE_ID_M"    "production"
  add_var "$API_PROJECT" "STRIPE_PRICE_ID_L"     "$STRIPE_PRICE_ID_L"    "production"
  add_var "$API_PROJECT" "STRIPE_PRICE_ID_XL"    "$STRIPE_PRICE_ID_XL"   "production"
fi

cd ../..

# =============================================================================

echo ""
echo "✓ Variables configuradas para: $TARGET"
echo ""
echo "Próximos pasos:"
echo "  1. Habilitar AI Gateway en Vercel dashboard → gestion-requisitos-api → Settings → AI"
echo "  2. Conectar repo GitHub a ambos proyectos Vercel (Settings → Git)"
echo "  3. Verificar que la rama 'main' despliega a production y 'staging' a preview"
echo "  4. Configurar webhook en Stripe → endpoint: https://<APP_URL>/api/webhooks/stripe"
echo "     Eventos: customer.subscription.created/updated/deleted, invoice.payment_failed"
echo "  5. Crear el primer usuario admin: bun scripts/ejecucion/create-admin.ts"
echo ""
