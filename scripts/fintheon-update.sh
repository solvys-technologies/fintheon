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

echo "  [1/7] Stopping Fintheon..."
pkill -f "Fintheon" 2>/dev/null || true
pkill -f "electron.*fintheon" 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1
echo "  ✓ Stopped"

# ── Step 2: Pull latest ─────────────────────────────────────────────────

echo "  [2/7] Pulling latest code..."
git stash --quiet 2>/dev/null || true
git pull origin "$CURRENT_BRANCH" --rebase
git stash pop --quiet 2>/dev/null || true
echo "  ✓ Code updated ($(git log --oneline -1 | cut -c1-7))"

# ── Step 3: Install dependencies ─────────────────────────────────────────

echo "  [3/7] Installing dependencies..."
bun install --silent 2>/dev/null || bun install
cd backend-hono && bun install --silent 2>/dev/null || bun install
cd "$FINTHEON_ROOT"
echo "  ✓ Dependencies installed"

# ── Step 4: Build backend ────────────────────────────────────────────────

echo "  [4/7] Building backend..."
cd backend-hono
bun run build 2>&1 | tail -1
cd "$FINTHEON_ROOT"
echo "  ✓ Backend compiled"

# ── Step 5: Build frontend + DMG ─────────────────────────────────────────

echo "  [5/7] Building frontend + DMG..."
npm run desktop:build 2>&1 | grep -E "✓|building.*DMG" | tail -2
echo "  ✓ DMG built"

# ── Step 6: Install app ──────────────────────────────────────────────────

echo "  [6/7] Installing Fintheon.app..."
DMG_PATH="$FINTHEON_ROOT/desktop-dist/Fintheon-1.0.0-arm64.dmg"

if [ -f "$DMG_PATH" ]; then
  rm -rf /Applications/Fintheon.app 2>/dev/null || true
  hdiutil attach "$DMG_PATH" -nobrowse -quiet
  cp -R "/Volumes/Fintheon/Fintheon.app" /Applications/
  hdiutil detach "/Volumes/Fintheon" -quiet
  xattr -cr /Applications/Fintheon.app
  echo "  ✓ App installed to /Applications"
else
  echo "  ✗ DMG not found at $DMG_PATH"
  exit 1
fi

# ── Step 7: Start backend + launch ───────────────────────────────────────

echo "  [7/7] Starting backend..."
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
