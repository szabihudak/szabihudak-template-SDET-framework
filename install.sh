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
# Where the user started, so the closing steps can say how to reach the project.
START_DIR="$PWD"
cd "$(dirname "$0")"

step() { printf '\n==> %s\n' "$1"; }

# Color (text color and bold only, readable on light and dark themes) on a
# terminal unless NO_COLOR is set. Emoji marks only where the terminal can show
# them (a UTF-8 locale); elsewhere their ASCII forms.
COLOR=0
EMOJI=0
if [ -t 1 ] && [ "${TERM:-dumb}" != dumb ]; then
  if [ -z "${NO_COLOR:-}" ]; then COLOR=1; fi
  if [ "${TERM:-}" != linux ]; then
    case "${LC_ALL:-${LC_CTYPE:-${LANG:-}}}" in
      *[Uu][Tt][Ff]-8* | *[Uu][Tt][Ff]8*) EMOJI=1 ;;
    esac
  fi
fi

# paint <SGR code> <text>: 1 bold, 2 dim, 31 red, 32 green, 33 yellow, 1;36 bold cyan
paint() {
  if [ "$COLOR" = 1 ] && [ -n "$1" ]; then
    printf '\033[%sm%s\033[0m' "$1" "$2"
  else
    printf '%s' "$2"
  fi
}

# mark <emoji> <ASCII form>
mark() {
  if [ "$EMOJI" = 1 ]; then printf '%s' "$1"; else printf '%s' "$2"; fi
}

# The punk robot from framework/setup/banner.txt (template only), printed to a
# terminal only so CI logs stay clean; its mohawk in magenta.
# npm run setup is told not to print it again.
banner() {
  local file=framework/setup/banner.txt
  [ -t 1 ] && [ -f "$file" ] || return 0
  if [ "$COLOR" = 1 ]; then
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
# step and = borders (in color unless NO_COLOR) the current one. Stage 2 is
# split: the installer asks for the test account, the rest happens in the IDE.
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
    printf '\n  [>] Stage 1: Framework setup  ====>  [ ] Stage 2: First tests %s\n' "$(paint 33 '(optional)')"
  else
    printf '\n  %s Stage 1: Framework setup  ====>  [>] Stage 2: First tests %s\n' "$(paint 32 '[x]')" "$(paint 33 '(optional)')"
  fi
}

# flow <stage> <current step, counted from 0>: the current step is bold, the
# steps that happen in the IDE are dim.
flow() {
  [ -t 1 ] || return 0
  local title labels i label text style edge sep arrow pad split=-1 width=0 top='' middle='' bottom=''
  if [ "$1" = 1 ]; then
    title="$(mark '🚀' '>>') $(paint '1;36' 'STAGE 1 - Framework setup')"
    labels=(project install browsers doctor)
  else
    title="$(mark '🧪' '>>') $(paint '1;36' 'STAGE 2 - First tests') $(paint 33 '(optional)')"
    labels=("test account" "login" "first tests")
    split=1
  fi
  for i in "${!labels[@]}"; do
    label="${labels[$i]}"
    text="$label"
    if [ "$i" -lt "$2" ]; then
      label="[x] $label"
      text="$(paint 32 '[x]') $text"
    fi
    edge="$(printf '%*s' $((${#label} + 2)) '' | tr ' ' "$([ "$i" -eq "$2" ] && echo = || echo -)")"
    style=''
    if [ "$i" -eq "$2" ]; then
      style=1
    elif [ "$split" -ge 0 ] && [ "$i" -ge "$split" ]; then
      style=2
    fi
    sep='' arrow=''
    if [ "$i" -eq "$split" ]; then
      sep='  |  ' arrow='  |  '
    elif [ "$i" -gt 0 ]; then
      sep='    ' arrow=' -> '
    fi
    top+="$sep$(paint "$style" "+$edge+")"
    bottom+="$sep$(paint "$style" "+$edge+")"
    if [ -n "$style" ]; then
      middle+="$arrow$(paint "$style" "| $label |")"
    else
      middle+="$arrow| $text |"
    fi
    if [ "$i" -lt "$split" ]; then width=$((width + ${#sep} + ${#label} + 4)); fi
  done
  printf '\n  %s\n' "$title"
  if [ "$split" -gt 0 ]; then
    printf -v pad '%-*s' "$width" "   INSTALLER"
    printf '  %s  |  %s\n' "$pad" "$(paint 2 'NEXT: IN YOUR IDE')"
  fi
  printf '  %s\n  %s\n  %s\n' "$top" "$middle" "$bottom"
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
    echo "  $(mark '✅' '[x]') $(paint 32 'Stage 1  Framework setup   done')"
  else
    echo "  $(mark '❌' '[!]') $(paint 31 'Stage 1  Framework setup   doctor reported problems -> fix them, then run: npm run doctor')"
  fi
  case "$ONBOARD" in
    done) echo "  $(mark '✅' '[x]') $(paint 32 'Stage 2  First tests       test account in .env -> next: configure login')" ;;
    incomplete) echo "  $(mark '❌' '[!]') $(paint 31 'Stage 2  First tests       incomplete -> fill in .env, or run: npm run onboard')" ;;
    *) echo "  $(mark '⏭️' '[-]') $(paint 33 'Stage 2  First tests       skipped -> run: npm run onboard')" ;;
  esac
}

# The finish box (on a terminal) and the next steps in the IDE, for the AI
# tools setup installed: framework/tools/finish.ts.
finish() {
  summary
  if [ -n "${1:-}" ]; then
    echo
    echo "Your project is in $1"
  fi
  QA_COLOR="$COLOR" QA_EMOJI="$EMOJI" npx tsx framework/tools/finish.ts "$ONBOARD" "$DOCTOR_OK" "$START_DIR" "${1:-}"
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
