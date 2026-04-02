#!/bin/bash
# ============================================================================
# Fintheon CLI Installer — Registers `fintheon` as a global terminal command
# ============================================================================
# After running this, users can open ANY terminal and type:
#   fintheon update    — Pull latest, rebuild, restart
#   fintheon start     — Start backend + launch app
#   fintheon stop      — Stop everything
#   fintheon logs      — Tail backend logs
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
    echo ""
    echo "  Fintheon CLI v2.0.0"
    echo "  ────────────────────────────────"
    echo "  fintheon update    Pull latest, rebuild, restart"
    echo "  fintheon start     Start backend + launch app"
    echo "  fintheon stop      Stop everything"
    echo "  fintheon status    Check if services are running"
    echo "  fintheon logs      Tail backend logs"
    echo "  fintheon setup     Re-run first-time setup"
    echo "  fintheon version   Show current version"
    echo ""
    ;;
esac
SCRIPT

chmod +x "$INSTALL_DIR/fintheon"
echo "  ✓ 'fintheon' command installed to $INSTALL_DIR/fintheon"
echo "    Run: fintheon update"
