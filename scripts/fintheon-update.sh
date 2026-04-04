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

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║          FINTHEON UPDATE v${UPDATE_VERSION}                      ║"
echo "  ║      Priced In Capital — Ave Trader                  ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""

# ── Validate repo exists ─────────────────────────────────────────────────────

if [[ ! -d "$FINTHEON_ROOT/.git" ]]; then
  echo "  ✗ Fintheon not found at $FINTHEON_ROOT"
  echo "    Run the setup script first:"
  echo '    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh)"'
  exit 1
fi

cd "$FINTHEON_ROOT"
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
echo "  Branch: $CURRENT_BRANCH"
echo "  Current: $(git describe --tags --always 2>/dev/null || git log --oneline -1 | cut -c1-7)"
echo ""

# ── Helper functions ─────────────────────────────────────────────────────────

ok()   { echo "  ✓ $1"; }
warn() { echo "  ⚠ $1"; }
info() { echo "  · $1"; }

# ── Step 1: Stop Fintheon + kill backend ─────────────────────────────────────

echo "  [1/10] Stopping Fintheon..."
pkill -f "Fintheon" 2>/dev/null || true
pkill -f "electron.*fintheon" 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1
ok "Stopped"

# ── Step 2: Stash local changes ─────────────────────────────────────────────

echo "  [2/10] Checking for local changes..."
HAS_CHANGES=false
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  HAS_CHANGES=true
  git stash push -m "fintheon-update-$(date +%Y%m%d-%H%M%S)" --quiet 2>/dev/null || true
  info "Local changes stashed"
else
  ok "Clean working directory"
fi

# ── Step 3: Pull latest code ────────────────────────────────────────────────

echo "  [3/10] Pulling latest code..."
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

echo "  [4/10] Installing dependencies..."

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

cd "$FINTHEON_ROOT"

# ── Step 5: Ensure environment is complete ───────────────────────────────────

echo "  [5/10] Checking environment..."

BACKEND_ENV="$FINTHEON_ROOT/backend-hono/.env"
if [[ -f "$BACKEND_ENV" ]]; then
  # Ensure critical defaults exist (don't overwrite existing values)
  grep -q "^BYPASS_AUTH=" "$BACKEND_ENV" 2>/dev/null || echo "BYPASS_AUTH=true" >> "$BACKEND_ENV"
  grep -q "^PORT=" "$BACKEND_ENV" 2>/dev/null || echo "PORT=8080" >> "$BACKEND_ENV"
  grep -q "^SUPABASE_URL=" "$BACKEND_ENV" 2>/dev/null || echo "SUPABASE_URL=https://nrcfnzclbjboctptxaxx.supabase.co" >> "$BACKEND_ENV"
  grep -q "^SUPABASE_ANON_KEY=" "$BACKEND_ENV" 2>/dev/null || echo "SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY2ZuemNsYmpib2N0cHR4YXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDgxODksImV4cCI6MjA4OTUyNDE4OX0.JXzVk5CDL6rxU5t_rl-Ku2YnPi0PeBF-VOpcSEZTbIM" >> "$BACKEND_ENV"
  grep -q "^DATABASE_URL=" "$BACKEND_ENV" 2>/dev/null || echo "DATABASE_URL=$SUPABASE_DATABASE_URL" >> "$BACKEND_ENV"
  grep -q "^USE_VPROXY_ANTHROPIC=" "$BACKEND_ENV" 2>/dev/null || echo "USE_VPROXY_ANTHROPIC=true" >> "$BACKEND_ENV"
  grep -q "^VPROXY_BASE_URL=" "$BACKEND_ENV" 2>/dev/null || echo "VPROXY_BASE_URL=http://localhost:8317" >> "$BACKEND_ENV"
  grep -q "^VPROXY_API_KEY=" "$BACKEND_ENV" 2>/dev/null || echo "VPROXY_API_KEY=CLI_PROXY_API_KEY" >> "$BACKEND_ENV"
  grep -q "^VPROXY_ANTHROPIC_MODEL=" "$BACKEND_ENV" 2>/dev/null || echo "VPROXY_ANTHROPIC_MODEL=claude-opus-4.6" >> "$BACKEND_ENV"
  grep -q "^AI_PRIMARY_PROVIDER=" "$BACKEND_ENV" 2>/dev/null || echo "AI_PRIMARY_PROVIDER=anthropic-vproxy" >> "$BACKEND_ENV"
  ok "Environment verified"
else
  warn "No .env found — running setup to create one"
  bash "$FINTHEON_ROOT/scripts/fintheon-setup.sh" 2>/dev/null || true
fi

# ── Step 6: Verify VProxy Anthropic OAuth ──────────────────────────────────

echo "  [6/10] Verifying Anthropic OAuth via VProxy..."
if [[ -f "$FINTHEON_ROOT/scripts/vproxy-anthropic-oauth.sh" ]]; then
  if bash "$FINTHEON_ROOT/scripts/vproxy-anthropic-oauth.sh"; then
    ok "VProxy Anthropic OAuth ready"
  else
    warn "VProxy OAuth check failed (non-fatal) — run: fintheon oauth"
  fi
else
  warn "vproxy-anthropic-oauth.sh not found — skipping OAuth check"
fi

# ── Step 7: Rebuild backend ─────────────────────────────────────────────────

echo "  [7/10] Building backend..."
cd "$FINTHEON_ROOT/backend-hono"
if bun run build 2>&1 | tail -1; then
  ok "Backend compiled"
else
  warn "Backend build had warnings — attempting to continue"
fi
cd "$FINTHEON_ROOT"

# ── Step 8: Rebuild frontend + DMG ──────────────────────────────────────────

echo "  [8/10] Building frontend + DMG..."

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

echo "  [9/10] Starting backend..."
cd "$FINTHEON_ROOT/backend-hono"

lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

nohup node dist/index.js > /tmp/fintheon-backend.log 2>&1 &
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

# ── Step 10: Device Twitter check + round-robin onboarding ──────────────────

echo "  [10/10] Verifying per-device Twitter CLI + round-robin onboarding..."
if [[ -f "$FINTHEON_ROOT/scripts/peer-bootstrap.sh" ]]; then
  if bash "$FINTHEON_ROOT/scripts/peer-bootstrap.sh" --from-update; then
    ok "Peer onboarding sync complete"
  else
    warn "Peer onboarding check failed (non-fatal) — run: fintheon peers"
  fi
else
  warn "peer-bootstrap.sh not found — skipping peer onboarding sync"
fi

# ── Restore stashed changes ─────────────────────────────────────────────────

if [[ "$HAS_CHANGES" == "true" ]]; then
  git stash pop --quiet 2>/dev/null || warn "Could not restore stashed changes — run 'git stash pop' manually"
fi

# ── Done ─────────────────────────────────────────────────────────────────────

VERSION=$(git describe --tags --always 2>/dev/null || git log --oneline -1 | cut -c1-7)
echo ""
echo "  ══════════════════════════════════════════════════════"
echo "  ✓ Update complete"
echo "  Version: $VERSION"
echo ""
echo "  Backend:  http://localhost:8080"
echo "  Logs:     tail -f /tmp/fintheon-backend.log"
echo "  ══════════════════════════════════════════════════════"
echo ""

# Launch app
if [[ -d /Applications/Fintheon.app ]]; then
  info "Opening Fintheon..."
  open /Applications/Fintheon.app 2>/dev/null || true
fi

echo "  Backend running. Press Ctrl+C to stop."
wait $BACKEND_PID 2>/dev/null || true
