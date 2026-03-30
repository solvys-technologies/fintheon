#!/bin/bash
# Installs the 'fintheon' CLI command
# After this, users can run: fintheon update, fintheon start, fintheon setup
set -e

FINTHEON_ROOT="${FINTHEON_ROOT:-$HOME/Documents/Codebases/fintheon}"
BIN_DIR="$HOME/.local/bin"
BIN_PATH="$BIN_DIR/fintheon"

mkdir -p "$BIN_DIR"

cat > "$BIN_PATH" <<SCRIPT
#!/bin/bash
# Fintheon CLI — dispatches to scripts in the repo
FINTHEON_ROOT="$FINTHEON_ROOT"

case "\$1" in
  update)
    bash "\$FINTHEON_ROOT/scripts/fintheon-update.sh"
    ;;
  setup)
    bash "\$FINTHEON_ROOT/scripts/fintheon-setup.sh"
    ;;
  start)
    echo "Starting Fintheon..."
    cd "\$FINTHEON_ROOT/backend-hono"
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 1
    nohup node dist/index.js > /tmp/fintheon-backend.log 2>&1 &
    echo "Backend PID: \$!"
    sleep 3
    open /Applications/Fintheon.app 2>/dev/null || echo "Launch: open /Applications/Fintheon.app"
    echo "Logs: tail -f /tmp/fintheon-backend.log"
    ;;
  stop)
    echo "Stopping..."
    pkill -f "Fintheon" 2>/dev/null || true
    pkill -f "electron.*fintheon" 2>/dev/null || true
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    echo "Stopped."
    ;;
  logs)
    tail -f /tmp/fintheon-backend.log
    ;;
  status)
    echo "Fintheon Status"
    echo ""
    lsof -i :8080 > /dev/null 2>&1 && echo "  ✓ Backend running on :8080" || echo "  ✗ Backend not running"
    command -v claude > /dev/null 2>&1 && echo "  ✓ Claude CLI installed" || echo "  ✗ Claude CLI missing"
    [ -x "\$HOME/.local/bin/twitter" ] && echo "  ✓ Twitter CLI installed" || echo "  ✗ Twitter CLI missing"
    [ -f /Applications/Fintheon.app/Contents/Info.plist ] && echo "  ✓ Fintheon.app installed" || echo "  ✗ Fintheon.app not found"
    ;;
  *)
    echo "Fintheon CLI"
    echo ""
    echo "  fintheon setup    First-time interactive setup"
    echo "  fintheon update   Pull latest, rebuild, restart"
    echo "  fintheon start    Start backend + launch app"
    echo "  fintheon stop     Stop everything"
    echo "  fintheon status   Check service health"
    echo "  fintheon logs     Tail backend logs"
    ;;
esac
SCRIPT

chmod +x "$BIN_PATH"

# Ensure ~/.local/bin is in PATH for both bash and zsh
add_to_path() {
  local RC_FILE="$1"
  local PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'
  if [ -f "$RC_FILE" ]; then
    if ! grep -q '.local/bin' "$RC_FILE" 2>/dev/null; then
      echo "" >> "$RC_FILE"
      echo "# Fintheon CLI" >> "$RC_FILE"
      echo "$PATH_LINE" >> "$RC_FILE"
    fi
  fi
}

add_to_path "$HOME/.zshrc"
add_to_path "$HOME/.bashrc"

# Also export for the current session
export PATH="$HOME/.local/bin:$PATH"

echo "✓ 'fintheon' command installed to $BIN_PATH"
echo "  Restart your terminal or run: export PATH=\"\$HOME/.local/bin:\$PATH\""
echo ""
echo "  Commands: fintheon setup | update | start | stop | status | logs"
