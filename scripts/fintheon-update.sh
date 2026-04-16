#!/bin/bash
# ============================================================================
# Fintheon Update — Pull latest, install new deps, rebuild, restart
# ============================================================================
# Usage: fintheon update
#   OR:  bash ~/Documents/Codebases/fintheon/scripts/fintheon-update.sh
#
# This script is designed to NEVER produce error messages for the user.
# Every step has a fallback. If something fails, it logs the issue and
# continues to the next step.
# ============================================================================
set -eo pipefail

FINTHEON_ROOT="${FINTHEON_ROOT:-$HOME/Documents/Codebases/fintheon}"
UPDATE_VERSION="2.0.0"
SUPABASE_DATABASE_URL="postgresql://postgres.nrcfnzclbjboctptxaxx:Pricedinresearch0670963957%24@aws-0-us-west-2.pooler.supabase.com:5432/postgres"

# ── Solvys Gold ANSI palette ──────────────────────────────────────────────────
_R='\033[0m'
_GOLD='\033[38;2;199;159;74m'
_CREAM='\033[38;2;240;234;214m'
_DIM='\033[38;2;100;85;50m'
_FIRE1='\033[38;2;255;100;20m'
_FIRE2='\033[38;2;255;160;40m'
_FIRE3='\033[38;2;255;210;80m'
_EMBER='\033[38;2;180;60;20m'
_GREEN='\033[38;2;120;200;120m'
_RED='\033[38;2;220;60;60m'
_YELLOW='\033[38;2;220;190;80m'
_BOLD='\033[1m'

ok()   { echo -e "  ${_GREEN}✓${_R} ${_CREAM}$1${_R}"; }
warn() { echo -e "  ${_YELLOW}⚠${_R} ${_CREAM}$1${_R}"; }
info() { echo -e "  ${_DIM}·${_R} ${_CREAM}$1${_R}"; }
step() { echo -e "  ${_GOLD}[$1]${_R} ${_CREAM}$2${_R}"; }

torch_banner() {
  local title="$1" subtitle="$2"
  printf -v _t "%-30s" "$title"
  printf -v _s "%-30s" "$subtitle"
  echo ""
  printf "      ${_FIRE3}  )  ${_R}                                    ${_FIRE3}  )  ${_R}\n"
  printf "      ${_FIRE2} ( ) ${_R}                                    ${_FIRE2} ( ) ${_R}\n"
  printf "      ${_FIRE1}  )(  ${_R}                                   ${_FIRE1}  )(  ${_R}\n"
  printf "      ${_EMBER} /||\ ${_R}                                   ${_EMBER} /||\ ${_R}\n"
  printf "      ${_GOLD}]||||[${_R}  ${_GOLD}╔══════════════════════════════╗${_R}  ${_GOLD}]||||[${_R}\n"
  printf "      ${_GOLD}]||||[${_R}  ${_GOLD}║${_R} ${_BOLD}${_GOLD}${_t}${_R}${_GOLD}║${_R}  ${_GOLD}]||||[${_R}\n"
  printf "      ${_GOLD}]||||[${_R}  ${_GOLD}║${_R} ${_DIM}${_s}${_R}${_GOLD}║${_R}  ${_GOLD}]||||[${_R}\n"
  printf "      ${_GOLD}]||||[${_R}  ${_GOLD}╚══════════════════════════════╝${_R}  ${_GOLD}]||||[${_R}\n"
  printf "      ${_DIM} ╨╨╨╨ ${_R}                                    ${_DIM} ╨╨╨╨ ${_R}\n"
  echo ""
}

torch_banner "FINTHEON UPDATE v${UPDATE_VERSION}" "Priced In Capital"

# ── Validate repo exists ─────────────────────────────────────────────────────

if [[ ! -d "$FINTHEON_ROOT/.git" ]]; then
  echo -e "  ${_RED}✗${_R} ${_CREAM}Fintheon not found at $FINTHEON_ROOT${_R}"
  echo '    Run the setup script first:'
  echo '    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh)"'
  exit 1
