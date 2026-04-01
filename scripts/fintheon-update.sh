#!/bin/bash
# Fintheon Update — pulls latest, rebuilds everything, restarts backend, reinstalls app
# Usage: fintheon update  OR  bash ~/Documents/Codebases/fintheon/scripts/fintheon-update.sh
set -e

FINTHEON_ROOT="${FINTHEON_ROOT:-$HOME/Documents/Codebases/fintheon}"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║       FINTHEON UPDATE UTILITY        ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

if [ ! -d "$FINTHEON_ROOT/.git" ]; then
  echo "  ✗ Fintheon not found at $FINTHEON_ROOT"
  echo "    Run the setup script first, or set FINTHEON_ROOT."
  exit 1
fi

cd "$FINTHEON_ROOT"
CURRENT_BRANCH=$(git branch --show-current)
echo "  Branch: $CURRENT_BRANCH"
echo ""

# ── Step 1: Close Fintheon + kill backend ────────────────────────────────

echo "  [1/8] Stopping Fintheon..."
pkill -f "Fintheon" 2>/dev/null || true
pkill -f "electron.*fintheon" 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1
echo "  ✓ Stopped"

# ── Step 2: Pull latest ─────────────────────────────────────────────────

echo "  [2/8] Pulling latest code..."
git stash --quiet 2>/dev/null || true
git pull origin "$CURRENT_BRANCH" --rebase
git stash pop --quiet 2>/dev/null || true
echo "  ✓ Code updated ($(git log --oneline -1 | cut -c1-7))"

# ── Step 3: Install dependencies ─────────────────────────────────────────

echo "  [3/8] Installing dependencies..."
bun install --silent 2>/dev/null || bun install
cd backend-hono && bun install --silent 2>/dev/null || bun install
cd "$FINTHEON_ROOT"
echo "  ✓ Dependencies installed"

# ── Step 4: Build backend ────────────────────────────────────────────────

echo "  [4/8] Building backend..."
cd backend-hono
bun run build 2>&1 | tail -1
cd "$FINTHEON_ROOT"
echo "  ✓ Backend compiled"

# ── Step 5: Build frontend + DMG ─────────────────────────────────────────

echo "  [5/8] Building frontend + DMG..."
npm run desktop:build 2>&1 | grep -E "✓|building.*DMG" | tail -2
echo "  ✓ DMG built"

# ── Step 6: Check for new onboarding phases ──────────────────────────────

echo "  [6/8] Checking for new setup phases..."
PHASES_FILE="$HOME/.fintheon/setup-phases-done.json"
if [ -f "$PHASES_FILE" ]; then
  EXISTING_PHASES=$(python3 -c "import json; print(max(json.load(open('$PHASES_FILE')).get('phases',[0])))" 2>/dev/null || echo "0")
else
  EXISTING_PHASES=0
fi

LATEST_PHASE=11

if [ "$EXISTING_PHASES" -lt "$LATEST_PHASE" ]; then
  echo "  New phases detected ($((EXISTING_PHASES + 1))-$LATEST_PHASE). Running setup for new phases..."
  # Phase 11: LiveKit
  if [ "$EXISTING_PHASES" -lt 11 ]; then
    ENV_FILE="$FINTHEON_ROOT/backend-hono/.env"
    if ! grep -q "^LIVEKIT_API_KEY=.\+" "$ENV_FILE" 2>/dev/null; then
      echo ""
      echo "  New: LiveKit Cloud voice calls (optional)"
      echo "  Free tier: https://cloud.livekit.io"
      read -p "  Configure LiveKit now? [Y/n/skip] " LK_CHOICE
      if [ "$LK_CHOICE" != "n" ] && [ "$LK_CHOICE" != "skip" ] && [ "$LK_CHOICE" != "s" ]; then
        read -p "  LIVEKIT_API_KEY: " LK_KEY
        read -p "  LIVEKIT_API_SECRET: " LK_SECRET
        read -p "  LIVEKIT_URL (wss://...): " LK_URL
        [ -n "$LK_KEY" ] && echo "LIVEKIT_API_KEY=$LK_KEY" >> "$ENV_FILE"
        [ -n "$LK_SECRET" ] && echo "LIVEKIT_API_SECRET=$LK_SECRET" >> "$ENV_FILE"
        [ -n "$LK_URL" ] && echo "LIVEKIT_URL=$LK_URL" >> "$ENV_FILE"
        echo "  ✓ LiveKit configured"
      else
        echo "  · Skipped — voice stays in mock mode"
      fi
    else
      echo "  ✓ LiveKit already configured"
    fi
  fi
  mkdir -p "$HOME/.fintheon"
  python3 -c "
