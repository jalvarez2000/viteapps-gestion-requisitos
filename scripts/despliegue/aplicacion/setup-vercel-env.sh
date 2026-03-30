#!/usr/bin/env bash
# =============================================================================
# setup-vercel-env.sh
# Configura todas las variables de entorno en Vercel.
#
# USO:
#   ./scripts/despliegue/aplicacion/setup-vercel-env.sh pro      # entorno de producción
#   ./scripts/despliegue/aplicacion/setup-vercel-env.sh staging  # (no configurado aún)
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

TARGET="${1:-}"

if [[ ! "$TARGET" =~ ^(pro|staging)$ ]]; then
  echo "Uso: $0 [pro|staging]"
  exit 1
fi

# ─── STAGING ─────────────────────────────────────────────────────────────────
if [ "$TARGET" = "staging" ]; then
  echo ""
  echo "⚠️  STAGING no configurado todavía."
  echo ""
  exit 0
fi

# =============================================================================
# A partir de aquí: solo PRO
# =============================================================================

# ─── Neon connection strings ──────────────────────────────────────────────────
# Obtener desde: https://console.neon.tech/
# Project → Branches → production → Connection string → rol "app_user"
#
#   export DB_PRODUCTION_APP="postgresql://app_user:<PASSWORD>@<host>.neon.tech/neondb?sslmode=require"
DB_PRODUCTION_APP="${DB_PRODUCTION_APP:?Falta DB_PRODUCTION_APP}"

# ─── Auth session secret ──────────────────────────────────────────────────────
# Generar una vez con: openssl rand -hex 32
# IMPORTANTE: usar siempre el mismo valor; cambiarlo invalida todas las sesiones activas.
#
#   export AUTH_SESSION_SECRET="..."
AUTH_SESSION_SECRET="${AUTH_SESSION_SECRET:?Falta AUTH_SESSION_SECRET}"

# ─── Portal session secret ────────────────────────────────────────────────────
# Mínimo 32 caracteres. Generar una vez con: openssl rand -hex 32
# IMPORTANTE: usar siempre el mismo valor.
#
#   export PORTAL_SESSION_SECRET="..."
PORTAL_SESSION_SECRET="${PORTAL_SESSION_SECRET:?Falta PORTAL_SESSION_SECRET}"

# ─── Gmail OAuth2 ─────────────────────────────────────────────────────────────
# Obtener desde Google Cloud Console → APIs & Services → Credentials
#
#   export GMAIL_CLIENT_ID="..."
#   export GMAIL_CLIENT_SECRET="..."
#   export GMAIL_REFRESH_TOKEN="..."   # ejecutar get-gmail-token.mjs
GMAIL_CLIENT_ID="${GMAIL_CLIENT_ID:?Falta GMAIL_CLIENT_ID}"
GMAIL_CLIENT_SECRET="${GMAIL_CLIENT_SECRET:?Falta GMAIL_CLIENT_SECRET}"
GMAIL_REFRESH_TOKEN="${GMAIL_REFRESH_TOKEN:?Falta GMAIL_REFRESH_TOKEN}"
GMAIL_TARGET="viteappsbreizh@gmail.com"

# ─── Cron secret ─────────────────────────────────────────────────────────────
# Generar una vez con: openssl rand -hex 32
#
#   export CRON_SECRET="..."
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
APP_URL_PRODUCTION="https://gestion-requisitos-app.vercel.app"   # TODO: dominio final
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

# =============================================================================
# gestion-requisitos-app — PRO
# =============================================================================

echo ""
echo "══════════════════════════════════════════════"
echo "  gestion-requisitos-app  [production]"
echo "══════════════════════════════════════════════"

cd apps/app

