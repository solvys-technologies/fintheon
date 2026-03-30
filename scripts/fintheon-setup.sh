#!/bin/bash
# Fintheon First-Time Setup — interactive terminal installer
# Usage: curl -sL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh | bash
# Or:    bash ~/Documents/Codebases/fintheon/scripts/fintheon-setup.sh
set -e

# ── Helpers ──────────────────────────────────────────────────────────────

GOLD='\033[38;2;199;159;74m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

banner() { echo -e "${GOLD}$1${RESET}"; }
info()   { echo -e "  ${DIM}·${RESET} $1"; }
ok()     { echo -e "  ${GOLD}✓${RESET} $1"; }
warn()   { echo -e "  ${GOLD}⚠${RESET} $1"; }
fail()   { echo -e "  ✗ $1"; }
ask()    { echo -e ""; echo -e "  ${BOLD}$1${RESET}"; }

# Prompt for a value, write to .env if provided
ask_key() {
  local LABEL="$1" ENV_KEY="$2" SIGNUP_URL="$3" ENV_FILE="$4" REQUIRED="$5"

  echo ""
  if [ -n "$SIGNUP_URL" ]; then
    echo -e "  ${BOLD}${LABEL}${RESET}"
    echo -e "  ${DIM}Sign up / get key: ${SIGNUP_URL}${RESET}"
  else
    echo -e "  ${BOLD}${LABEL}${RESET}"
  fi

  # Check if already set
  if grep -q "^${ENV_KEY}=.\+" "$ENV_FILE" 2>/dev/null; then
    ok "Already configured"
    return 0
  fi

  if [ -n "$SIGNUP_URL" ]; then
    read -p "  Open signup page in browser? [Y/n/skip] " OPEN_CHOICE
    if [ "$OPEN_CHOICE" != "n" ] && [ "$OPEN_CHOICE" != "skip" ] && [ "$OPEN_CHOICE" != "s" ]; then
      open "$SIGNUP_URL" 2>/dev/null || xdg-open "$SIGNUP_URL" 2>/dev/null || true
      echo "  ${DIM}Browser opened. Copy your API key and paste below.${RESET}"
    fi
    if [ "$OPEN_CHOICE" = "skip" ] || [ "$OPEN_CHOICE" = "s" ]; then
      if [ "$REQUIRED" = "required" ]; then
        warn "Skipped — this is required for core features"
      else
        info "Skipped"
      fi
      return 0
    fi
  fi

  read -p "  Paste ${ENV_KEY}: " KEY_VALUE
  if [ -n "$KEY_VALUE" ]; then
    # Update or append to .env
    if grep -q "^${ENV_KEY}=" "$ENV_FILE" 2>/dev/null; then
      sed -i '' "s|^${ENV_KEY}=.*|${ENV_KEY}=${KEY_VALUE}|" "$ENV_FILE"
    else
      echo "${ENV_KEY}=${KEY_VALUE}" >> "$ENV_FILE"
    fi
    ok "Saved to .env"
  else
    if [ "$REQUIRED" = "required" ]; then
      warn "Empty — core features may not work"
    else
      info "Skipped"
    fi
  fi
}

# ── Start ────────────────────────────────────────────────────────────────

echo ""
banner "  ╔══════════════════════════════════════╗"
banner "  ║        FINTHEON SETUP v2.0.0         ║"
banner "  ║     Priced In Capital — Ave Trader   ║"
banner "  ╚══════════════════════════════════════╝"
echo ""

FINTHEON_DIR="$HOME/Documents/Codebases/fintheon"
REPO_URL="https://github.com/solvys-technologies/fintheon.git"
BRANCH="v.8.28.1"

# ── Phase 1: System Prerequisites ────────────────────────────────────────

ask "Phase 1: System Prerequisites"

# Git
if ! command -v git &> /dev/null; then
  fail "git not found"
  echo "    xcode-select --install"
  exit 1
fi
ok "git $(git --version | cut -d' ' -f3)"

# Homebrew
if ! command -v brew &> /dev/null; then
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
fi
ok "brew"

# Node
if ! command -v node &> /dev/null; then
  info "Installing Node.js..."
  brew install node
fi
ok "node $(node --version)"

# Bun
if ! command -v bun &> /dev/null; then
  info "Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
ok "bun $(bun --version)"

# Python
if ! command -v python3 &> /dev/null; then
  info "Installing Python..."
  brew install python
fi
ok "python $(python3 --version | cut -d' ' -f2)"

# uv (Python package manager)
if ! command -v uv &> /dev/null; then
  info "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
ok "uv"

# ── Phase 2: Clone Repository ────────────────────────────────────────────

ask "Phase 2: Repository"

if [ -d "$FINTHEON_DIR/.git" ]; then
  cd "$FINTHEON_DIR"
  git fetch origin --quiet
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
  git pull origin "$BRANCH" --rebase --quiet
  ok "Updated to latest ($(git log --oneline -1 | cut -c1-7))"
else
  info "Cloning..."
  mkdir -p "$(dirname "$FINTHEON_DIR")"
  git clone --quiet "$REPO_URL" "$FINTHEON_DIR"
  cd "$FINTHEON_DIR"
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
  ok "Cloned"