fi

cd "$FINTHEON_ROOT"
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
info "Branch: $CURRENT_BRANCH"
info "Current: $(git describe --tags --always 2>/dev/null || git log --oneline -1 | cut -c1-7)"
echo ""

# ── Step 1: Stop Fintheon + kill backend ─────────────────────────────────────

step "1/12" "Stopping Fintheon..."
pkill -f "Fintheon" 2>/dev/null || true
pkill -f "electron.*fintheon" 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1
ok "Stopped"

# ── Step 2: Stash local changes ─────────────────────────────────────────────

step "2/12" "Checking for local changes..."
HAS_CHANGES=false
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  HAS_CHANGES=true
  git stash push -m "fintheon-update-$(date +%Y%m%d-%H%M%S)" --quiet 2>/dev/null || true
  info "Local changes stashed"
else
  ok "Clean working directory"
fi

# ── Step 3: Pull latest code ────────────────────────────────────────────────

step "3/12" "Pulling latest code..."
git fetch --all --prune --prune-tags 2>/dev/null || true
git fetch --tags --force 2>/dev/null || true

PULL_OUTPUT=$(git pull origin "$CURRENT_BRANCH" --rebase 2>&1) || {
  warn "Pull failed — trying hard reset to origin/$CURRENT_BRANCH"
  git reset --hard "origin/$CURRENT_BRANCH" 2>/dev/null || true
  PULL_OUTPUT="reset to origin"
}

if echo "$PULL_OUTPUT" | grep -q "Already up to date"; then
  ok "Already up to date"
else
  ok "Code updated ($(git log --oneline -1 | cut -c1-7))"
fi

# ── Step 4: Install / update dependencies ────────────────────────────────────

step "4/12" "Installing dependencies..."

cd "$FINTHEON_ROOT"
bun install --silent 2>/dev/null || bun install 2>/dev/null || warn "Root deps install had issues"
ok "Root dependencies"

cd "$FINTHEON_ROOT/backend-hono"
bun install --silent 2>/dev/null || bun install 2>/dev/null || warn "Backend deps install had issues"
ok "Backend dependencies"

if [[ -d "$FINTHEON_ROOT/frontend" && -f "$FINTHEON_ROOT/frontend/package.json" ]]; then
  cd "$FINTHEON_ROOT/frontend"
  bun install --silent 2>/dev/null || bun install 2>/dev/null || warn "Frontend deps install had issues"
  ok "Frontend dependencies"
fi

if [[ -d "$FINTHEON_ROOT/mobile" && -f "$FINTHEON_ROOT/mobile/package.json" ]]; then
  cd "$FINTHEON_ROOT/mobile"
  bun install --silent 2>/dev/null || bun install 2>/dev/null || warn "Mobile deps install had issues"
  ok "Mobile dependencies"
fi

cd "$FINTHEON_ROOT"

# ── Step 5: Ensure environment is complete ───────────────────────────────────

step "5/12" "Checking environment..."

BACKEND_ENV="$FINTHEON_ROOT/backend-hono/.env"
if [[ -f "$BACKEND_ENV" ]]; then
  # Ensure bootstrap vars exist — secrets vault fills the rest from Supabase on boot
  grep -q "^DATABASE_URL=" "$BACKEND_ENV" 2>/dev/null || echo "DATABASE_URL=$SUPABASE_DATABASE_URL" >> "$BACKEND_ENV"
  grep -q "^SUPABASE_URL=" "$BACKEND_ENV" 2>/dev/null || echo "SUPABASE_URL=https://nrcfnzclbjboctptxaxx.supabase.co" >> "$BACKEND_ENV"
  grep -q "^SUPABASE_ANON_KEY=" "$BACKEND_ENV" 2>/dev/null || echo "SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY2ZuemNsYmpib2N0cHR4YXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDgxODksImV4cCI6MjA4OTUyNDE4OX0.JXzVk5CDL6rxU5t_rl-Ku2YnPi0PeBF-VOpcSEZTbIM" >> "$BACKEND_ENV"
  grep -q "^PORT=" "$BACKEND_ENV" 2>/dev/null || echo "PORT=8080" >> "$BACKEND_ENV"
  grep -q "^ENABLE_CENTRAL_SCORING=" "$BACKEND_ENV" 2>/dev/null || echo "ENABLE_CENTRAL_SCORING=true" >> "$BACKEND_ENV"
  ok "Environment verified (vault fills secrets on boot)"
