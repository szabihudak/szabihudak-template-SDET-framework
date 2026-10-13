#!/usr/bin/env bash
# One-step installation for macOS and Linux.
#
# Stage 1, framework setup. In the template: asks the setup questions, creates
# the project in a new folder next to the template (../<project name>) and
# installs it there. In a project (a teammate's clone): installs dependencies,
# creates .env, installs the configured browsers and runs doctor.
# Stage 2, first tests (optional, npm run onboard): asks for the test account
# and puts it into .env. Skipped without a terminal, in CI and with --answers.
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

# The two stages, on a terminal only: the overview from framework/install
# once at the start, a progress line at the start of each stage, and the
# stage's steps as a small flow, redrawn as it advances: [x] marks a finished
# step and = borders (in color unless NO_COLOR) the current one.
overview() {
  [ -t 1 ] && [ -f framework/install/stages.txt ] || return 0
  echo
  cat framework/install/stages.txt
}

stage() {
  if [ ! -t 1 ]; then
    if [ "$1" = 1 ]; then
      printf '\n=== Stage 1: Framework setup ===\n'
    else
      printf '\n=== Stage 2: First tests (optional) ===\n'
    fi
    return 0
  fi
  if [ "$1" = 1 ]; then
    printf '\n  [>] Stage 1: Framework setup  ====>  [ ] Stage 2: First tests (optional)\n'
  else
    printf '\n  [x] Stage 1: Framework setup  ====>  [>] Stage 2: First tests (optional)\n'
  fi
}

# flow <stage> <current step, counted from 0>
flow() {
  [ -t 1 ] || return 0
  local title labels i label edge sep top='' middle='' bottom='' on='' off=''
  if [ "$1" = 1 ]; then
    title="STAGE 1 - Framework setup"
    labels=(project install browsers doctor)
  else
    title="STAGE 2 - First tests (optional)"
    labels=("test account" "/first-tests (AI)" "review & run")
  fi
  if [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != dumb ]; then
    on=$'\033[1;36m'
    off=$'\033[0m'
  fi
  for i in "${!labels[@]}"; do
    label="${labels[$i]}"
    if [ "$i" -lt "$2" ]; then label="[x] $label"; fi
    edge="$(printf '%*s' $((${#label} + 2)) '' | tr ' ' "$([ "$i" -eq "$2" ] && echo = || echo -)")"
    sep=''
    if [ "$i" -gt 0 ]; then sep='    '; fi
    if [ "$i" -eq "$2" ]; then
      top+="$sep$on+$edge+$off"
      bottom+="$sep$on+$edge+$off"
      middle+="${sep:+ -> }$on| $label |$off"
    else
      top+="$sep+$edge+"
      bottom+="$sep+$edge+"
      middle+="${sep:+ -> }| $label |"
    fi
  done
  printf '\n  %s\n  %s\n  %s\n  %s\n' "$title" "$top" "$middle" "$bottom"
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
  flow 1 1
  step "Installing dependencies"
  "${NPM[@]}" ci

  if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example."
  fi

  flow 1 2
  step "Installing browsers"
  BROWSERS="$(npx tsx framework/tools/browsers.ts)"
  if [ -z "$BROWSERS" ]; then
    echo "No browser tests are enabled; skipping."
  else
    # The browser names are intentionally split into separate arguments.
    # shellcheck disable=SC2086
    npx playwright install --with-deps $BROWSERS
  fi

  flow 1 3
  step "Checking the configuration"
  DOCTOR_OK=1
  npm run doctor || DOCTOR_OK=0

  stage 2
  flow 2 0
  ONBOARD_RESULT="$(mktemp)"
  QA_ONBOARD_RESULT="$ONBOARD_RESULT" npm run onboard || true
  ONBOARD="$(cat "$ONBOARD_RESULT")"
  rm -f "$ONBOARD_RESULT"

  # New credentials can fix doctor's credential check, or let it try the login.
  if [ "$ONBOARD" = done ]; then
    step "Checking the configuration with the test account"
    DOCTOR_OK=1
    npm run doctor || DOCTOR_OK=0
  fi
}

summary() {
  # The installer's part of stage 2 ends at the test account; the AI steps follow.
  if [ "$ONBOARD" = done ]; then flow 2 1; fi
  echo
  if [ "$DOCTOR_OK" = 1 ]; then
    echo "  [x] Stage 1  Framework setup   done"
  else
    echo "  [!] Stage 1  Framework setup   doctor reported problems -> fix them, then run: npm run doctor"
  fi
  case "$ONBOARD" in
    done) echo "  [x] Stage 2  First tests       test account in .env -> next: /first-tests" ;;
    incomplete) echo "  [!] Stage 2  First tests       incomplete -> fill in .env, or run: npm run onboard" ;;
    *) echo "  [-] Stage 2  First tests       skipped -> run: npm run onboard" ;;
  esac
}

finish() {
  summary
  echo
  if [ -n "${1:-}" ]; then echo "Your project is in $1"; fi
  echo "Next: ${1:+cd \"$1\", then }write the first tests with /first-tests (or framework/docs/FIRST_TESTS_PROMPT.md)."
  if [ "$DOCTOR_OK" != 1 ]; then exit 1; fi
}

# An answers file means an unattended run: stage 2 asks nothing.
for arg in "$@"; do
  if [ "$arg" = --answers ]; then export QA_NONINTERACTIVE=1; fi
done

banner
overview
stage 1
check_runtime

# setup.ts is template-only: projects do not contain it.
if [ ! -f framework/tools/setup.ts ]; then
  install_project
  finish
  exit 0
fi

flow 1 0
step "Installing the template's dependencies"
"${NPM[@]}" ci

step "Creating the project"
RESULT="$(mktemp)"
trap 'rm -f "$RESULT"' EXIT
QA_SETUP_RESULT="$RESULT" npm run setup -- "$@"
PROJECT="$(cat "$RESULT")"

cd "$PROJECT"
install_project
finish "$PROJECT"
