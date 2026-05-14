#!/bin/bash
# [claude-code 2026-05-14] In-app updater installs a pre-downloaded DMG when
# Electron passes one, with gh download and local rebuild retained as fallback.
set -eo pipefail

TAG="${1:?usage: fintheon-install-update.sh <vTAG> [downloaded-dmg-path]}"
VERSION_NUM="${TAG#v}"
PRELOADED_DMG="${2:-}"
ARCH="$(uname -m)"
if [[ "$ARCH" == "arm64" ]]; then
  DMG_SUFFIX="arm64"
else
  DMG_SUFFIX="x64"
fi
DMG_NAME="Fintheon-${VERSION_NUM}-${DMG_SUFFIX}.dmg"
DMG_LOCAL="$HOME/Downloads/$DMG_NAME"
if [[ -n "$PRELOADED_DMG" ]]; then
  DMG_LOCAL="$PRELOADED_DMG"
fi
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

  # Use Electron's background download if it is already present.
  DOWNLOAD_OK=false
  if [[ -n "$PRELOADED_DMG" ]] && [[ -f "$PRELOADED_DMG" ]]; then
    DOWNLOAD_OK=true
    echo "using pre-downloaded $PRELOADED_DMG"
  elif command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    # Download via authenticated gh CLI (private repo)
    echo "downloading $DMG_NAME"
    if gh release download "$TAG" \
      --repo solvys-technologies/fintheon \
      --pattern "$DMG_NAME" \
      --output "$DMG_LOCAL" \
      --clobber 2>/dev/null; then
      DOWNLOAD_OK=true
      echo "downloaded $DMG_NAME"
    else
      echo "gh release download failed — trying release asset API"
      ASSET_API_URL=$(gh release view "$TAG" \
        --repo solvys-technologies/fintheon \
        --json assets \
        --jq ".assets[] | select(.name == \"$DMG_NAME\") | .apiUrl" 2>/dev/null || true)
      if [[ -n "$ASSET_API_URL" ]] && gh api "$ASSET_API_URL" \
        -H "Accept: application/octet-stream" > "${DMG_LOCAL}.tmp" 2>/dev/null; then
        mv "${DMG_LOCAL}.tmp" "$DMG_LOCAL"
        DOWNLOAD_OK=true
        echo "downloaded $DMG_NAME via asset API"
      else
        /bin/rm -f "${DMG_LOCAL}.tmp" 2>/dev/null || true
        echo "release asset API download failed — will rebuild locally"
      fi
    fi
  else
    echo "gh CLI not authed — will rebuild locally"
  fi

  # Fallback: rebuild DMG from source if download failed or no DMG
  if [[ "$DOWNLOAD_OK" != "true" ]] || [[ ! -f "$DMG_LOCAL" ]]; then
    /bin/rm -f "$DMG_LOCAL" 2>/dev/null || true
    FINTHEON_ROOT="$(dirname "$(dirname "$(realpath "$0")")")"
    echo "rebuilding DMG from source at $FINTHEON_ROOT"
    cd "$FINTHEON_ROOT"
    if npm run desktop:build >/tmp/fintheon-install-update-dmg.log 2>&1; then
      echo "DMG rebuilt"
      DMG_LOCAL=$(ls -t "$FINTHEON_ROOT/desktop-dist"/Fintheon-*-${DMG_SUFFIX}.dmg 2>/dev/null | head -1)
    else
      echo "DMG rebuild failed — see /tmp/fintheon-install-update-dmg.log"
      tail -20 /tmp/fintheon-install-update-dmg.log
    fi
  fi

  if [[ ! -f "$DMG_LOCAL" ]]; then
    echo "DMG not available at $DMG_LOCAL after download + rebuild attempts"
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
