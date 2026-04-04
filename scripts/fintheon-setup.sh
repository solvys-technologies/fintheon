#!/bin/bash
# ============================================================================
# Fintheon Setup — Fresh MacBook → Running Platform
# ============================================================================
# One-liner install:
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh)"
#
# Or after cloning:
#   ./fintheon install
#
# What this does:
#   1. Installs Xcode CLI Tools + Homebrew + Node 22 + Bun
#   2. Clones Fintheon to ~/Documents/Codebases/fintheon
#   3. Installs all dependencies
#   4. Writes a bootstrap .env (secrets loaded from cloud vault on boot)
#   5. Builds backend + frontend
#   6. Installs `fintheon` CLI command globally
#   7. Starts the backend and opens the app
#
# No API keys needed. Sign in with Google — that's it.
# ============================================================================
set -euo pipefail

# ── Constants ────────────────────────────────────────────────────────────────

FINTHEON_DIR="$HOME/Documents/Codebases/fintheon"
REPO_URL="https://github.com/solvys-technologies/fintheon.git"
BRANCH="main"
SETUP_VERSION="3.0.0"

# Public/embeddable values (NOT secrets)
SUPABASE_URL="https://nrcfnzclbjboctptxaxx.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY2ZuemNsYmpib2N0cHR4YXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDgxODksImV4cCI6MjA4OTUyNDE4OX0.JXzVk5CDL6rxU5t_rl-Ku2YnPi0PeBF-VOpcSEZTbIM"
DATABASE_URL="postgresql://postgres.nrcfnzclbjboctptxaxx:Pricedinresearch0670963957%24@aws-0-us-west-2.pooler.supabase.com:5432/postgres"

# ── Banner ───────────────────────────────────────────────────────────────────

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║          FINTHEON SETUP v${SETUP_VERSION}                      ║"
echo "  ║      Priced In Capital — Ave Trader                  ║"
echo "  ║                                                      ║"
echo "  ║  No API keys needed. Sign in with Google.            ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""

# ── Helpers ──────────────────────────────────────────────────────────────────

step_count=0
total_steps=7

step() {
  step_count=$((step_count + 1))
  echo ""
  echo "  [$step_count/$total_steps] $1"
  echo "  $(printf '─%.0s' $(seq 1 50))"
}

ok()   { echo "  ✓ $1"; }
warn() { echo "  ⚠ $1"; }
fail() { echo "  ✗ $1"; exit 1; }
info() { echo "  · $1"; }

# ── Step 1: Dev tools (Xcode + Homebrew + Node + Bun) ──────────────────────

step "Installing dev tools..."

# Xcode CLI
if xcode-select -p &>/dev/null; then
  ok "Xcode CLI Tools"
else
  info "Installing Xcode CLI Tools (system dialog will appear)..."
  xcode-select --install 2>/dev/null || true
  until xcode-select -p &>/dev/null; do sleep 5; done
  ok "Xcode CLI Tools installed"
fi

# Homebrew
if command -v brew &>/dev/null; then
  ok "Homebrew"
else
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    SHELL_PROFILE="$HOME/.zprofile"
    grep -q 'brew shellenv' "$SHELL_PROFILE" 2>/dev/null || \
      echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$SHELL_PROFILE"
  fi
  ok "Homebrew installed"
fi

# Node.js
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_MAJOR" -ge 20 ]]; then
    ok "Node.js $(node --version)"
  else
    brew install node@22 && brew link --overwrite node@22 2>/dev/null || true
    ok "Node.js $(node --version)"
  fi
else
  brew install node@22 && brew link --overwrite node@22 2>/dev/null || true
  ok "Node.js $(node --version)"
fi

# Bun
if command -v bun &>/dev/null; then
  ok "Bun $(bun --version)"
else
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  SHELL_PROFILE="$HOME/.zprofile"
  grep -q '.bun/bin' "$SHELL_PROFILE" 2>/dev/null || {
    echo 'export BUN_INSTALL="$HOME/.bun"' >> "$SHELL_PROFILE"
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$SHELL_PROFILE"
  }
  ok "Bun $(bun --version)"
fi

# ── Step 2: Clone repo ─────────────────────────────────────────────────────

step "Getting Fintheon source..."

if [[ -d "$FINTHEON_DIR/.git" ]]; then
  info "Repo exists — pulling latest..."
  cd "$FINTHEON_DIR"
  git fetch origin --prune 2>/dev/null || true
  git checkout "$BRANCH" 2>/dev/null || true
  git pull origin "$BRANCH" --rebase 2>/dev/null || true
  ok "Updated ($(git log --oneline -1 | cut -c1-7))"
else
  info "Cloning to $FINTHEON_DIR..."
  mkdir -p "$HOME/Documents/Codebases"
  git clone "$REPO_URL" "$FINTHEON_DIR"
  cd "$FINTHEON_DIR"
  ok "Cloned ($(git log --oneline -1 | cut -c1-7))"