fi

# ── Phase 3: Dependencies ────────────────────────────────────────────────

ask "Phase 3: Dependencies"

cd "$FINTHEON_DIR"
bun install --silent 2>/dev/null || bun install
cd backend-hono && bun install --silent 2>/dev/null || bun install
cd "$FINTHEON_DIR"
ok "All packages installed"

# ── Phase 4: Claude CLI ─────────────────────────────────────────────────

ask "Phase 4: Claude CLI (AI Chat + Briefs)"
echo -e "  ${DIM}Claude CLI powers all AI chat and daily briefing generation.${RESET}"
echo -e "  ${DIM}Free with Anthropic Max subscription ($20/mo).${RESET}"

if command -v claude &> /dev/null; then
  ok "Claude CLI installed: $(claude --version 2>/dev/null || echo 'installed')"
else
  echo ""
  read -p "  Install Claude CLI now? [Y/n] " INSTALL_CLAUDE
  if [ "$INSTALL_CLAUDE" != "n" ]; then
    info "Installing @anthropic-ai/claude-code..."
    npm install -g @anthropic-ai/claude-code 2>/dev/null && ok "Installed" || {
      warn "npm install failed — try manually: npm install -g @anthropic-ai/claude-code"
    }
  else
    warn "Skipped — AI chat will fall back to OpenRouter (paid)"
  fi
fi

# Authenticate Claude CLI
if command -v claude &> /dev/null; then
  if claude --print "ping" --output-format text > /dev/null 2>&1; then
    ok "Claude CLI authenticated"
  else
    echo ""
    echo -e "  ${BOLD}Claude CLI needs authentication${RESET}"
    echo -e "  ${DIM}This opens claude.ai — sign in with your Anthropic account.${RESET}"
    echo ""
    read -p "  Authenticate now? [Y/n] " AUTH_CLAUDE
    if [ "$AUTH_CLAUDE" != "n" ]; then
      claude auth login 2>&1 || warn "Auth failed — retry later: claude auth login"
    fi
  fi
fi

# ── Phase 5: Twitter CLI ────────────────────────────────────────────────

ask "Phase 5: Twitter CLI (Live News Feed)"
echo -e "  ${DIM}Scrapes financial news from X/Twitter for the RiskFlow feed.${RESET}"
echo -e "  ${DIM}No API key needed — uses browser cookie auth.${RESET}"

TWITTER_BIN="$HOME/.local/bin/twitter"

if [ -x "$TWITTER_BIN" ] || command -v twitter &> /dev/null; then
  ok "Twitter CLI installed"
else
  echo ""
  read -p "  Install Twitter CLI now? [Y/n] " INSTALL_TWITTER
  if [ "$INSTALL_TWITTER" != "n" ]; then
    info "Installing via uv..."
    uv tool install twitter-cli 2>/dev/null && ok "Installed" || {
      warn "Install failed — try: uv tool install twitter-cli"
    }
  else
    info "Skipped — RiskFlow will use economic calendar data only"
  fi
fi

# Twitter auth
TWITTER_CMD=""
[ -x "$TWITTER_BIN" ] && TWITTER_CMD="$TWITTER_BIN"
command -v twitter &> /dev/null && TWITTER_CMD="twitter"

if [ -n "$TWITTER_CMD" ]; then
  if $TWITTER_CMD user get --username elonmusk --limit 1 > /dev/null 2>&1; then
    ok "Twitter CLI authenticated"
  else
    echo ""
    echo -e "  ┌──────────────────────────────────────────────────────┐"
    echo -e "  │  ${BOLD}Twitter/X Browser Login${RESET}                              │"
    echo -e "  │                                                      │"
    echo -e "  │  Opens X.com in your browser. Log in normally.       │"
    echo -e "  │  The CLI stores your session cookie for scraping.    │"
    echo -e "  │  No API keys or developer account needed.            │"
    echo -e "  └──────────────────────────────────────────────────────┘"
    echo ""
    read -p "  Open browser login now? [Y/n/skip] " TW_AUTH
    if [ "$TW_AUTH" != "n" ] && [ "$TW_AUTH" != "skip" ] && [ "$TW_AUTH" != "s" ]; then
      $TWITTER_CMD auth login 2>&1 || warn "Auth failed — retry: $TWITTER_CMD auth login"
    else
      info "Skipped — run later: $TWITTER_CMD auth login"
    fi
  fi
fi

# ── Phase 6: API Keys ───────────────────────────────────────────────────

ask "Phase 6: API Keys"
echo -e "  ${DIM}Configure services that power Fintheon's features.${RESET}"
echo -e "  ${DIM}Press Enter to skip any key — you can add them later in backend-hono/.env${RESET}"

ENV_FILE="$FINTHEON_DIR/backend-hono/.env"

# Create .env from example if missing
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$FINTHEON_DIR/backend-hono/.env.example" ]; then
    cp "$FINTHEON_DIR/backend-hono/.env.example" "$ENV_FILE"
    info "Created .env from template"
  fi
fi

