#!/bin/bash
# [claude-code 2026-03-28] S8-T8: Fintheon update script — password-protected, auto-updates app + Claude CLI launchd agent
# Usage: fintheon update  (or source this and run fintheon_update)

set -e

FINTHEON_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPDATE_PASSWORD="qaz!@"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║       FINTHEON UPDATE UTILITY        ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Password check
read -s -p "  Enter update password: " input_password
echo ""

if [ "$input_password" != "$UPDATE_PASSWORD" ]; then
  echo "  ✗ Invalid password. Update aborted."
  exit 1
fi

echo "  ✓ Authenticated"
echo ""

# Step 1: Close Fintheon if running
echo "  [1/6] Closing Fintheon..."
pkill -f "Fintheon" 2>/dev/null || true
pkill -f "electron.*fintheon" 2>/dev/null || true
sleep 1
echo "  ✓ Fintheon closed"

# Step 2: Pull latest from git
echo "  [2/6] Pulling latest code..."
cd "$FINTHEON_ROOT"
git pull origin "$(git branch --show-current)" --rebase
echo "  ✓ Code updated"

# Step 3: Install dependencies
echo "  [3/6] Installing dependencies..."
bun install
cd backend-hono && bun install && cd ..
echo "  ✓ Dependencies installed"

# Step 4: Apply database migrations
echo "  [4/6] Checking database migrations..."
if [ -f "backend-hono/scripts/apply-migrations.ts" ]; then
  cd backend-hono && bun run scripts/apply-migrations.ts && cd ..
  echo "  ✓ Migrations applied"
else
  echo "  · No migration runner found, skipping"
fi

# Step 5: Set up Claude CLI config + launchd agent
echo "  [5/7] Checking Claude CLI configuration..."
if command -v claude &> /dev/null; then
  echo "  ✓ Claude CLI available"
  # Ensure scorer and dispatch scripts are executable
  chmod +x backend-hono/scripts/claude-scorer.ts 2>/dev/null || true
  chmod +x backend-hono/scripts/dispatch-brief.ts 2>/dev/null || true
else
  echo "  ⚠ Claude CLI not found — install with: npm i -g @anthropic-ai/claude-code"
fi

# Step 6: Install Claude CLI launchd agent (auto-start at boot)
echo "  [6/7] Checking Claude CLI launchd agent..."
CLAUDE_PLIST="$HOME/Library/LaunchAgents/com.fintheon.claude-cli.plist"
CLAUDE_PLIST_SRC="$FINTHEON_ROOT/backend-hono/scripts/com.fintheon.claude-cli.plist"

if command -v claude &> /dev/null && [ -f "$CLAUDE_PLIST_SRC" ]; then
  if [ ! -f "$CLAUDE_PLIST" ]; then
    cp "$CLAUDE_PLIST_SRC" "$CLAUDE_PLIST"
    launchctl load "$CLAUDE_PLIST"
    echo "  ✓ Claude CLI launchd agent installed and loaded"
  else
    # Update if source is newer
    if [ "$CLAUDE_PLIST_SRC" -nt "$CLAUDE_PLIST" ]; then
      launchctl unload "$CLAUDE_PLIST" 2>/dev/null || true
      cp "$CLAUDE_PLIST_SRC" "$CLAUDE_PLIST"
      launchctl load "$CLAUDE_PLIST"
      echo "  ✓ Claude CLI launchd agent updated"
    else
      echo "  · Claude CLI launchd agent already installed"
    fi
  fi
else
  echo "  · Skipping launchd agent (Claude CLI not found or plist missing)"
fi

# Step 7: Build frontend
echo "  [7/7] Building frontend..."
npx vite build
echo "  ✓ Frontend built"

echo ""
echo "  ══════════════════════════════════════"
echo "  ✓ Update complete!"
echo "  "
echo "  Start backend:  cd backend-hono && bun run dev"
echo "  Start frontend: bun run dev"
echo "  Build DMG:      npm run desktop:build"
echo "  ══════════════════════════════════════"
echo ""