add_var "$APP_PROJECT" "DATABASE_APP_URL"      "$DB_PRODUCTION_APP"   "production" "true"
add_var "$APP_PROJECT" "AUTH_SESSION_SECRET"   "$AUTH_SESSION_SECRET" "production" "true"
add_var "$APP_PROJECT" "PORTAL_SESSION_SECRET" "$PORTAL_SESSION_SECRET" "production" "true"
add_var "$APP_PROJECT" "GMAIL_CLIENT_ID"       "$GMAIL_CLIENT_ID"     "production"
add_var "$APP_PROJECT" "GMAIL_CLIENT_SECRET"   "$GMAIL_CLIENT_SECRET" "production" "true"
add_var "$APP_PROJECT" "GMAIL_REFRESH_TOKEN"   "$GMAIL_REFRESH_TOKEN" "production" "true"
add_var "$APP_PROJECT" "GMAIL_TARGET_ADDRESS"  "$GMAIL_TARGET"        "production"
add_var "$APP_PROJECT" "NEXT_PUBLIC_APP_URL"   "$APP_URL_PRODUCTION"  "production"
add_var "$APP_PROJECT" "NEXT_PUBLIC_WEB_URL"   "$APP_URL_PRODUCTION"  "production"
add_var "$APP_PROJECT" "NEXT_PUBLIC_API_URL"   "$API_URL_PRODUCTION"  "production"
add_var "$APP_PROJECT" "STRIPE_SECRET_KEY"     "$STRIPE_SECRET_KEY"   "production" "true"
add_var "$APP_PROJECT" "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET" "production" "true"
add_var "$APP_PROJECT" "STRIPE_PRICE_ID_XS"    "$STRIPE_PRICE_ID_XS"  "production"
add_var "$APP_PROJECT" "STRIPE_PRICE_ID_S"     "$STRIPE_PRICE_ID_S"   "production"
add_var "$APP_PROJECT" "STRIPE_PRICE_ID_M"     "$STRIPE_PRICE_ID_M"   "production"
add_var "$APP_PROJECT" "STRIPE_PRICE_ID_L"     "$STRIPE_PRICE_ID_L"   "production"
add_var "$APP_PROJECT" "STRIPE_PRICE_ID_XL"    "$STRIPE_PRICE_ID_XL"  "production"

cd ../..

# =============================================================================
# gestion-requisitos-api — PRO
# =============================================================================

echo ""
echo "══════════════════════════════════════════════"
echo "  gestion-requisitos-api  [production]"
echo "══════════════════════════════════════════════"

cd apps/api

add_var "$API_PROJECT" "DATABASE_APP_URL"      "$DB_PRODUCTION_APP"   "production" "true"
add_var "$API_PROJECT" "GMAIL_CLIENT_ID"       "$GMAIL_CLIENT_ID"     "production"
add_var "$API_PROJECT" "GMAIL_CLIENT_SECRET"   "$GMAIL_CLIENT_SECRET" "production" "true"
add_var "$API_PROJECT" "GMAIL_REFRESH_TOKEN"   "$GMAIL_REFRESH_TOKEN" "production" "true"
add_var "$API_PROJECT" "GMAIL_TARGET_ADDRESS"  "$GMAIL_TARGET"        "production"
add_var "$API_PROJECT" "CRON_SECRET"           "$CRON_SECRET"         "production" "true"
add_var "$API_PROJECT" "NEXT_PUBLIC_APP_URL"   "$APP_URL_PRODUCTION"  "production"
add_var "$API_PROJECT" "NEXT_PUBLIC_WEB_URL"   "$APP_URL_PRODUCTION"  "production"
add_var "$API_PROJECT" "STRIPE_SECRET_KEY"     "$STRIPE_SECRET_KEY"   "production" "true"
add_var "$API_PROJECT" "STRIPE_PRICE_ID_XS"    "$STRIPE_PRICE_ID_XS"  "production"
add_var "$API_PROJECT" "STRIPE_PRICE_ID_S"     "$STRIPE_PRICE_ID_S"   "production"
add_var "$API_PROJECT" "STRIPE_PRICE_ID_M"     "$STRIPE_PRICE_ID_M"   "production"
add_var "$API_PROJECT" "STRIPE_PRICE_ID_L"     "$STRIPE_PRICE_ID_L"   "production"
add_var "$API_PROJECT" "STRIPE_PRICE_ID_XL"    "$STRIPE_PRICE_ID_XL"  "production"

cd ../..

# =============================================================================

echo ""
echo "✓ Variables de producción configuradas."
echo ""
echo "Próximos pasos:"
echo "  1. Habilitar AI Gateway en Vercel dashboard → gestion-requisitos-api → Settings → AI"
echo "  2. Conectar repo GitHub a ambos proyectos Vercel (Settings → Git)"
echo "  3. Verificar que la rama 'main' despliega a production"
echo "  4. Configurar webhook en Stripe → endpoint: https://<APP_URL>/api/webhooks/stripe"
echo "     Eventos: customer.subscription.created/updated/deleted, invoice.payment_failed"
echo "  5. Crear el primer usuario admin: pnpm --filter app db:seed"
echo ""
