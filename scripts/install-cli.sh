#!/bin/bash
# ============================================================================
# Fintheon CLI Installer — Registers `fintheon` as a global terminal command
# ============================================================================
# After running this, users can open ANY terminal and type:
#   fintheon update    — Pull latest, rebuild, restart
#   fintheon start     — Start backend + launch app
#   fintheon stop      — Stop everything
#   fintheon logs      — Tail backend logs
#   fintheon login     — Sign in to TradingView/TopStepX/etc. via Google OAuth
#   fintheon peers     — Run per-device peer + Rettiwt + Agent Reach onboarding
#   fintheon setup     — Re-run first-time setup
#   fintheon version   — Show current version
# ============================================================================

# [claude-code 2026-04-18] Resolve install path: FINTHEON_ROOT env > ~/.fintheon/install-path > default
FINTHEON_ROOT="${FINTHEON_ROOT:-$(cat "$HOME/.fintheon/install-path" 2>/dev/null || echo "$HOME/Documents/Codebases/fintheon")}"
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
# [claude-code 2026-04-18] Resolve install path: FINTHEON_ROOT env > ~/.fintheon/install-path > default

FINTHEON_ROOT="${FINTHEON_ROOT:-$(cat "$HOME/.fintheon/install-path" 2>/dev/null || echo "$HOME/Documents/Codebases/fintheon")}"