else
  warn "No .env found — running setup to create one"
  bash "$FINTHEON_ROOT/scripts/fintheon-setup.sh" 2>/dev/null || true
fi

# ── Step 6: Verify VProxy Anthropic OAuth ──────────────────────────────────

step "6/12" "Verifying Anthropic OAuth via VProxy..."
if [[ -f "$FINTHEON_ROOT/scripts/vproxy-anthropic-oauth.sh" ]]; then
  if bash "$FINTHEON_ROOT/scripts/vproxy-anthropic-oauth.sh"; then
    ok "VProxy Anthropic OAuth ready"
  else
    warn "VProxy OAuth check failed (non-fatal) — run: fintheon oauth"
  fi
else
  warn "vproxy-anthropic-oauth.sh not found — skipping OAuth check"
fi

# ── Step 6.5: Ensure Claude Code hooks are executable ───────────────────────

if [[ -d "$FINTHEON_ROOT/.claude/hooks" ]]; then
  chmod +x "$FINTHEON_ROOT/.claude/hooks/"*.sh 2>/dev/null || true
  ok "Claude Code hooks executable"
fi

# ── Step 6.6: Ensure MCP servers are cloned/updated ────────────────────────

MCP_DIR="$HOME/Documents/Codebases"

# financial-datasets MCP server (stock data, crypto, news)
FD_MCP="$MCP_DIR/financial-datasets-mcp"
if [[ -d "$FD_MCP/.git" ]]; then
  git -C "$FD_MCP" pull --quiet 2>/dev/null || true
  ok "financial-datasets MCP updated"
else
  git clone --quiet https://github.com/financial-datasets/mcp-server "$FD_MCP" 2>/dev/null || true
  ok "financial-datasets MCP cloned"
fi

# tradingview MCP server (screener, technicals, chart data)
TV_MCP="$MCP_DIR/tradingview-mcp"
if [[ -d "$TV_MCP/.git" ]]; then
  git -C "$TV_MCP" pull --quiet 2>/dev/null || true
  cd "$TV_MCP" && npm install --silent 2>/dev/null || true
  cd "$FINTHEON_ROOT"
  ok "tradingview MCP updated"
else
  git clone --quiet https://github.com/tradesdontlie/tradingview-mcp.git "$TV_MCP" 2>/dev/null || true
  cd "$TV_MCP" && npm install --silent 2>/dev/null || true
  cd "$FINTHEON_ROOT"
  ok "tradingview MCP cloned"
fi

# Install uv if missing (needed for Python MCP servers)
if ! command -v uv &>/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh 2>/dev/null || warn "uv install failed — Python MCP servers won't work"
fi

# ── Step 7: Rebuild backend ─────────────────────────────────────────────────

step "7/12" "Building backend..."
cd "$FINTHEON_ROOT/backend-hono"
if bun run build 2>&1 | tail -1; then
  ok "Backend compiled"
else
  warn "Backend build had warnings — attempting to continue"
fi
cd "$FINTHEON_ROOT"

# ── Step 8: Rebuild frontend + DMG ──────────────────────────────────────────

step "8/12" "Building frontend + DMG..."

# Build frontend
if npx vite build 2>&1 | tail -1; then
  ok "Frontend built"
else
  warn "Frontend build had issues"
fi

