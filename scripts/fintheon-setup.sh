#!/bin/bash
# ============================================================================
# Fintheon First-Time Setup — Zero-to-Running on a Brand-New MacBook
# ============================================================================
# Usage (one-liner from a fresh Terminal):
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh)"
#
# What this does:
#   1. Installs Xcode Command Line Tools (gives you git)
#   2. Installs Homebrew (macOS package manager)
#   3. Installs Node.js 22 LTS + Bun (runtime + package manager)
#   4. Clones the Fintheon repository
#   5. Installs all dependencies
#   6. Writes a production-ready .env with embedded defaults
#   7. Installs Hermes agent (local AI backend)
#   8. Builds the backend + frontend + DMG
#   9. Installs the `fintheon` CLI command globally
#  10. Starts the backend and launches Fintheon
#
# Requirements: macOS (Apple Silicon or Intel), internet connection.
# No prior coding experience needed.
# ============================================================================
set -euo pipefail

# ── Constants ────────────────────────────────────────────────────────────────

FINTHEON_DIR="$HOME/Documents/Codebases/fintheon"
REPO_URL="https://github.com/solvys-technologies/fintheon.git"
BRANCH="main"
SETUP_VERSION="2.0.0"

# Production-safe publishable keys (NOT secrets — safe to embed)
SUPABASE_URL="https://nrcfnzclbjboctptxaxx.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_rNxiWGth_yubKdGDhYuv3Q_k1-Pvx1R"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY2ZuemNsYmpib2N0cHR4YXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDgxODksImV4cCI6MjA4OTUyNDE4OX0.JXzVk5CDL6rxU5t_rl-Ku2YnPi0PeBF-VOpcSEZTbIM"
API_URL="https://fintheon.fly.dev"

# ── Banner ───────────────────────────────────────────────────────────────────

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║          FINTHEON SETUP v${SETUP_VERSION}                      ║"
echo "  ║      Priced In Capital — Ave Trader                  ║"
echo "  ║                                                      ║"
echo "  ║  Fresh MacBook → Running Trading Platform            ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""

# ── Helper functions ─────────────────────────────────────────────────────────

step_count=0
total_steps=10

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

# ── Step 1: Xcode Command Line Tools (provides git, clang, make) ────────────

step "Installing Xcode Command Line Tools (includes git)..."

if xcode-select -p &>/dev/null; then
  ok "Xcode CLI Tools already installed"
else
  info "This installs git and other developer tools Apple requires."
  info "A system dialog will appear — click 'Install' and wait."
  echo ""
  xcode-select --install 2>/dev/null || true

  # Wait for the installation to complete
  info "Waiting for Xcode CLI Tools installation to finish..."
  until xcode-select -p &>/dev/null; do
    sleep 5
  done
  ok "Xcode CLI Tools installed"
fi

# Verify git is now available
if command -v git &>/dev/null; then
  ok "git $(git --version | cut -d' ' -f3)"
else
  fail "git not found after Xcode install. Restart Terminal and try again."
fi

# ── Step 2: Homebrew ─────────────────────────────────────────────────────────

step "Installing Homebrew (macOS package manager)..."

if command -v brew &>/dev/null; then
  ok "Homebrew already installed ($(brew --version | head -1))"
else
  info "Homebrew is the standard macOS package manager."
  info "It may ask for your Mac password — that's normal."
  echo ""
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Add Homebrew to PATH for Apple Silicon Macs
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    # Persist to shell profile
    SHELL_PROFILE="$HOME/.zprofile"
    if ! grep -q 'brew shellenv' "$SHELL_PROFILE" 2>/dev/null; then
      echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$SHELL_PROFILE"
      info "Added Homebrew to $SHELL_PROFILE"
    fi
  fi

  if command -v brew &>/dev/null; then
    ok "Homebrew installed"
  else
    fail "Homebrew installation failed. Visit https://brew.sh for manual install."
  fi
fi