# Verify repo exists
if [[ ! -d "$FINTHEON_ROOT/.git" ]] && [[ "$1" != "setup" ]]; then
  echo ""
  echo "  Fintheon not found at $FINTHEON_ROOT"
  echo "  Run setup first:"
  echo ""
  echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/v7.0.6/scripts/fintheon-setup.sh)"'
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
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/v7.0.6/scripts/fintheon-setup.sh)"
    fi
    ;;
  start)
    if [[ "$2" == "backend" ]]; then
      # Backend-only restart — no app relaunch
      echo ""
      echo "  Restarting backend..."
      PLIST="$HOME/Library/LaunchAgents/io.solvys.fintheon-backend.plist"
      SRC="$FINTHEON_ROOT/launchd/io.solvys.fintheon-backend.plist"
      if [[ -f "$SRC" && ! -e "$PLIST" ]]; then
        ln -s "$SRC" "$PLIST" 2>/dev/null || true
      fi
      if [[ -f "$PLIST" ]]; then
        launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load -w "$PLIST" 2>/dev/null || true
        launchctl kickstart -k "gui/$(id -u)/io.solvys.fintheon-backend" 2>/dev/null || true
      else
        cd "$FINTHEON_ROOT/backend-hono" || exit 1
        nohup bun run src/index.ts > /tmp/fintheon-backend.log 2>&1 &
      fi
      for i in {1..10}; do
        if curl -s localhost:8080/health > /dev/null 2>&1; then
          echo "  ✓ Backend live"
          break
        fi
        sleep 2
        if [[ $i -eq 10 ]]; then
          echo "  ⚠ Backend slow — check: tail -f /tmp/fintheon-backend.log"
        fi
      done
      echo ""
    else
      echo ""
      echo "  Starting Fintheon..."
      echo ""

      # Start backend
      PLIST="$HOME/Library/LaunchAgents/io.solvys.fintheon-backend.plist"
      SRC="$FINTHEON_ROOT/launchd/io.solvys.fintheon-backend.plist"
      if [[ -f "$SRC" && ! -e "$PLIST" ]]; then
        ln -s "$SRC" "$PLIST" 2>/dev/null || true
      fi
      if [[ -f "$PLIST" ]]; then
        launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load -w "$PLIST" 2>/dev/null || true
        launchctl kickstart -k "gui/$(id -u)/io.solvys.fintheon-backend" 2>/dev/null || true
      else
        cd "$FINTHEON_ROOT/backend-hono" || exit 1
        nohup bun run src/index.ts > /tmp/fintheon-backend.log 2>&1 &
      fi

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
    fi
    ;;
  stop)
    echo ""
    echo "  Stopping Fintheon..."
    pkill -f "Fintheon" 2>/dev/null || true
    pkill -f "electron.*fintheon" 2>/dev/null || true
    echo "  ✓ App stopped; backend engine remains running"
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
  doctor)
    echo ""
    echo "  Fintheon Doctor — System Health Check"
    echo "  ────────────────────────────────────────"

    # Backend
    if curl -s localhost:8080/health > /dev/null 2>&1; then
      echo "  Backend:      ✓ Running on :8080"
    else
      echo "  Backend:      ✗ Not running"
    fi

    # Strands SDK
    if [[ -d "$FINTHEON_ROOT/backend-hono/node_modules/@strands-agents" ]]; then
      STRANDS_VER=$(cat "$FINTHEON_ROOT/backend-hono/node_modules/@strands-agents/sdk/package.json" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
      echo "  Strands SDK:  ✓ $STRANDS_VER"
    else
      echo "  Strands SDK:  ✗ Not installed (run: fintheon update)"
    fi

    # Zod version
    ZOD_VER=$(cat "$FINTHEON_ROOT/backend-hono/node_modules/zod/package.json" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
    if [[ "$ZOD_VER" == 4* ]]; then
      echo "  Zod:          ✓ v$ZOD_VER"
    else
      echo "  Zod:          ✗ v$ZOD_VER (need v4+, run: fintheon update)"
    fi

    # jq
    if command -v jq &>/dev/null; then
      echo "  jq:           ✓ $(jq --version 2>/dev/null || echo 'available')"
    else
      echo "  jq:           ⚠ Missing (diagnostics use python3 fallback)"
    fi

    # Build check
    cd "$FINTHEON_ROOT/backend-hono" 2>/dev/null
    if bun run build 2>&1 | tail -1 | grep -q "tsc"; then
      echo "  Build:        ✓ Compiles"
    else
      echo "  Build:        ✗ Errors present"
    fi

    # App
    if [[ -d /Applications/Fintheon.app ]]; then
      echo "  App:          ✓ Installed"
    else
      echo "  App:          ✗ Not installed"
    fi

    # Git
    cd "$FINTHEON_ROOT" 2>/dev/null
    echo "  Version:      $(git describe --tags --abbrev=0 2>/dev/null || echo 'unknown')"
    echo "  Branch:       $(git branch --show-current 2>/dev/null || echo 'unknown')"
    DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$DIRTY" -eq 0 ]]; then
      echo "  Working tree:  Clean"
    else
      echo "  Working tree:  $DIRTY uncommitted changes"
    fi

    echo ""
    ;;
  version)
    cd "$FINTHEON_ROOT" 2>/dev/null || exit 1
    VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "unknown")
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
    echo "  Version:  $(git describe --tags --abbrev=0 2>/dev/null || echo 'unknown')"
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
    printf "  ${_G}start backend${_R}  ${_D}Restart backend only (no app relaunch)${_R}\n"
    printf "  ${_G}stop${_R}      ${_D}Stop everything${_R}\n"
    printf "  ${_G}status${_R}    ${_D}Check if services are running${_R}\n"
    printf "  ${_G}logs${_R}      ${_D}Tail backend logs${_R}\n"
    printf "  ${_G}login${_R}     ${_D}Sign in to trading platforms${_R}\n"
    printf "  ${_G}peers${_R}     ${_D}Peer + Rettiwt + Agent Reach onboarding${_R}\n"
    printf "  ${_G}setup${_R}     ${_D}Re-run first-time setup${_R}\n"
    printf "  ${_G}doctor${_R}    ${_D}Full system health check${_R}\n"
    printf "  ${_G}version${_R}   ${_D}Show current version${_R}\n"
    echo ""
    ;;
esac
SCRIPT

chmod +x "$INSTALL_DIR/fintheon"
echo "  ✓ 'fintheon' command installed to $INSTALL_DIR/fintheon"
echo "    Run: fintheon update"
