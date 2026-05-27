#!/bin/bash
# [claude-code 2026-05-27] In-app updater installs only an already-downloaded,
# Electron-verified DMG. User desktops must never rebuild from source.
set -eo pipefail

TAG="${1:?usage: fintheon-install-update.sh <vTAG> <downloaded-dmg-path>}"
VERSION_NUM="${TAG#v}"
DMG_LOCAL="${2:?usage: fintheon-install-update.sh <vTAG> <downloaded-dmg-path>}"
USER_DATA="$HOME/Library/Application Support/Fintheon"
MARKER="$USER_DATA/just-updated.json"
LOG="/tmp/fintheon-install-update.log"

mkdir -p "$USER_DATA"
{
  echo "[$(date -u +%FT%TZ)] install-update start tag=$TAG"

  # Wait for the running app to exit (max 10s), then ensure it's down
  for _ in $(seq 1 20); do
    pgrep -x Fintheon >/dev/null || break
    sleep 0.5
  done
  pkill -f "Fintheon.app/Contents/MacOS/Fintheon" 2>/dev/null || true
  sleep 1

  if [[ ! -f "$DMG_LOCAL" ]]; then
    echo "pre-downloaded DMG not available at $DMG_LOCAL"
    exit 1
  fi

  # Detach any stale Fintheon volumes, then mount + copy + detach
  for vol in /Volumes/Fintheon*; do
    [[ -d "$vol" ]] && hdiutil detach "$vol" -quiet 2>/dev/null || true
  done
  /bin/rm -R -f /Applications/Fintheon.app /Applications/fintheon.app 2>/dev/null || true
  hdiutil attach "$DMG_LOCAL" -nobrowse -quiet
  VOLUME=$(ls -d /Volumes/Fintheon* 2>/dev/null | head -1)
  if [[ -z "$VOLUME" ]]; then
    echo "no mounted Fintheon volume found"
    exit 1
  fi
  cp -R "$VOLUME/Fintheon.app" /Applications/
  hdiutil detach "$VOLUME" -quiet 2>/dev/null || true
  xattr -cr /Applications/Fintheon.app 2>/dev/null || true

  # Drop marker so the next launch can fire the success toast
  printf '{"version":"%s","ts":"%s"}\n' "$VERSION_NUM" "$(date -u +%FT%TZ)" > "$MARKER"

  echo "reopening Fintheon.app"
  open /Applications/Fintheon.app
  echo "[$(date -u +%FT%TZ)] install-update done"
} >>"$LOG" 2>&1