# ── Step 3: Node.js + Bun ───────────────────────────────────────────────────

step "Installing Node.js and Bun..."

# Node.js
if command -v node &>/dev/null; then
  NODE_VER=$(node --version)
  NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_MAJOR" -ge 20 ]]; then
    ok "Node.js $NODE_VER"
  else
    warn "Node.js $NODE_VER is old — upgrading to 22 LTS..."
    brew install node@22
    brew link --overwrite node@22 2>/dev/null || true
    ok "Node.js $(node --version)"
  fi
else
  info "Installing Node.js 22 LTS via Homebrew..."
  brew install node@22
  brew link --overwrite node@22 2>/dev/null || true
  ok "Node.js $(node --version)"
fi

# Bun
if command -v bun &>/dev/null; then
  ok "Bun $(bun --version)"
else
  info "Installing Bun (fast JavaScript runtime)..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"

  # Persist to shell profile
  SHELL_PROFILE="$HOME/.zprofile"
  if ! grep -q '.bun/bin' "$SHELL_PROFILE" 2>/dev/null; then
    echo 'export BUN_INSTALL="$HOME/.bun"' >> "$SHELL_PROFILE"
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$SHELL_PROFILE"
    info "Added Bun to $SHELL_PROFILE"
  fi

  ok "Bun $(bun --version)"
fi

# ── Step 4: Clone repository ────────────────────────────────────────────────

step "Cloning Fintheon repository..."

if [[ -d "$FINTHEON_DIR/.git" ]]; then
  info "Repository exists at $FINTHEON_DIR — pulling latest..."
  cd "$FINTHEON_DIR"
  git fetch origin --prune --prune-tags 2>/dev/null || true
  git checkout "$BRANCH" 2>/dev/null || true
  git pull origin "$BRANCH" --rebase 2>/dev/null || true
  ok "Updated to latest ($(git log --oneline -1 | cut -c1-7))"
else
  info "Cloning into $FINTHEON_DIR..."
  mkdir -p "$(dirname "$FINTHEON_DIR")"
  git clone "$REPO_URL" "$FINTHEON_DIR"
  cd "$FINTHEON_DIR"
  git checkout "$BRANCH" 2>/dev/null || true
  ok "Cloned ($(git log --oneline -1 | cut -c1-7))"
fi

cd "$FINTHEON_DIR"

# ── Step 5: Install dependencies ────────────────────────────────────────────

step "Installing dependencies..."

bun install 2>/dev/null || bun install
ok "Root dependencies installed"

cd backend-hono && bun install 2>/dev/null || bun install
cd "$FINTHEON_DIR"
ok "Backend dependencies installed"

if [[ -d frontend && -f frontend/package.json ]]; then
  cd frontend && bun install 2>/dev/null || bun install
  cd "$FINTHEON_DIR"
  ok "Frontend dependencies installed"
fi

# ── Step 6: Environment configuration ───────────────────────────────────────

step "Configuring environment (production defaults)..."

# Backend .env — write production-safe defaults
# Users only need to add OPENROUTER_API_KEY for AI features
BACKEND_ENV="$FINTHEON_DIR/backend-hono/.env"

if [[ -f "$BACKEND_ENV" ]]; then
  info "Existing .env found — preserving your settings"
  # Ensure critical defaults are present
  grep -q "^BYPASS_AUTH=" "$BACKEND_ENV" || echo "BYPASS_AUTH=true" >> "$BACKEND_ENV"
  grep -q "^PORT=" "$BACKEND_ENV" || echo "PORT=8080" >> "$BACKEND_ENV"
  grep -q "^SUPABASE_URL=" "$BACKEND_ENV" || echo "SUPABASE_URL=$SUPABASE_URL" >> "$BACKEND_ENV"
  grep -q "^SUPABASE_ANON_KEY=" "$BACKEND_ENV" || echo "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> "$BACKEND_ENV"
  ok "Existing .env updated with missing defaults"