# Required
ask_key "OpenRouter — AI inference for headline scoring" \
  "OPENROUTER_API_KEY" \
  "https://openrouter.ai/settings/keys" \
  "$ENV_FILE" \
  "required"

# Recommended
ask_key "Supabase URL — cloud data persistence" \
  "SUPABASE_URL" \
  "https://supabase.com/dashboard/projects" \
  "$ENV_FILE" \
  "required"

ask_key "Supabase Service Role Key" \
  "SUPABASE_SERVICE_ROLE_KEY" \
  "" \
  "$ENV_FILE" \
  "required"

# Optional — open browser for each
ask_key "Exa — deep research + web search" \
  "EXA_API_KEY" \
  "https://dashboard.exa.ai/api-keys" \
  "$ENV_FILE"

ask_key "FRED — macro economic indicators (free)" \
  "FRED_API_KEY" \
  "https://fred.stlouisfed.org/docs/api/api_key.html" \
  "$ENV_FILE"

ask_key "OpenAI — voice transcription (Whisper)" \
  "OPENAI_API_KEY" \
  "https://platform.openai.com/api-keys" \
  "$ENV_FILE"

ask_key "Firecrawl — web scraping for research" \
  "FIRECRAWL_API_KEY" \
  "https://firecrawl.dev/app/api-keys" \
  "$ENV_FILE"

# ── Phase 7: Build ──────────────────────────────────────────────────────

ask "Phase 7: Building Fintheon"

cd "$FINTHEON_DIR/backend-hono"
info "Compiling backend..."
bun run build 2>&1 | tail -1
ok "Backend compiled"

cd "$FINTHEON_DIR"
info "Building frontend + DMG..."
npm run desktop:build 2>&1 | grep -E "✓|building.*DMG" | tail -2
ok "DMG built"

# ── Phase 8: Install App ────────────────────────────────────────────────

ask "Phase 8: Installing"

DMG_PATH="$FINTHEON_DIR/desktop-dist/Fintheon-1.0.0-arm64.dmg"

if [ -f "$DMG_PATH" ]; then
  cp "$DMG_PATH" "$HOME/Downloads/Fintheon-1.0.0-arm64.dmg"
  ok "DMG → ~/Downloads"

  # Eject stale volumes
  for vol in /Volumes/Fintheon*; do
    [ -d "$vol" ] && hdiutil detach "$vol" -quiet 2>/dev/null || true
  done

  rm -rf /Applications/Fintheon.app /Applications/fintheon.app 2>/dev/null || true
  hdiutil attach "$DMG_PATH" -nobrowse -quiet
  VOLUME=$(ls -d "/Volumes/Fintheon"* 2>/dev/null | head -1)
  if [ -n "$VOLUME" ]; then
    cp -R "$VOLUME/Fintheon.app" /Applications/
    hdiutil detach "$VOLUME" -quiet
    xattr -cr /Applications/Fintheon.app
    ok "Fintheon.app → /Applications"
  else
    warn "DMG mounted but volume not found"
  fi
else
  fail "DMG not found at $DMG_PATH"
fi

# ── Phase 9: Start Backend ──────────────────────────────────────────────

ask "Phase 9: Starting Backend"

cd "$FINTHEON_DIR/backend-hono"
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

nohup node dist/index.js > /tmp/fintheon-backend.log 2>&1 &
BACKEND_PID=$!

info "Waiting for backend..."
for i in {1..15}; do
  if curl -s localhost:8080/api/harper/status > /dev/null 2>&1; then
    ok "Backend live (PID: $BACKEND_PID)"
    break
  fi
  sleep 1
done

# ── Summary ──────────────────────────────────────────────────────────────

echo ""
banner "  ══════════════════════════════════════"
banner "  ✓ Fintheon is ready."
echo ""
echo "  Backend:  http://localhost:8080"
echo "  Logs:     tail -f /tmp/fintheon-backend.log"
echo ""

# Service status
echo "  Services:"
command -v claude &> /dev/null \
  && ok "Claude CLI  — AI chat + daily briefs" \
  || warn "Claude CLI  — npm i -g @anthropic-ai/claude-code && claude auth login"

[ -x "$HOME/.local/bin/twitter" ] || command -v twitter &> /dev/null \
  && ok "Twitter CLI — live news feed" \
  || warn "Twitter CLI — uv tool install twitter-cli && twitter auth login"

grep -q "^OPENROUTER_API_KEY=.\+" "$ENV_FILE" 2>/dev/null \
  && ok "OpenRouter  — headline scoring" \
  || warn "OpenRouter  — add key to backend-hono/.env"

grep -q "^SUPABASE_URL=.\+" "$ENV_FILE" 2>/dev/null \
  && ok "Supabase    — cloud persistence" \
  || warn "Supabase    — add URL+key to backend-hono/.env"

echo ""
banner "  ══════════════════════════════════════"
echo ""

ok "Opening Fintheon..."
open /Applications/Fintheon.app 2>/dev/null || info "Launch: open /Applications/Fintheon.app"

echo ""
echo "  Backend running. Press Ctrl+C to stop."
echo ""
wait $BACKEND_PID