import json
phases = list(range(1, $LATEST_PHASE + 1))
with open('$PHASES_FILE', 'w') as f:
    json.dump({'completed_at': '$(date -u +"%Y-%m-%dT%H:%M:%SZ")', 'phases': phases, 'version': '2.1.0'}, f, indent=2)
" 2>/dev/null || echo "  · Could not update phase markers"
  echo "  ✓ Phase markers updated"
else
  echo "  ✓ All phases up to date"
fi

# ── Step 7: Install app ──────────────────────────────────────────────────

echo "  [7/8] Installing Fintheon.app..."
DMG_PATH="$FINTHEON_ROOT/desktop-dist/Fintheon-1.0.0-arm64.dmg"

if [ -f "$DMG_PATH" ]; then
  # Remove old DMGs from Desktop and Downloads before copying new one
  rm -f "$HOME/Desktop/Fintheon-"*.dmg 2>/dev/null || true
  rm -f "$HOME/Downloads/Fintheon-"*.dmg 2>/dev/null || true
  echo "  ✓ Old DMG releases cleaned up"

  # Copy latest DMG to Desktop + Downloads
  cp "$DMG_PATH" "$HOME/Desktop/Fintheon-1.0.0-arm64.dmg"
  cp "$DMG_PATH" "$HOME/Downloads/Fintheon-1.0.0-arm64.dmg"
  echo "  ✓ DMG copied to ~/Desktop and ~/Downloads"

  # Eject any previously mounted Fintheon volumes (name includes version)
  for vol in /Volumes/Fintheon*; do
    hdiutil detach "$vol" -quiet 2>/dev/null || true
  done

  # Install to /Applications (remove both casings)
  rm -rf /Applications/Fintheon.app /Applications/fintheon.app 2>/dev/null || true
  hdiutil attach "$DMG_PATH" -nobrowse -quiet

  # Find the actual volume name (includes version, e.g. "Fintheon 1.0.0-arm64")
  VOLUME=$(ls -d /Volumes/Fintheon* 2>/dev/null | head -1)
  if [ -z "$VOLUME" ]; then
    echo "  ✗ DMG mounted but volume not found"
    exit 1
  fi

  cp -R "$VOLUME/Fintheon.app" /Applications/
  hdiutil detach "$VOLUME" -quiet
  xattr -cr /Applications/Fintheon.app
  echo "  ✓ App installed to /Applications"
else
  echo "  ✗ DMG not found at $DMG_PATH"
  exit 1
fi

# ── Step 8: Start backend + launch ───────────────────────────────────────

echo "  [8/8] Starting backend..."
cd "$FINTHEON_ROOT/backend-hono"
nohup node dist/index.js > /tmp/fintheon-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for ready
for i in {1..10}; do
  if curl -s localhost:8080/api/harper/status > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "  ✓ Backend live (PID: $BACKEND_PID)"

# ── Done ─────────────────────────────────────────────────────────────────

VERSION=$(git log --oneline -1)
echo ""
echo "  ══════════════════════════════════════"
echo "  ✓ Update complete!"
echo "  $VERSION"
echo ""
echo "  Backend: http://localhost:8080"
echo "  Logs:    tail -f /tmp/fintheon-backend.log"
echo "  ══════════════════════════════════════"
echo ""

echo "  Opening Fintheon..."
open /Applications/Fintheon.app 2>/dev/null || echo "  · Launch: open /Applications/Fintheon.app"

echo ""
echo "  Backend running. Press Ctrl+C to stop."
wait $BACKEND_PID