else
  cat > "$BACKEND_ENV" << ENVEOF
# ============================================================================
# Fintheon Backend — Auto-generated by setup v${SETUP_VERSION}
# ============================================================================
# The app runs out of the box with these defaults.
# Add your OPENROUTER_API_KEY below for AI features.
# ============================================================================

# --- Core ---
PORT=8080
NODE_ENV=development
BYPASS_AUTH=true

# --- Supabase (production — publishable keys, safe for local use) ---
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# --- AI / Inference ---
# Get your key at: https://openrouter.ai/settings/keys
# This is the ONLY key you need for AI features.
OPENROUTER_API_KEY=
OPENROUTER_APP_URL=https://fintheon.vercel.app
OPENROUTER_APP_NAME=Fintheon-AI-Gateway
AI_PRIMARY_PROVIDER=openrouter

# --- Optional: Voice (Whisper + TTS) ---
# OPENAI_API_KEY=

# --- Optional: Research APIs ---
# EXA_API_KEY=
# FRED_API_KEY=
# FIRECRAWL_API_KEY=

# --- Scheduling ---
HERMES_BOARDROOM_CRON=0,30 7-9 * * 1-5
HERMES_BOARDROOM_TZ=America/New_York
BOARDROOM_MEETING_WINDOW_MINUTES=90
BOARDROOM_MEETING_HOUR_LOCAL=10
HERMES_PREMARKET_CRON=0 8 * * 1-5
HERMES_POSTMARKET_CRON=30 16 * * 1-5
DISPATCH_SCHEDULER_ENABLED=true

# --- Execution Bridge ---
BRIDGE_URL=http://localhost:8001
ENVEOF
  ok "backend-hono/.env created with production defaults"
fi

# Frontend env — write production defaults
FRONTEND_ENV="$FINTHEON_DIR/frontend/.env.local"
if [[ ! -f "$FRONTEND_ENV" ]]; then
  mkdir -p "$FINTHEON_DIR/frontend"
  cat > "$FRONTEND_ENV" << FENVEOF
VITE_API_URL=http://localhost:8080
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
VITE_BYPASS_AUTH=false
FENVEOF
  ok "frontend/.env.local created"
else
  ok "frontend/.env.local already exists"
fi

# .env.production (root level — used by Vite production builds)
ROOT_ENV_PROD="$FINTHEON_DIR/.env.production"
cat > "$ROOT_ENV_PROD" << RPEOF
# Fintheon Production Environment
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
VITE_BYPASS_AUTH=false
VITE_API_URL=$API_URL
RPEOF
ok "Root .env.production updated"

# ── Step 7: Install Hermes agent ─────────────────────────────────────────────

step "Installing Hermes agent (local AI backend)..."

if command -v hermes &>/dev/null; then
  ok "Hermes already installed ($(hermes --version 2>/dev/null || echo 'installed'))"
else
  info "Hermes is the AI agent layer that powers Fintheon's analysts."

  # Try Homebrew tap first
  if command -v brew &>/dev/null; then
    info "Installing Hermes via Homebrew..."
    brew tap solvys-technologies/hermes 2>/dev/null || true
    if brew install hermes 2>/dev/null; then
      ok "Hermes installed via Homebrew"
    else
      warn "Homebrew install failed — trying npm..."
      npm install -g @solvys/hermes 2>/dev/null || true
      if command -v hermes &>/dev/null; then
        ok "Hermes installed via npm"
      else
        warn "Hermes not available yet — AI features will use cloud fallback"
        info "Install later with: brew tap solvys-technologies/hermes && brew install hermes"
      fi
    fi
  else
    npm install -g @solvys/hermes 2>/dev/null || true
    if command -v hermes &>/dev/null; then
      ok "Hermes installed via npm"
    else
      warn "Hermes not available — AI features will use cloud fallback"
    fi
  fi
fi

