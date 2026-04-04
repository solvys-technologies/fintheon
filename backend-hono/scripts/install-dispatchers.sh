#!/usr/bin/env bash
# install-dispatchers.sh — Install all Fintheon brief dispatch launchd agents
# Run once on Mac: bash ~/Documents/Codebases/fintheon/backend-hono/scripts/install-dispatchers.sh

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LOGS_DIR="$(dirname "$SCRIPTS_DIR")/logs"

echo "=== Fintheon Dispatch Installer ==="
echo "Scripts dir: $SCRIPTS_DIR"
echo "LaunchAgents: $LAUNCH_AGENTS_DIR"
echo ""

# Ensure logs dir
mkdir -p "$LOGS_DIR"

# Unload existing (ignore errors if not loaded)
PLISTS=(
  "com.fintheon.dispatch-mdb"
  "com.fintheon.dispatch-adb"
  "com.fintheon.dispatch-pmdb"
  "com.fintheon.dispatch-tott"
)

echo "--- Unloading existing agents (if any) ---"
for plist in "${PLISTS[@]}"; do
  launchctl unload "$LAUNCH_AGENTS_DIR/$plist.plist" 2>/dev/null && echo "  Unloaded $plist" || echo "  $plist not loaded (skip)"
done

echo ""
echo "--- Making scripts executable ---"
chmod +x "$SCRIPTS_DIR"/dispatch-*.sh
echo "  Done"

echo ""
echo "--- Copying plists to ~/Library/LaunchAgents ---"
for plist in "${PLISTS[@]}"; do
  cp "$SCRIPTS_DIR/$plist.plist" "$LAUNCH_AGENTS_DIR/"
  echo "  Copied $plist.plist"
done

echo ""
echo "--- Loading agents ---"
for plist in "${PLISTS[@]}"; do
  launchctl load "$LAUNCH_AGENTS_DIR/$plist.plist"
  echo "  Loaded $plist"
done

echo ""
echo "=== Installed ==="
echo ""
echo "Schedule:"
echo "  MDB   6:30 AM ET  Mon-Fri"
echo "  ADB  10:45 AM ET  Mon-Fri"
echo "  PMDB  5:15 PM ET  Mon-Fri"
echo "  TOTT  4:30 PM ET  Sunday"
echo ""
echo "Logs: $LOGS_DIR/dispatch-*.log"
echo ""
echo "Test any dispatcher now:"
echo "  bash $SCRIPTS_DIR/dispatch-mdb.sh"
echo ""
echo "To uninstall:"
echo "  for p in ${PLISTS[*]}; do launchctl unload ~/Library/LaunchAgents/\$p.plist && rm ~/Library/LaunchAgents/\$p.plist; done"
