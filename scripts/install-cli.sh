#!/bin/bash
# ============================================================================
# Fintheon CLI Installer — Registers `fintheon` as a global terminal command
# ============================================================================
# After running this, users can open ANY terminal and type:
#   fintheon update    — Pull latest, rebuild, restart
#   fintheon start     — Start backend + launch app
#   fintheon stop      — Stop everything
#   fintheon logs      — Tail backend logs
#   fintheon oauth     — Connect Anthropic subscription via VProxy
#   fintheon login     — Sign in to TradingView/TopStepX/etc. via Google OAuth
#   fintheon peers     — Run per-device peer/Twitter onboarding
#   fintheon setup     — Re-run first-time setup
#   fintheon version   — Show current version
# ============================================================================

FINTHEON_ROOT="${FINTHEON_ROOT:-$HOME/Documents/Codebases/fintheon}"
CLI_VERSION="2.0.0"

# Determine install location
if [[ -d /usr/local/bin ]] && [[ -w /usr/local/bin ]]; then
  INSTALL_DIR="/usr/local/bin"
elif [[ -d "$HOME/.local/bin" ]]; then
  INSTALL_DIR="$HOME/.local/bin"
else
  mkdir -p "$HOME/.local/bin"
  INSTALL_DIR="$HOME/.local/bin"

  # Ensure ~/.local/bin is in PATH
  SHELL_PROFILE="$HOME/.zprofile"
  if ! grep -q '.local/bin' "$SHELL_PROFILE" 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_PROFILE"
  fi
fi

cat > "$INSTALL_DIR/fintheon" << 'SCRIPT'
#!/bin/bash
# Fintheon CLI v2.0.0 — Priced In Capital
# Dispatches commands to the Fintheon repo scripts

FINTHEON_ROOT="${FINTHEON_ROOT:-$HOME/Documents/Codebases/fintheon}"

# Verify repo exists
if [[ ! -d "$FINTHEON_ROOT/.git" ]] && [[ "$1" != "setup" ]]; then
  echo ""
  echo "  Fintheon not found at $FINTHEON_ROOT"
  echo "  Run setup first:"
  echo ""
  echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh)"'
  echo ""
  exit 1
fi