# Initialize Hermes config directory
HERMES_DIR="$HOME/.hermes"
if [[ ! -d "$HERMES_DIR" ]]; then
  mkdir -p "$HERMES_DIR/agents/main/sessions"
  mkdir -p "$HERMES_DIR/config"

  # Write default Hermes config
  cat > "$HERMES_DIR/config/default.json" << HERMESEOF
{
  "provider": "openrouter",
  "base_url": "https://openrouter.ai/api/v1",
  "model": "anthropic/claude-sonnet-4-20250514",
  "app_name": "Fintheon-PIC-Hermes",
  "fintheon_root": "$FINTHEON_DIR",
  "backend_url": "http://localhost:8080",
  "agents": {
    "harper": { "role": "CAO", "model": "anthropic/claude-opus-4-20250514" },
    "oracle": { "role": "All-Seer", "model": "anthropic/claude-opus-4-20250514" },
    "feucht": { "role": "Futures & Risk", "model": "anthropic/claude-sonnet-4-20250514" },
    "consul": { "role": "Fundamentals", "model": "anthropic/claude-sonnet-4-20250514" },
    "herald": { "role": "News", "model": "anthropic/claude-sonnet-4-20250514" }
  }
}
HERMESEOF
  ok "Hermes config initialized at ~/.hermes"
else
  ok "Hermes config already exists at ~/.hermes"
fi

# ── Step 8: Build everything ────────────────────────────────────────────────

step "Building backend + frontend..."

cd "$FINTHEON_DIR"

# Build backend
info "Compiling backend (TypeScript → JavaScript)..."
cd backend-hono
if bun run build 2>&1 | tail -3; then
  ok "Backend compiled"
else
  warn "Backend build had issues — the app may still work"
fi
cd "$FINTHEON_DIR"

# Build frontend
info "Building frontend..."
if npx vite build 2>&1 | tail -3; then
  ok "Frontend built"
else
  warn "Frontend build had issues"
fi

# ── Step 9: Install Fintheon CLI + DMG ──────────────────────────────────────

step "Installing Fintheon CLI and desktop app..."

# Install the `fintheon` CLI command globally
INSTALL_SCRIPT="$FINTHEON_DIR/scripts/install-cli.sh"
if [[ -f "$INSTALL_SCRIPT" ]]; then
  bash "$INSTALL_SCRIPT"
  ok "'fintheon' command installed — type 'fintheon update' anytime"
else
  warn "CLI install script not found — installing manually..."
  # Inline CLI installation
  sudo mkdir -p /usr/local/bin 2>/dev/null || true
  cat > /tmp/fintheon-cli << CLIPEOF
#!/bin/bash
# Fintheon CLI — installed by setup v${SETUP_VERSION}
FINTHEON_ROOT="$FINTHEON_DIR"

case "\$1" in
  update)
    bash "\$FINTHEON_ROOT/scripts/fintheon-update.sh"
    ;;
  setup)
    bash "\$FINTHEON_ROOT/scripts/fintheon-setup.sh"
    ;;
  start)
    echo "Starting Fintheon..."
    cd "\$FINTHEON_ROOT/backend-hono"
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 1
    nohup node dist/index.js > /tmp/fintheon-backend.log 2>&1 &
    echo "Backend PID: \$!"
    sleep 3
    open /Applications/Fintheon.app 2>/dev/null || echo "Launch: open /Applications/Fintheon.app"
    echo "Logs: tail -f /tmp/fintheon-backend.log"
    ;;
  stop)
    echo "Stopping Fintheon..."
    pkill -f "Fintheon" 2>/dev/null || true
    pkill -f "electron.*fintheon" 2>/dev/null || true
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    echo "Stopped."
    ;;
  logs)
    tail -f /tmp/fintheon-backend.log
    ;;
  version)
    cd "\$FINTHEON_ROOT" && git describe --tags --always 2>/dev/null || echo "unknown"
    ;;
  *)
    echo ""
    echo "  Fintheon CLI"
    echo "  ────────────────────────────────"
    echo "  fintheon update    Pull latest, rebuild, restart"
    echo "  fintheon start     Start backend + launch app"
    echo "  fintheon stop      Stop everything"
    echo "  fintheon logs      Tail backend logs"
    echo "  fintheon setup     Re-run first-time setup"
    echo "  fintheon version   Show current version"
    echo ""
    ;;