fi

cd "$FINTHEON_DIR"

# ── Step 3: Install dependencies ───────────────────────────────────────────

step "Installing dependencies..."

bun install 2>/dev/null || bun install
ok "Root deps"

cd backend-hono && bun install 2>/dev/null || bun install
cd "$FINTHEON_DIR"
ok "Backend deps"

if [[ -d frontend && -f frontend/package.json ]]; then
  cd frontend && bun install 2>/dev/null || bun install
  cd "$FINTHEON_DIR"
  ok "Frontend deps"
fi

# ── Step 4: Bootstrap .env ─────────────────────────────────────────────────

step "Configuring environment..."

# Backend — minimal bootstrap. The secrets vault loads API keys from Supabase on boot.
BACKEND_ENV="$FINTHEON_DIR/backend-hono/.env"

if [[ -f "$BACKEND_ENV" ]]; then
  info "Existing .env found — preserving"
  # Ensure bootstrap vars are present
  grep -q "^DATABASE_URL=" "$BACKEND_ENV" || echo "DATABASE_URL=$DATABASE_URL" >> "$BACKEND_ENV"
  grep -q "^SUPABASE_URL=" "$BACKEND_ENV" || echo "SUPABASE_URL=$SUPABASE_URL" >> "$BACKEND_ENV"
  grep -q "^SUPABASE_ANON_KEY=" "$BACKEND_ENV" || echo "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> "$BACKEND_ENV"
  ok "Existing .env updated"
else
  cat > "$BACKEND_ENV" << 'ENVEOF'
# Fintheon Backend — Bootstrap Environment
# API keys and secrets are loaded automatically from the cloud vault on boot.
# You do NOT need to add any API keys here.
ENVEOF
  cat >> "$BACKEND_ENV" << ENVEOF
PORT=8080
DATABASE_URL=$DATABASE_URL
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
ENABLE_CENTRAL_SCORING=true
DISPATCH_SCHEDULER_ENABLED=true
ENVEOF
  ok "Bootstrap .env created (secrets loaded from vault)"
fi

# Frontend .env
FRONTEND_ENV="$FINTHEON_DIR/frontend/.env.local"
if [[ ! -f "$FRONTEND_ENV" ]]; then
  cat > "$FRONTEND_ENV" << FENVEOF
VITE_API_URL=http://localhost:8080
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
VITE_BYPASS_AUTH=false
FENVEOF
  ok "Frontend .env.local created"
else
  ok "Frontend .env.local exists"
fi

# ── Step 5: Build ──────────────────────────────────────────────────────────

step "Building..."

cd "$FINTHEON_DIR/backend-hono"
if bun run build 2>&1 | tail -3; then
  ok "Backend compiled"
else
  warn "Backend build had issues — check logs"
fi
cd "$FINTHEON_DIR"

if npx vite build 2>&1 | tail -3; then
  ok "Frontend built"
else
  warn "Frontend build had issues"
fi

# ── Step 6: Install CLI ───────────────────────────────────────────────────

step "Installing fintheon CLI..."

# Symlink the repo's fintheon script to /usr/local/bin
CLI_SOURCE="$FINTHEON_DIR/fintheon"
if [[ -f "$CLI_SOURCE" ]]; then
  sudo mkdir -p /usr/local/bin 2>/dev/null || true
  sudo ln -sf "$CLI_SOURCE" /usr/local/bin/fintheon
  sudo chmod +x /usr/local/bin/fintheon
  ok "'fintheon' command available globally"
else
  warn "CLI entry point not found at repo root"
fi

# ── Step 7: Start ─────────────────────────────────────────────────────────

step "Starting Fintheon..."

cd "$FINTHEON_DIR/backend-hono"

# Kill existing backend
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

# Start with bun (direct, no node dist/)
nohup bun run src/index.ts > /tmp/fintheon-backend.log 2>&1 &
BACKEND_PID=$!

info "Waiting for backend..."
for i in {1..15}; do
  if curl -s localhost:8080/health > /dev/null 2>&1; then
    ok "Backend live (PID: $BACKEND_PID)"
    break
  fi
  sleep 2
  if [[ $i -eq 15 ]]; then
    warn "Backend slow to start — check: tail -f /tmp/fintheon-backend.log"
  fi
done

# Launch app if installed
if [[ -d /Applications/Fintheon.app ]]; then
  open /Applications/Fintheon.app 2>/dev/null || true
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║  FINTHEON IS READY                                   ║"
echo "  ╠══════════════════════════════════════════════════════╣"
echo "  ║                                                      ║"
echo "  ║  Backend:  http://localhost:8080                     ║"
echo "  ║  Logs:     tail -f /tmp/fintheon-backend.log         ║"
echo "  ║  CLI:      fintheon start | stop | update | logs     ║"
echo "  ║                                                      ║"
echo "  ║  Open the app and sign in with Google.               ║"
echo "  ║  No API keys needed — secrets load from the cloud.   ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""
