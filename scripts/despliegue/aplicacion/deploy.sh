#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Despliega app y/o api en Vercel (pre o pro)
#
# USO:
#   ./deploy.sh <entorno> <target>
#
#   entorno : pre | pro
#   target  : app | api | all
#
# EJEMPLOS:
#   ./deploy.sh pro all     # despliega app + api a producción
#   ./deploy.sh pre app     # despliega solo app a preview
#   ./deploy.sh pro api     # despliega solo api a producción
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
ORG_ID="team_FoOxAgaZy0Uq9EKh27lFu5Vv"
APP_PROJECT_ID="prj_JlVHg0Gep8wuYT9tjSSMCbenZGXQ"
API_PROJECT_ID="prj_iodNax7zdkXHPu1aszKA1aXMeVXW"
SCOPE="jalvarez2000-5936s-projects"

# ─── Argumentos ──────────────────────────────────────────────────────────────
ENV="${1:-}"
TARGET="${2:-}"

if [[ ! "$ENV" =~ ^(pre|pro)$ ]] || [[ ! "$TARGET" =~ ^(app|api|all)$ ]]; then
  echo ""
  echo "Uso: $0 <entorno> <target>"
  echo ""
  echo "  entorno : pre | pro"
  echo "  target  : app | api | all"
  echo ""
  echo "Ejemplos:"
  echo "  $0 pro all    → app + api a producción"
  echo "  $0 pre app    → solo app a preview"
  echo "  $0 pro api    → solo api a producción"
  echo ""
  exit 1
fi

# ─── Flags Vercel ────────────────────────────────────────────────────────────
if [ "$ENV" = "pro" ]; then
  VERCEL_FLAGS="--prod"
  ENV_LABEL="PRODUCCIÓN"
else
  VERCEL_FLAGS=""
  ENV_LABEL="PREVIEW (pre)"
fi

# ─── Función de despliegue ───────────────────────────────────────────────────
# Despliega desde la raíz del repo usando VERCEL_PROJECT_ID para identificar
# el proyecto. El rootDirectory (apps/api o apps/app) está configurado en
# los settings del proyecto en Vercel.
deploy() {
  local name="$1"
  local project_id="$2"

  echo ""
  echo "══════════════════════════════════════════════"
  echo "  gestion-requisitos-$name  [$ENV_LABEL]"
  echo "══════════════════════════════════════════════"

  # shellcheck disable=SC2086
  VERCEL_ORG_ID="$ORG_ID" VERCEL_PROJECT_ID="$project_id" \
    vercel deploy "$REPO_ROOT" --scope "$SCOPE" $VERCEL_FLAGS
}

# ─── Ejecutar ────────────────────────────────────────────────────────────────
if [ "$TARGET" = "app" ] || [ "$TARGET" = "all" ]; then
  deploy "app" "$APP_PROJECT_ID"
fi

if [ "$TARGET" = "api" ] || [ "$TARGET" = "all" ]; then
  deploy "api" "$API_PROJECT_ID"
fi

echo ""
echo "✓ Despliegue completado: [$ENV_LABEL] [$TARGET]"
echo ""