case "$1" in
  update)
    bash "$FINTHEON_ROOT/scripts/fintheon-update.sh"
    ;;
  setup)
    if [[ -f "$FINTHEON_ROOT/scripts/fintheon-setup.sh" ]]; then
      bash "$FINTHEON_ROOT/scripts/fintheon-setup.sh"
    else
      echo "Downloading setup script..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh)"
    fi
    ;;
  start)
    echo ""
    echo "  Starting Fintheon..."
    echo ""

    # Start backend
    cd "$FINTHEON_ROOT/backend-hono" || exit 1
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 1
    nohup node dist/index.js > /tmp/fintheon-backend.log 2>&1 &
    BACKEND_PID=$!
    echo "  Backend PID: $BACKEND_PID"

    # Wait for health
    for i in {1..10}; do
      if curl -s localhost:8080/health > /dev/null 2>&1; then
        echo "  ✓ Backend is live"
        break
      fi
      sleep 2
    done

    # Launch app
    if [[ -d /Applications/Fintheon.app ]]; then
      open /Applications/Fintheon.app
      echo "  ✓ Fintheon launched"
    else
      echo "  No app found — open http://localhost:5173 in your browser"
      echo "  Or build the app: cd $FINTHEON_ROOT && npm run desktop:build"
    fi

    echo ""
    echo "  Logs: tail -f /tmp/fintheon-backend.log"
    echo ""
    ;;
  stop)
    echo ""
    echo "  Stopping Fintheon..."
    pkill -f "Fintheon" 2>/dev/null || true
    pkill -f "electron.*fintheon" 2>/dev/null || true
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    echo "  ✓ Stopped"
    echo ""
    ;;
  logs)
    if [[ -f /tmp/fintheon-backend.log ]]; then
      tail -f /tmp/fintheon-backend.log
    else
      echo "  No log file found. Is the backend running?"
      echo "  Start with: fintheon start"
    fi
    ;;
  oauth)
    if [[ -f "$FINTHEON_ROOT/scripts/vproxy-anthropic-oauth.sh" ]]; then
      bash "$FINTHEON_ROOT/scripts/vproxy-anthropic-oauth.sh"
    else
      echo "  Missing script: $FINTHEON_ROOT/scripts/vproxy-anthropic-oauth.sh"
      exit 1
    fi
    ;;
  login)
    PLATFORM="${2:-tradingview}"
    echo ""
    echo "  Opening $PLATFORM sign-in window..."
    echo "  Sign in with Google, then close the window."
    echo ""
    cd "$FINTHEON_ROOT" && npx electron scripts/platform-oauth.cjs "$PLATFORM"
    ;;
  peers)
    if [[ -f "$FINTHEON_ROOT/scripts/peer-bootstrap.sh" ]]; then
      bash "$FINTHEON_ROOT/scripts/peer-bootstrap.sh"
    else
      echo "  peer-bootstrap.sh not found in $FINTHEON_ROOT/scripts"
      exit 1
    fi
    ;;
  version)
    cd "$FINTHEON_ROOT" 2>/dev/null || exit 1
    VERSION=$(git describe --tags --always 2>/dev/null || echo "unknown")
    BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    echo ""
    echo "  Fintheon $VERSION ($BRANCH)"
    echo "  Path: $FINTHEON_ROOT"
    echo ""
    ;;
  status)
    echo ""
    echo "  Fintheon Status"
    echo "  ────────────────────────────────"

    # Backend
    if curl -s localhost:8080/health > /dev/null 2>&1; then
      echo "  Backend:  ✓ Running on :8080"
    else
      echo "  Backend:  ✗ Not running"
    fi

    # App
    if pgrep -f "Fintheon" > /dev/null 2>&1; then
      echo "  App:      ✓ Running"
    else
      echo "  App:      ✗ Not running"
    fi

    # Version
    cd "$FINTHEON_ROOT" 2>/dev/null || exit 1
    echo "  Version:  $(git describe --tags --always 2>/dev/null || echo 'unknown')"
    echo "  Branch:   $(git branch --show-current 2>/dev/null || echo 'unknown')"
    echo ""
    ;;
  *)
    _R=$'\033[0m'
    _G=$'\033[38;2;199;159;74m'
    _C=$'\033[38;2;240;234;214m'
    _D=$'\033[38;2;100;85;50m'
    _F1=$'\033[38;2;255;100;20m'
    _F2=$'\033[38;2;255;160;40m'
    _F3=$'\033[38;2;255;210;80m'
    _EM=$'\033[38;2;180;60;20m'
    _B=$'\033[1m'
    echo ""
    printf "      ${_F3}  )  ${_R}                                    ${_F3}  )  ${_R}\n"
    printf "      ${_F2} ( ) ${_R}                                    ${_F2} ( ) ${_R}\n"
    printf "      ${_F1}  )(  ${_R}                                   ${_F1}  )(  ${_R}\n"
    printf "      ${_EM} /||\ ${_R}                                   ${_EM} /||\ ${_R}\n"
    printf "      ${_G}]||||[${_R}  ${_G}╔══════════════════════════════╗${_R}  ${_G}]||||[${_R}\n"
    printf "      ${_G}]||||[${_R}  ${_G}║${_R} ${_B}${_G}%-30s${_R}${_G}║${_R}  ${_G}]||||[${_R}\n" "FINTHEON CLI v2.0.0"
    printf "      ${_G}]||||[${_R}  ${_G}║${_R} ${_D}%-30s${_R}${_G}║${_R}  ${_G}]||||[${_R}\n" "Priced In Capital"
    printf "      ${_G}]||||[${_R}  ${_G}╚══════════════════════════════╝${_R}  ${_G}]||||[${_R}\n"
    printf "      ${_D} ╨╨╨╨ ${_R}                                    ${_D} ╨╨╨╨ ${_R}\n"
    echo ""
    printf "  ${_G}update${_R}    ${_D}Pull latest, rebuild, restart${_R}\n"
    printf "  ${_G}start${_R}     ${_D}Start backend + launch app${_R}\n"
    printf "  ${_G}stop${_R}      ${_D}Stop everything${_R}\n"
    printf "  ${_G}status${_R}    ${_D}Check if services are running${_R}\n"
    printf "  ${_G}logs${_R}      ${_D}Tail backend logs${_R}\n"
    printf "  ${_G}oauth${_R}     ${_D}Connect Anthropic via VProxy${_R}\n"
    printf "  ${_G}login${_R}     ${_D}Sign in to trading platforms${_R}\n"
    printf "  ${_G}peers${_R}     ${_D}Peer + Twitter onboarding${_R}\n"
    printf "  ${_G}setup${_R}     ${_D}Re-run first-time setup${_R}\n"
    printf "  ${_G}version${_R}   ${_D}Show current version${_R}\n"
    echo ""
    ;;
esac
SCRIPT

chmod +x "$INSTALL_DIR/fintheon"
echo "  ✓ 'fintheon' command installed to $INSTALL_DIR/fintheon"
echo "    Run: fintheon update"
