#!/bin/bash
# Clona el skeleton de viteapps en viteapps-projects/<CODIGO> sin historial git.
# Uso: ./scripts/ejecucion/clonar_repositorio.sh COD0001

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

if [[ -d "$DESTINO" ]]; then
  echo "Error: el directorio '$DESTINO' ya existe."
  exit 1
fi

echo "→ Clonando skeleton en $DESTINO ..."
git clone --depth=1 "$SKELETON_REPO" "$DESTINO"

echo "→ Eliminando historial git..."
git -C "$DESTINO" remote remove origin
rm -rf "$DESTINO/.git"

echo ""
echo "✓ Proyecto limpio en viteapps-projects/$CODIGO"
