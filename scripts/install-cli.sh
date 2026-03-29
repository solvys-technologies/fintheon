#!/bin/bash
# Installs the 'fintheon' command to /usr/local/bin
# After this, team members can run: fintheon update

FINTHEON_ROOT="${FINTHEON_ROOT:-$HOME/Documents/Codebases/fintheon}"

cat > /usr/local/bin/fintheon <<SCRIPT
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
    echo "Starting backend..."
    cd "\$FINTHEON_ROOT/backend-hono"
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 1
    nohup node dist/index.js > /tmp/fintheon-backend.log 2>&1 &
    echo "Backend PID: \$!"
    sleep 3
    open /Applications/Fintheon.app 2>/dev/null
    echo "Fintheon launched. Logs: tail -f /tmp/fintheon-backend.log"
    ;;
  stop)
    echo "Stopping..."
    pkill -f "Fintheon" 2>/dev/null || true
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    echo "Stopped."
    ;;
  logs)
    tail -f /tmp/fintheon-backend.log
    ;;
  *)
    echo "Fintheon CLI"
    echo ""
    echo "  fintheon update   Pull latest, rebuild, restart"
    echo "  fintheon start    Start backend + launch app"
    echo "  fintheon stop     Stop everything"
    echo "  fintheon logs     Tail backend logs"
    echo "  fintheon setup    First-time setup"
    ;;
esac
SCRIPT

chmod +x /usr/local/bin/fintheon
echo "✓ 'fintheon' command installed. Run: fintheon update"