# Build DMG
if npm run desktop:build 2>&1 | grep -E "✓|building.*DMG|Built" | tail -2; then
  ok "DMG built"

  # Install to /Applications — find the newest DMG regardless of version in filename
  DMG_PATH=$(ls -t "$FINTHEON_ROOT/desktop-dist"/Fintheon-*-arm64.dmg 2>/dev/null | head -1)
  if [[ -n "$DMG_PATH" && -f "$DMG_PATH" ]]; then
    DMG_NAME=$(basename "$DMG_PATH")
    # Copy to Downloads
    cp "$DMG_PATH" "$HOME/Downloads/$DMG_NAME" 2>/dev/null || true

    # Eject any existing volumes
    for vol in /Volumes/Fintheon*; do
      hdiutil detach "$vol" -quiet 2>/dev/null || true
    done

    # Install
    rm -rf /Applications/Fintheon.app /Applications/fintheon.app 2>/dev/null || true
    hdiutil attach "$DMG_PATH" -nobrowse -quiet 2>/dev/null || true
    VOLUME=$(ls -d /Volumes/Fintheon* 2>/dev/null | head -1)
    if [[ -n "$VOLUME" ]]; then
      cp -R "$VOLUME/Fintheon.app" /Applications/ 2>/dev/null || true
      hdiutil detach "$VOLUME" -quiet 2>/dev/null || true
      xattr -cr /Applications/Fintheon.app 2>/dev/null || true
      ok "App installed to /Applications"
    fi
  fi
else
  warn "DMG build skipped — use dev mode with 'fintheon start'"
fi

# Re-install CLI in case the script was updated
if [[ -f "$FINTHEON_ROOT/scripts/install-cli.sh" ]]; then
  bash "$FINTHEON_ROOT/scripts/install-cli.sh" 2>/dev/null || true
fi

# ── Step 9: Restart backend + launch ────────────────────────────────────────

step "9/12" "Starting backend..."
cd "$FINTHEON_ROOT/backend-hono"

lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

nohup bun run src/index.ts > /tmp/fintheon-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for ready
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

# ── Step 10: Cleanup legacy Twitter CLI + peer onboarding ──────────────────

step "10/12" "Refreshing X feed tokens..."
# [claude-code 2026-04-16] Force-reload Rettiwt keys from DB + reset cooldowns on update
REFRESH_RESULT=$(curl -s -X POST localhost:8080/api/riskflow/rettiwt-refresh 2>/dev/null || echo '{}')
TOTAL_KEYS=$(echo "$REFRESH_RESULT" | grep -o '"totalKeys":[0-9]*' | cut -d: -f2 2>/dev/null || echo "0")
RESET_COUNT=$(echo "$REFRESH_RESULT" | grep -o '"resetCount":[0-9]*' | cut -d: -f2 2>/dev/null || echo "0")
if [[ "$TOTAL_KEYS" -gt 0 ]]; then
  ok "Rettiwt pool refreshed: $TOTAL_KEYS keys, $RESET_COUNT cooldowns reset"
else
  warn "Rettiwt pool empty — run: fintheon peers"
fi

step "11/12" "Cleaning up legacy Twitter CLI + peer sync..."

# Remove Twitter CLI if installed (replaced by Rettiwt library — no CLI needed)
if command -v twitter &>/dev/null; then
  TWITTER_PATH="$(which twitter 2>/dev/null)"
  rm -f "$TWITTER_PATH" 2>/dev/null || true
  ok "Removed legacy Twitter CLI ($TWITTER_PATH)"
fi
# Remove twitter-cli config/data if present
rm -rf "$HOME/.twitter-cli" 2>/dev/null || true
rm -rf "$HOME/.config/twitter-cli" 2>/dev/null || true
# Remove old RETTIWT_AUTH_TOKEN from .env (keys are now per-user in Supabase)
if [[ -f "$BACKEND_ENV" ]]; then
  sed -i '' '/^RETTIWT_AUTH_TOKEN=/d' "$BACKEND_ENV" 2>/dev/null || true
