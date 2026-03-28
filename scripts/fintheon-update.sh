#!/bin/bash
# [claude-code 2026-03-28] S7: Fintheon update script — password-protected, auto-updates app
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

# Step 5: Set up Claude CLI config if needed
echo "  [5/6] Checking Claude CLI configuration..."
if command -v claude &> /dev/null; then
  echo "  ✓ Claude CLI available"
  # Ensure scorer and dispatch scripts are executable
  chmod +x backend-hono/scripts/claude-scorer.ts 2>/dev/null || true
  chmod +x backend-hono/scripts/dispatch-brief.ts 2>/dev/null || true
else
  echo "  ⚠ Claude CLI not found — install with: npm i -g @anthropic-ai/claude-code"
fi

# Step 6: Build frontend
echo "  [6/6] Building frontend..."
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
