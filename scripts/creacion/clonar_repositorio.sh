#!/bin/bash
# Clona el skeleton de viteapps en viteapps-projects/<CODIGO> sin historial git,
# inicializa git y crea el repositorio privado en GitHub (sin push inicial).
# El commit inicial lo hace el cron tras escribir USER_REQUIREMENTS.txt.
# Uso: ./scripts/creacion/clonar_repositorio.sh COD0001

set -euo pipefail

SKELETON_REPO="https://github.com/jalvarez2000/viteapps-skeleton"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VITEAPPS_DIR="$REPO_ROOT/viteapps-projects"

CODIGO="${1:-}"

if [[ -z "$CODIGO" ]]; then
  echo "Error: debes indicar el código del proyecto."
  echo "Uso: $0 <CODIGO>"
  exit 1
fi

DESTINO="$VITEAPPS_DIR/$CODIGO"
GITHUB_REPO_NAME="viteapps-$(echo "$CODIGO" | tr '[:upper:]' '[:lower:]')"

if [[ -d "$DESTINO" ]]; then
  echo "→ Directorio existente, eliminando para clonar de nuevo..."
  rm -rf "$DESTINO"
fi

echo "→ Clonando skeleton en $DESTINO ..."
git clone --depth=1 "$SKELETON_REPO" "$DESTINO"

echo "→ Eliminando historial git..."
git -C "$DESTINO" remote remove origin
rm -rf "$DESTINO/.git"

echo "→ Inicializando repositorio git..."
git -C "$DESTINO" init

echo "→ Parcheando setup.sh para ejecución no-interactiva..."
NEON_ORG_ID="$(neon orgs list --output json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d[0]?.id ?? '')" 2>/dev/null || echo "")"
if [[ -n "$NEON_ORG_ID" ]]; then
  sed -i '' "s|neon project create|neon project create --org-id \"$NEON_ORG_ID\"|g" "$DESTINO/scripts/despliegue/setup.sh"
  echo "→ setup.sh parcheado con org-id: $NEON_ORG_ID"
fi

echo "→ Creando repositorio GitHub privado: $GITHUB_REPO_NAME ..."
GITHUB_USER=$(gh api user --jq .login)
gh repo delete "$GITHUB_USER/$GITHUB_REPO_NAME" --yes 2>/dev/null || true
gh repo create "$GITHUB_USER/$GITHUB_REPO_NAME" --private
git -C "$DESTINO" remote add origin "https://github.com/$GITHUB_USER/$GITHUB_REPO_NAME.git"
echo "→ Remote configurado: https://github.com/$GITHUB_USER/$GITHUB_REPO_NAME.git"

echo ""
echo "✓ Proyecto listo en viteapps-projects/$CODIGO (sin commit inicial — pendiente de requisitos)"