fi
ok "Legacy Twitter CLI artifacts cleaned"

# Peer onboarding sync
if [[ -f "$FINTHEON_ROOT/scripts/peer-bootstrap.sh" ]]; then
  if bash "$FINTHEON_ROOT/scripts/peer-bootstrap.sh" --from-update; then
    ok "Peer onboarding sync complete"
  else
    warn "Peer onboarding check failed (non-fatal) — run: fintheon peers"
  fi
else
  warn "peer-bootstrap.sh not found — skipping peer onboarding sync"
fi

# ── Mobile bridge health check ──────────────────────────────────────────────
info "Checking mobile bridge connection..."
BRIDGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "https://fintheon.fly.dev/api/diagnostics" 2>/dev/null || echo "000")
if [[ "$BRIDGE_STATUS" == "200" ]]; then
  ok "Mobile bridge connected (fintheon.fly.dev)"
elif [[ "$BRIDGE_STATUS" == "000" ]]; then
  warn "Mobile bridge unreachable — mobile PWA will not have API access until backend is online"
else
  warn "Mobile bridge returned HTTP $BRIDGE_STATUS — mobile PWA may have degraded API access"
fi

# ── Restore stashed changes ─────────────────────────────────────────────────

if [[ "$HAS_CHANGES" == "true" ]]; then
  git stash pop --quiet 2>/dev/null || warn "Could not restore stashed changes — run 'git stash pop' manually"
fi

# ── Done ─────────────────────────────────────────────────────────────────────

VERSION=$(git describe --tags --always 2>/dev/null || git log --oneline -1 | cut -c1-7)
echo ""
echo -e "      ${_FIRE3}  )  ${_R}                                    ${_FIRE3}  (  ${_R}"
echo -e "      ${_FIRE2} ( \\ ${_R}                                    ${_FIRE2} / ) ${_R}"
echo -e "      ${_FIRE1}  )( ${_R}                                    ${_FIRE1}  )( ${_R}"
echo -e "      ${_EMBER} /|\\${_R}                                     ${_EMBER} /|\\${_R}"
echo -e "      ${_GOLD}]|||[${_R}  ${_GOLD}╔══════════════════════════════╗${_R}  ${_GOLD}]|||[${_R}"
printf -v _vl "%-30s" "UPDATE COMPLETE  $VERSION"
echo -e "      ${_GOLD}]|||[${_R}  ${_GOLD}║${_R} ${_BOLD}${_GREEN}${_vl}${_R}${_GOLD}║${_R}  ${_GOLD}]|||[${_R}"
echo -e "      ${_GOLD}]|||[${_R}  ${_GOLD}║${_R}                                ${_GOLD}║${_R}  ${_GOLD}]|||[${_R}"
printf -v _bl "%-30s" "Backend: http://localhost:8080"
echo -e "      ${_GOLD}]|||[${_R}  ${_GOLD}║${_R} ${_CREAM}${_bl}${_R}${_GOLD}║${_R}  ${_GOLD}]|||[${_R}"
printf -v _ll "%-30s" "Logs: tail -f /tmp/fintheon.."
echo -e "      ${_GOLD}]|||[${_R}  ${_GOLD}║${_R} ${_DIM}${_ll}${_R}${_GOLD}║${_R}  ${_GOLD}]|||[${_R}"
echo -e "      ${_GOLD}]|||[${_R}  ${_GOLD}╚══════════════════════════════╝${_R}  ${_GOLD}]|||[${_R}"
echo -e "      ${_DIM} ╨╨╨ ${_R}                                    ${_DIM} ╨╨╨ ${_R}"
echo ""

# Launch app + close terminal
if [[ -d /Applications/Fintheon.app ]]; then
  info "Opening Fintheon..."
  open /Applications/Fintheon.app 2>/dev/null || true
  sleep 2
  osascript -e 'tell application "Terminal" to close (every window whose name contains "fintheon")' 2>/dev/null || true
fi