esac
CLIPEOF
  sudo cp /tmp/fintheon-cli /usr/local/bin/fintheon
  sudo chmod +x /usr/local/bin/fintheon
  rm /tmp/fintheon-cli
  ok "'fintheon' command installed"
fi

# Build and install DMG
info "Building desktop app (DMG)..."
cd "$FINTHEON_DIR"
if npm run desktop:build 2>&1 | tail -5; then
  DMG_PATH="$FINTHEON_DIR/desktop-dist/Fintheon-1.0.0-arm64.dmg"
  if [[ -f "$DMG_PATH" ]]; then
    # Copy to Downloads
    cp "$DMG_PATH" "$HOME/Downloads/Fintheon-1.0.0-arm64.dmg" 2>/dev/null || true

    # Install to /Applications
    rm -rf /Applications/Fintheon.app /Applications/fintheon.app 2>/dev/null || true

    for vol in /Volumes/Fintheon*; do
      hdiutil detach "$vol" -quiet 2>/dev/null || true
    done

    hdiutil attach "$DMG_PATH" -nobrowse -quiet 2>/dev/null || true
    VOLUME=$(ls -d /Volumes/Fintheon* 2>/dev/null | head -1)
    if [[ -n "$VOLUME" ]]; then
      cp -R "$VOLUME/Fintheon.app" /Applications/
      hdiutil detach "$VOLUME" -quiet 2>/dev/null || true
      xattr -cr /Applications/Fintheon.app 2>/dev/null || true
      ok "Fintheon.app installed to /Applications"
    fi
  else
    warn "DMG not found after build — run 'fintheon start' to use dev mode"
  fi
else
  warn "DMG build skipped — run 'npm run desktop:build' manually later"
fi

# ── Step 10: Start backend and launch ────────────────────────────────────────

step "Starting Fintheon..."

cd "$FINTHEON_DIR/backend-hono"

# Kill any existing backend on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

# Start backend in background
nohup node dist/index.js > /tmp/fintheon-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for it to be ready
info "Waiting for backend..."
for i in {1..15}; do
  if curl -s localhost:8080/health > /dev/null 2>&1; then
    ok "Backend is live (PID: $BACKEND_PID)"
    break
  fi
  sleep 2
  if [[ $i -eq 15 ]]; then
    warn "Backend didn't respond yet — check: tail -f /tmp/fintheon-backend.log"
  fi
done

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║  ✓ FINTHEON IS READY                                ║"
echo "  ╠══════════════════════════════════════════════════════╣"
echo "  ║                                                      ║"
echo "  ║  Backend:  http://localhost:8080                     ║"
echo "  ║  Logs:     tail -f /tmp/fintheon-backend.log         ║"
echo "  ║  CLI:      fintheon update | start | stop | logs     ║"
echo "  ║                                                      ║"
echo "  ║  Next step: Add your OpenRouter API key for AI:      ║"
echo "  ║    1. Get key at https://openrouter.ai/settings/keys ║"
echo "  ║    2. Edit: $FINTHEON_DIR/backend-hono/.env"
echo "  ║    3. Set OPENROUTER_API_KEY=sk-or-...               ║"
echo "  ║    4. Restart: fintheon stop && fintheon start        ║"
echo "  ║                                                      ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""

# Launch the app
if [[ -d /Applications/Fintheon.app ]]; then
  info "Opening Fintheon..."
  open /Applications/Fintheon.app 2>/dev/null || true
fi

echo "  Backend running. Press Ctrl+C to stop."
echo ""
wait $BACKEND_PID 2>/dev/null || true
