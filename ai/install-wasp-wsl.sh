#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="$HOME/.nvm"

echo "==> Installing nvm if missing"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

echo "==> Installing Node 24"
nvm install 24
nvm alias default 24

echo "==> Node/npm versions"
node -v
npm -v

echo "==> Installing Wasp CLI"
npm i -g @wasp.sh/wasp-cli@latest

echo "==> Ensuring PATH for non-interactive shells"
PROFILE="$HOME/.bashrc"
if ! grep -q 'NVM_DIR' "$PROFILE" 2>/dev/null; then
  cat >> "$PROFILE" <<'EOF'

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
EOF
fi

echo "==> Wasp check"
hash -r
command -v wasp
wasp version || wasp --help | head -5

echo "==> Done"
