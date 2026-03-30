#!/bin/bash
# Fintheon First-Time Setup — turnkey terminal installer
# Usage: curl -sL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh | bash
set -e

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║        FINTHEON SETUP v1.0.0         ║"
echo "  ║     Priced In Capital — Ave Trader   ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

FINTHEON_DIR="$HOME/Documents/Codebases/fintheon"
REPO_URL="https://github.com/solvys-technologies/fintheon.git"
BRANCH="v.8.28.1"

# ── Step 1: Check prerequisites ──────────────────────────────────────────

echo "  [1/8] Checking prerequisites..."

# Check git
if ! command -v git &> /dev/null; then
  echo "  ✗ git not found. Install Xcode Command Line Tools:"
  echo "    xcode-select --install"
  exit 1
fi
echo "  ✓ git $(git --version | cut -d' ' -f3)"

# Check node
if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found. Installing via Homebrew..."
  if ! command -v brew &> /dev/null; then
    echo "  ✗ Homebrew not found. Install it first:"
    echo '    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    exit 1
  fi
  brew install node
fi
echo "  ✓ node $(node --version)"

# Check bun
if ! command -v bun &> /dev/null; then
  echo "  · bun not found. Installing..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
echo "  ✓ bun $(bun --version)"

# ── Step 2: Clone or update repo ─────────────────────────────────────────

echo ""
echo "  [2/8] Setting up repository..."

if [ -d "$FINTHEON_DIR/.git" ]; then
  echo "  · Repo exists. Pulling latest..."
  cd "$FINTHEON_DIR"
  git fetch origin
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
  git pull origin "$BRANCH" --rebase
  echo "  ✓ Updated to latest"
else
  echo "  · Cloning fresh..."
  mkdir -p "$(dirname "$FINTHEON_DIR")"
  git clone "$REPO_URL" "$FINTHEON_DIR"
  cd "$FINTHEON_DIR"
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
  echo "  ✓ Cloned"
fi

# ── Step 3: Install dependencies ─────────────────────────────────────────

echo ""
echo "  [3/8] Installing dependencies..."

cd "$FINTHEON_DIR"
bun install --silent 2>/dev/null || bun install
cd backend-hono && bun install --silent 2>/dev/null || bun install
cd "$FINTHEON_DIR"
echo "  ✓ Dependencies installed"

# ── Step 4: Environment setup ────────────────────────────────────────────

echo ""
echo "  [4/8] Configuring environment..."

# Backend env
if [ ! -f "backend-hono/.env" ]; then
  if [ -f "backend-hono/.env.example" ]; then
    cp backend-hono/.env.example backend-hono/.env
    echo "  · Copied .env.example → .env"
    echo "  ⚠ You need to fill in API keys in backend-hono/.env"
    echo "    Required: DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY"
  else
    echo "  ⚠ No .env.example found. Ask TP for the .env file."
  fi
else
  echo "  ✓ backend-hono/.env exists"
fi

# Frontend env
if [ ! -f "frontend/.env" ] && [ ! -f "frontend/.env.local" ]; then
  if [ -f "frontend/.env.example" ]; then
    cp frontend/.env.example frontend/.env
    echo "  · Copied frontend .env.example → .env"
  else
    # Create minimal frontend env
    cat > frontend/.env <<'ENVEOF'
VITE_API_URL=http://localhost:8080
VITE_BYPASS_AUTH=false
ENVEOF
    echo "  ✓ Created frontend/.env"
  fi
else
  echo "  ✓ frontend env exists"
fi

# ── Step 5: Check Claude CLI ─────────────────────────────────────────────

echo ""
echo "  [5/8] Checking Claude CLI..."

if command -v claude &> /dev/null; then
  CLAUDE_VERSION=$(claude --version 2>/dev/null || echo "unknown")
  echo "  ✓ Claude CLI installed: $CLAUDE_VERSION"
else
  echo "  ⚠ Claude CLI not found."
  echo ""
  echo "    Harper-Opus (the CAO) requires Claude CLI to function."
  echo "    Install it with:"
  echo ""
  echo "      npm install -g @anthropic-ai/claude-code"
  echo ""
  echo "    Then run 'claude' once to authenticate with your Anthropic account."
  echo ""
  read -p "  Press Enter to continue without Claude CLI, or Ctrl+C to install it first... "
fi

# ── Step 6: Build backend ────────────────────────────────────────────────

echo ""
echo "  [6/8] Building backend..."

cd "$FINTHEON_DIR/backend-hono"
bun run build 2>&1 | tail -1
echo "  ✓ Backend compiled"

# ── Step 7: Build frontend ───────────────────────────────────────────────

echo ""
echo "  [7/8] Building frontend..."

cd "$FINTHEON_DIR"
npx vite build 2>&1 | grep "✓" | tail -1
echo "  ✓ Frontend compiled"

# ── Step 8: Start backend + install app ──────────────────────────────────

echo ""
echo "  [8/8] Starting backend..."

cd "$FINTHEON_DIR/backend-hono"

# Kill any existing backend on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

# Start backend in background
nohup node dist/index.js > /tmp/fintheon-backend.log 2>&1 &
BACKEND_PID=$!
echo "  ✓ Backend started (PID: $BACKEND_PID)"

# Wait for it to be ready
echo "  · Waiting for backend..."
for i in {1..10}; do
  if curl -s localhost:8080/api/harper/status > /dev/null 2>&1; then
    echo "  ✓ Backend is live"
    break
  fi
  sleep 1
done

# ── Install DMG if it exists ─────────────────────────────────────────────

echo ""
DMG_PATH="$FINTHEON_DIR/desktop-dist/Fintheon-1.0.0-arm64.dmg"

if [ -f "$DMG_PATH" ]; then
  echo "  Installing Fintheon.app..."
  rm -rf /Applications/Fintheon.app 2>/dev/null || true
  hdiutil attach "$DMG_PATH" -nobrowse -quiet
  cp -R "/Volumes/Fintheon/Fintheon.app" /Applications/
  hdiutil detach "/Volumes/Fintheon" -quiet
  xattr -cr /Applications/Fintheon.app
  echo "  ✓ Fintheon.app installed to /Applications"
else
  echo "  · No DMG found. Building..."
  cd "$FINTHEON_DIR"
  npm run desktop:build 2>&1 | tail -3
  if [ -f "$DMG_PATH" ]; then
    rm -rf /Applications/Fintheon.app 2>/dev/null || true
    hdiutil attach "$DMG_PATH" -nobrowse -quiet
    cp -R "/Volumes/Fintheon/Fintheon.app" /Applications/
    hdiutil detach "/Volumes/Fintheon" -quiet
    xattr -cr /Applications/Fintheon.app
    echo "  ✓ Fintheon.app built and installed"
  fi
fi

# ── Done ─────────────────────────────────────────────────────────────────

echo ""
echo "  ══════════════════════════════════════"
echo "  ✓ Fintheon is ready."
echo ""
echo "  Backend: http://localhost:8080 (PID: $BACKEND_PID)"
echo "  Logs:    tail -f /tmp/fintheon-backend.log"
echo ""
echo "  Opening Fintheon..."
echo "  ══════════════════════════════════════"
echo ""

# Launch
open /Applications/Fintheon.app 2>/dev/null || echo "  · Launch manually: open /Applications/Fintheon.app"

# Keep this terminal alive for the backend
echo "  Backend is running. Press Ctrl+C to stop."
echo ""
wait $BACKEND_PID
