#!/usr/bin/env bash
# One-step installation for macOS and Linux.
#
# In the template: asks the setup questions, creates the project in a new
# folder next to the template (../<project name>) and installs it there.
# In a project (a teammate's clone): installs dependencies, creates .env,
# installs the configured browsers and runs doctor.
#
# Arguments are passed to setup, for example ./install.sh --answers answers.json
set -euo pipefail
cd "$(dirname "$0")"

step() { printf '\n==> %s\n' "$1"; }

# The punk robot from framework/setup/banner.txt (template only), printed to a
# terminal only so CI logs stay clean; color unless NO_COLOR is set.
# npm run setup is told not to print it again.
banner() {
  local file=framework/setup/banner.txt
  [ -t 1 ] && [ -f "$file" ] || return 0
  if [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != dumb ]; then
    awk 'NR <= 3 { printf "\033[35m%s\033[0m\n", $0; next }
      /SDET FRAMEWORK/ { printf "\033[1m%s\033[0m\n", $0; next }
      { print }' "$file"
  else
    cat "$file"
  fi
  export QA_BANNER_SHOWN=1
}

check_runtime() {
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
}

install_project() {
  step "Installing dependencies"
  "${NPM[@]}" ci

  if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example. Fill in the credentials it lists."
  fi

  step "Installing browsers"
  BROWSERS="$(npx tsx framework/tools/browsers.ts)"
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
}

banner
check_runtime

# setup.ts is template-only: projects do not contain it.
if [ ! -f framework/tools/setup.ts ]; then
  install_project
  exit 0
fi

step "Installing the template's dependencies"
"${NPM[@]}" ci

step "Creating the project"
RESULT="$(mktemp)"
trap 'rm -f "$RESULT"' EXIT
QA_SETUP_RESULT="$RESULT" npm run setup -- "$@"
PROJECT="$(cat "$RESULT")"

cd "$PROJECT"
install_project

step "Done"
echo "Your project is in $PROJECT"
echo "Next: cd \"$PROJECT\", then configure login and write the first tests (/first-tests, or framework/docs/FIRST_TESTS_PROMPT.md)."
