#!/usr/bin/env bash
# One-step installation for macOS and Linux: dependencies, setup, browsers,
# .env and doctor. Arguments are passed to npm run setup, for example
# ./install.sh --answers answers.json
set -euo pipefail
cd "$(dirname "$0")"

step() { printf '\n==> %s\n' "$1"; }

step "Checking Node.js and npm"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node.js 22.19 or newer (with nvm: nvm install 22), then run ./install.sh again." >&2
  exit 1
fi
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 19) ? 0 : 1)'; then
  echo "Node.js 22.19 or newer is required (found $(node -v)). With nvm: nvm install 22 && nvm use 22" >&2
  exit 1
fi
NPM_VERSION="$(node -p 'require("./package.json").packageManager.split("@")[1]')"
if [ "$(npm -v)" = "$NPM_VERSION" ]; then
  NPM=(npm)
else
  NPM=(npx -y "npm@$NPM_VERSION")
fi
echo "Node.js $(node -v), npm $NPM_VERSION"

step "Installing dependencies"
"${NPM[@]}" ci

# setup removes the template self-test, so its absence marks a configured
# project: a teammate's clone skips the questions and keeps the configuration.
if [ -f .qa/scripts/selftest.ts ]; then
  step "Configuring the project"
  npm run setup -- "$@"
else
  step "Project already configured; skipping setup"
  if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example. Fill in the credentials it lists."
  fi
fi

step "Installing browsers"
BROWSERS="$(npx tsx .qa/scripts/browsers.ts)"
if [ -z "$BROWSERS" ]; then
  echo "No browser tests are enabled; skipping."
else
  # The browser names are intentionally split into separate arguments.
  # shellcheck disable=SC2086
  npx playwright install --with-deps $BROWSERS
fi

step "Checking the configuration"
if ! npm run doctor; then
  echo
  echo "Installation finished, but doctor reported the problems above. Fix them, then run npm run doctor again." >&2
  exit 1
fi
