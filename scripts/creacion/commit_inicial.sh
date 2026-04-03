#!/bin/bash
# Hace el commit inicial (skeleton + requisitos) y sube al repo GitHub.
# Uso: ./scripts/creacion/commit_inicial.sh <CODIGO>

set -euo pipefail

export PATH="$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CODIGO="${1:-}"

if [[ -z "$CODIGO" ]]; then
  echo "Error: debes indicar el código del proyecto."
  exit 1
fi

DESTINO="$REPO_ROOT/viteapps-projects/$CODIGO"

if [[ ! -d "$DESTINO/.git" ]]; then
  echo "Error: $DESTINO no tiene repositorio git inicializado."
  exit 1
fi

echo "→ Aprovisionando base de datos, secretos y aplicativos..."
bash "$DESTINO/scripts/despliegue/setup.sh" "$CODIGO" 2>&1

gh auth setup-git

git -C "$DESTINO" add -A
git -C "$DESTINO" commit -m "chore: skeleton + requisitos iniciales"
git -C "$DESTINO" push -u origin HEAD

echo "✓ Commit inicial subido a GitHub para $CODIGO"
