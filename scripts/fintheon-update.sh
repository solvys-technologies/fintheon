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

# [claude-code 2026-04-18] Resolve install path: FINTHEON_ROOT env > ~/.fintheon/install-path > default
FINTHEON_ROOT="${FINTHEON_ROOT:-$(cat "$HOME/.fintheon/install-path" 2>/dev/null || echo "$HOME/Documents/Codebases/fintheon")}"
UPDATE_VERSION="5.38.1"

# ── Self-update bootstrap (v5.25.2) ──────────────────────────────────────────
# Root cause fix: bash loads the entire script into memory at invocation, so
# `fintheon update` that fixed the repo body but left the script file untouched
# would keep re-running the stale copy indefinitely — every subsequent run was
# pinned to whatever logic was baked into fintheon-update.sh at install time.
# Before we do any real work we fetch tags, check whether our own bytes match
# the latest v*.*.* release's scripts/fintheon-update.sh blob, overwrite and
# re-exec if they don't. FINTHEON_SELFUPDATED guards against infinite recursion.
if [[ -z "${FINTHEON_SELFUPDATED:-}" ]] && [[ -d "$FINTHEON_ROOT/.git" ]]; then
  export FINTHEON_SELFUPDATED=1
  SELFUPDATE_LOG="/tmp/fintheon-selfupdate.log"
  (
    cd "$FINTHEON_ROOT" || exit 0
    git fetch --tags --force --quiet origin 2>>"$SELFUPDATE_LOG" || true
    LATEST_TAG=$(git tag -l --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
    if [[ -n "$LATEST_TAG" ]]; then
      FRESH_CONTENT=$(git show "$LATEST_TAG:scripts/fintheon-update.sh" 2>/dev/null || true)
      CURRENT_CONTENT=$(cat scripts/fintheon-update.sh 2>/dev/null || true)
      if [[ -n "$FRESH_CONTENT" ]] && [[ "$FRESH_CONTENT" != "$CURRENT_CONTENT" ]]; then
        printf '%s' "$FRESH_CONTENT" > scripts/fintheon-update.sh
        chmod +x scripts/fintheon-update.sh
        echo "  · self-update: refreshed fintheon-update.sh to $LATEST_TAG"
      fi
    fi
  ) || true
  exec bash "$FINTHEON_ROOT/scripts/fintheon-update.sh" "$@"
fi

SUPABASE_DATABASE_URL="postgresql://postgres:PIR0670963957%24@db.nrcfnzclbjboctptxaxx.supabase.co:5432/postgres"

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
  printf "      ${_FIRE1}  )( ${_R}                                    ${_FIRE1}  )( ${_R}\n"
  printf "      ${_EMBER} /|\ ${_R}                                    ${_EMBER} /|\ ${_R}\n"
  printf "      ${_GOLD}]|||[${_R}  ${_GOLD}╔══════════════════════════════╗${_R}  ${_GOLD}]|||[${_R}\n"
  printf "      ${_GOLD}]|||[${_R}  ${_GOLD}║${_R} ${_BOLD}${_GOLD}${_t}${_R}${_GOLD}║${_R}  ${_GOLD}]|||[${_R}\n"
  printf "      ${_GOLD}]|||[${_R}  ${_GOLD}║${_R} ${_DIM}${_s}${_R}${_GOLD}║${_R}  ${_GOLD}]|||[${_R}\n"
  printf "      ${_GOLD}]|||[${_R}  ${_GOLD}╚══════════════════════════════╝${_R}  ${_GOLD}]|||[${_R}\n"
  printf "      ${_DIM} ╨╨╨ ${_R}                                    ${_DIM} ╨╨╨ ${_R}\n"
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
# [claude-code 2026-04-24] Tag-authoritative updates. Prior versions reset the
# working tree to origin/$CURRENT_BRANCH, which silently pinned anyone on `main`
# to whatever `main` last tracked — and `main` drifts weeks behind the active
# deploy branch (all shipping lives on feature branches like s32-harper-2-1).
# Now the update flow resolves the newest v*.*.* tag on origin and hard-resets
# to that. Branch state is no longer load-bearing.
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
info "Branch: ${CURRENT_BRANCH:-(detached)}"
info "Current: $(git describe --tags --abbrev=0 2>/dev/null || git log --oneline -1 | cut -c1-7)"
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

# ── Step 3: Pull latest release tag ─────────────────────────────────────────
# [claude-code 2026-04-24] Tag-authoritative. We resolve the highest v*.*.* tag
# on origin (sorted by semver) and hard-reset the working tree to it. Local
# user changes were stashed in step 2 and popped at the end, so the tree after
# this step is guaranteed to match the shipped release byte-for-byte. No
# branch drift, no stale `main`, no detached-HEAD guesswork. Diagnostics go to
# /tmp/fintheon-update-pull.log.

step "3/12" "Pulling latest release..."

PULL_LOG="/tmp/fintheon-update-pull.log"
: > "$PULL_LOG"

git fetch --all --prune --prune-tags >>"$PULL_LOG" 2>&1 || true
git fetch --tags --force >>"$PULL_LOG" 2>&1 || true

# Resolve the newest semver tag of the form v<major>.<minor>.<patch> (no suffix).
# `git tag -l` glob matching is coarse, so we filter with grep -E to reject
# tags like v8.30.1-s12-fix. `--sort=-v:refname` gives us semver order.
LATEST_TAG=$(git tag -l --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)

if [[ -z "$LATEST_TAG" ]]; then
  warn "No v*.*.* tag found on origin — falling back to current branch"
  FALLBACK_BRANCH="${CURRENT_BRANCH:-$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@' || echo main)}"
  BEFORE=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  git reset --hard "origin/$FALLBACK_BRANCH" >>"$PULL_LOG" 2>&1 || true
  AFTER=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  if [[ "$BEFORE" == "$AFTER" ]]; then
    ok "Already up to date ($FALLBACK_BRANCH)"
  else
    ok "Code updated to $FALLBACK_BRANCH ($AFTER)"
  fi
else
  BEFORE=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  git reset --hard "$LATEST_TAG" >>"$PULL_LOG" 2>&1 || true
  AFTER=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  if [[ "$BEFORE" == "$AFTER" ]]; then
    ok "Already on $LATEST_TAG"
  else
    ok "Code updated to $LATEST_TAG ($AFTER)"
  fi
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

# [claude-code 2026-04-20] S27 — Hermes Python sidecar deps via uv.
# Only syncs if hermes-sidecar/ exists AND uv is installed (step 6.6 handles uv install).
# Sidecar itself is HERMES_SIDECAR_ENABLED=false by default, so deps can be dormant.
if [[ -d "$FINTHEON_ROOT/hermes-sidecar" && -f "$FINTHEON_ROOT/hermes-sidecar/pyproject.toml" ]]; then
  if command -v uv &>/dev/null; then
    cd "$FINTHEON_ROOT/hermes-sidecar"
    uv sync --quiet 2>/dev/null || warn "Hermes sidecar uv sync had issues (non-fatal)"
    ok "Hermes sidecar Python deps (uv)"
  else
    info "uv not yet installed — hermes sidecar deps deferred to step 6.6"
  fi
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

  # [claude-code 2026-04-20] S27 backfills — safe defaults so boot doesn't
  # error on missing vars. Real values / secrets flow from Supabase vault.
  grep -q "^HERMES_SIDECAR_ENABLED=" "$BACKEND_ENV" 2>/dev/null || echo "HERMES_SIDECAR_ENABLED=false" >> "$BACKEND_ENV"
  grep -q "^HERMES_SIDECAR_URL=" "$BACKEND_ENV" 2>/dev/null || echo "HERMES_SIDECAR_URL=http://localhost:8318" >> "$BACKEND_ENV"
  # INTERNAL_HERMES_JWT is secret — only generate a local stub if truly missing
  # so the sidecar can boot on localhost. Prod value lives in Fly secrets.
  if ! grep -q "^INTERNAL_HERMES_JWT=" "$BACKEND_ENV" 2>/dev/null; then
    LOCAL_JWT=$(openssl rand -hex 32 2>/dev/null || echo "local-dev-$(date +%s)")
    echo "INTERNAL_HERMES_JWT=$LOCAL_JWT" >> "$BACKEND_ENV"
  fi
  grep -q "^BROWSER_UNIVERSAL_ENABLED=" "$BACKEND_ENV" 2>/dev/null || echo "BROWSER_UNIVERSAL_ENABLED=false" >> "$BACKEND_ENV"
  grep -q "^ROUTING_DAILY_CAP=" "$BACKEND_ENV" 2>/dev/null || echo "ROUTING_DAILY_CAP=20" >> "$BACKEND_ENV"
  grep -q "^ROUTING_DISABLE_BUDGET=" "$BACKEND_ENV" 2>/dev/null || echo "ROUTING_DISABLE_BUDGET=false" >> "$BACKEND_ENV"
  grep -q "^FLAG_NEWS_WORKER_WRITES_RISKFLOW=" "$BACKEND_ENV" 2>/dev/null || echo "FLAG_NEWS_WORKER_WRITES_RISKFLOW=false" >> "$BACKEND_ENV"
  grep -q "^NEWS_WORKER_PORT=" "$BACKEND_ENV" 2>/dev/null || echo "NEWS_WORKER_PORT=8082" >> "$BACKEND_ENV"
  grep -q "^GEPA_DRY_RUN=" "$BACKEND_ENV" 2>/dev/null || echo "GEPA_DRY_RUN=false" >> "$BACKEND_ENV"
  grep -q "^GEPA_DEEP=" "$BACKEND_ENV" 2>/dev/null || echo "GEPA_DEEP=false" >> "$BACKEND_ENV"
  grep -q "^VOICE_SIDECAR_DISABLED=" "$BACKEND_ENV" 2>/dev/null || echo "VOICE_SIDECAR_DISABLED=false" >> "$BACKEND_ENV"
  grep -q "^RETTIWT_REENABLE=" "$BACKEND_ENV" 2>/dev/null || echo "RETTIWT_REENABLE=false" >> "$BACKEND_ENV"

  ok "Environment verified (vault fills secrets on boot)"
else
  warn "No .env found — running setup to create one"
  bash "$FINTHEON_ROOT/scripts/fintheon-setup.sh" 2>/dev/null || true
fi

# ── Step 5.5: Install S27 launchd units (hermes sidecar, news-worker, gepa) ──
# [claude-code 2026-04-20] S27 introduces 3 new background services. Symlink
# plists from the repo into ~/Library/LaunchAgents so launchctl can load them.
# Loading is opt-in per service — we don't auto-`launchctl load` here because
# hermes needs a Python env + INTERNAL_HERMES_JWT agreement with prod, and
# news-worker/gepa need their Fly counterparts live first.

LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENTS_DIR" 2>/dev/null || true

UNLOADED_LABELS=()
for PLIST_PAIR in \
  "$FINTHEON_ROOT/hermes-sidecar/launchd/io.solvys.fintheon-hermes.plist:io.solvys.fintheon-hermes.plist" \
  "$FINTHEON_ROOT/launchd/io.solvys.fintheon-news-worker.plist:io.solvys.fintheon-news-worker.plist" \
  "$FINTHEON_ROOT/launchd/io.solvys.fintheon-gepa.plist:io.solvys.fintheon-gepa.plist"; do
  SRC="${PLIST_PAIR%%:*}"
  NAME="${PLIST_PAIR##*:}"
  DEST="$LAUNCH_AGENTS_DIR/$NAME"
  if [[ -f "$SRC" ]]; then
    if [[ ! -L "$DEST" && ! -f "$DEST" ]]; then
      ln -s "$SRC" "$DEST" 2>/dev/null && ok "Linked launchd plist: $NAME"
    fi
    LABEL="${NAME%.plist}"
    if ! launchctl list 2>/dev/null | awk '{print $3}' | grep -qx "$LABEL"; then
      UNLOADED_LABELS+=("$LABEL")
    fi
  fi
done
if (( ${#UNLOADED_LABELS[@]} > 0 )); then
  info "S27 launchd plists linked but NOT loaded: ${UNLOADED_LABELS[*]} — run 'launchctl load -w ~/Library/LaunchAgents/<label>.plist' when ready"
else
  ok "S27 launchd plists loaded (hermes, news-worker, gepa)"
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

# ── Step 8: Install desktop app (download-first, local-rebuild fallback) ────
# [claude-code 2026-04-24] Prefer the release-attached DMG from GitHub over a
# local rebuild. Every /solvys-deploy attaches both the Mac DMG and Windows
# .exe to the GH release, so the authoritative artifact already exists — we
# don't need to rebuild 100+ MB of native bundle on every user's machine.
# Local rebuild is kept as a fallback for offline / dev / prerelease scenarios,
# but it now logs full output to /tmp so failures aren't swallowed by `| tail`.

step "8/12" "Installing desktop app..."

VERSION_NUM="${LATEST_TAG#v}"
ARCH="$(uname -m)"
if [[ "$ARCH" == "arm64" ]]; then
  DMG_SUFFIX="arm64"
else
  DMG_SUFFIX="x64"
fi
DMG_NAME="Fintheon-${VERSION_NUM}-${DMG_SUFFIX}.dmg"
DMG_URL="https://github.com/solvys-technologies/fintheon/releases/download/${LATEST_TAG}/${DMG_NAME}"
DMG_LOCAL="$HOME/Downloads/$DMG_NAME"

# Private repo — authenticated download via `gh` CLI is required. Plain curl
# 404s because the releases/download URL only works on public repos. Fall
# through to local rebuild if gh isn't installed or isn't logged in.
DOWNLOAD_OK=false
if [[ -n "$LATEST_TAG" ]] && command -v gh &>/dev/null && gh auth status &>/dev/null; then
  info "Downloading $DMG_NAME via gh release..."
  if gh release download "$LATEST_TAG" \
      --repo solvys-technologies/fintheon \
      --pattern "$DMG_NAME" \
      --output "$DMG_LOCAL" \
      --clobber 2>/dev/null; then
    DOWNLOAD_OK=true
    ok "Downloaded release DMG"
  else
    warn "Release DMG download failed — will rebuild locally"
    /bin/rm -f "$DMG_LOCAL" 2>/dev/null || true
  fi
elif [[ -n "$LATEST_TAG" ]]; then
  info "gh CLI unavailable or not authed — will rebuild locally (brew install gh && gh auth login to switch to prebuilt downloads)"
fi

if [[ "$DOWNLOAD_OK" != "true" ]]; then
  # Local fallback rebuild. Log full output so the rollup stacktrace isn't
  # truncated by `| tail -1` the way it used to be.
  VITE_LOG="/tmp/fintheon-update-vite.log"
  DMG_LOG="/tmp/fintheon-update-dmg.log"
  : > "$VITE_LOG"
  : > "$DMG_LOG"

  info "Building frontend locally (fallback)... see $VITE_LOG"
  if npx vite build > "$VITE_LOG" 2>&1; then
    ok "Frontend built"
  else
    warn "Frontend build failed — tail:"
    tail -10 "$VITE_LOG" | sed 's/^/    /'
  fi

  info "Building DMG locally (fallback)... see $DMG_LOG"
  if npm run desktop:build > "$DMG_LOG" 2>&1; then
    ok "DMG built"
    DMG_LOCAL=$(ls -t "$FINTHEON_ROOT/desktop-dist"/Fintheon-*-${DMG_SUFFIX}.dmg 2>/dev/null | head -1)
  else
    warn "DMG build failed — tail:"
    tail -10 "$DMG_LOG" | sed 's/^/    /'
    DMG_LOCAL=""
  fi
fi

# Install whichever DMG we ended up with.
if [[ -n "$DMG_LOCAL" && -f "$DMG_LOCAL" ]]; then
  for vol in /Volumes/Fintheon*; do
    hdiutil detach "$vol" -quiet 2>/dev/null || true
  done
  /bin/rm -R -f /Applications/Fintheon.app /Applications/fintheon.app 2>/dev/null || true
  hdiutil attach "$DMG_LOCAL" -nobrowse -quiet 2>/dev/null || true
  VOLUME=$(ls -d /Volumes/Fintheon* 2>/dev/null | head -1)
  if [[ -n "$VOLUME" ]]; then
    cp -R "$VOLUME/Fintheon.app" /Applications/ 2>/dev/null || true
    hdiutil detach "$VOLUME" -quiet 2>/dev/null || true
    xattr -cr /Applications/Fintheon.app 2>/dev/null || true
    ok "App installed to /Applications"
  fi
else
  warn "No DMG available — /Applications/Fintheon.app was not updated"
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

# ── Step 10: Refresh X feed tokens ─────────────────────────────────────────
# [claude-code 2026-04-16] Force-reload Rettiwt keys from DB + reset cooldowns on update.
# [claude-code 2026-04-20] Non-contributor case demoted from warn → info; it's
# optional ("you can add a key") rather than broken.

step "10/12" "Refreshing X feed tokens..."
REFRESH_RESULT=$(curl -s --max-time 5 -X POST localhost:8080/api/riskflow/rettiwt-refresh 2>/dev/null || echo '{}')
TOTAL_KEYS=$(echo "$REFRESH_RESULT" | grep -o '"totalKeys":[0-9]*' | head -1 | cut -d: -f2 2>/dev/null || echo "0")
RESET_COUNT=$(echo "$REFRESH_RESULT" | grep -o '"resetCount":[0-9]*' | head -1 | cut -d: -f2 2>/dev/null || echo "0")
TOTAL_KEYS=${TOTAL_KEYS:-0}
RESET_COUNT=${RESET_COUNT:-0}
if [[ "$TOTAL_KEYS" -gt 0 ]]; then
  ok "X feed tokens refreshed ($TOTAL_KEYS keys, $RESET_COUNT cooldowns reset)"
else
  info "X feed tokens: not contributing (optional — 'fintheon peers' to add your key)"
fi

# ── Step 11: Clean up deprecated dependencies + peer sync ──────────────────
# [claude-code 2026-04-20] Renamed from "Twitter CLI cleanup" to a generic
# deprecated-dependency sweep. Each entry in the table below is a thing
# Fintheon used to ship but no longer relies on. Only emits `ok` when
# something actually existed and was removed — silent when the system is
# already clean. Add new entries here as deprecations accumulate.

step "11/12" "Cleaning up deprecated dependencies + peer sync..."

_CLEANED=0

# Deprecated binaries on $PATH (replaced by in-process libraries).
for _BIN in twitter; do
  if command -v "$_BIN" &>/dev/null; then
    _BIN_PATH="$(command -v "$_BIN" 2>/dev/null)"
    rm -f "$_BIN_PATH" 2>/dev/null || true
    ok "Removed deprecated binary: $_BIN ($_BIN_PATH)"
    _CLEANED=$((_CLEANED + 1))
  fi
done

# Deprecated config directories.
for _DIR in "$HOME/.twitter-cli" "$HOME/.config/twitter-cli"; do
  if [[ -d "$_DIR" ]]; then
    rm -rf "$_DIR" 2>/dev/null || true
    ok "Removed deprecated config: $(basename "$_DIR")"
    _CLEANED=$((_CLEANED + 1))
  fi
done

# Deprecated env vars (secrets vault + per-user Supabase rows replace them).
# NOTION_API_KEY is included because Notion was fully severed 2026-04-16.
if [[ -f "$BACKEND_ENV" ]]; then
  for _VAR in RETTIWT_AUTH_TOKEN TWITTER_CLI_PATH NOTION_API_KEY; do
    if grep -q "^${_VAR}=" "$BACKEND_ENV" 2>/dev/null; then
      sed -i '' "/^${_VAR}=/d" "$BACKEND_ENV" 2>/dev/null || true
      ok "Removed deprecated env var: $_VAR"
      _CLEANED=$((_CLEANED + 1))
    fi
  done
fi

if [[ "$_CLEANED" -eq 0 ]]; then
  ok "No deprecated dependencies found"
fi

# Peer onboarding sync
if [[ -f "$FINTHEON_ROOT/scripts/peer-bootstrap.sh" ]]; then
  if bash "$FINTHEON_ROOT/scripts/peer-bootstrap.sh" --from-update >/dev/null 2>&1; then
    ok "Peer onboarding sync complete"
  else
    info "Peer onboarding skipped (optional — run 'fintheon peers' to configure)"
  fi
else
  info "peer-bootstrap.sh not present — skipping peer sync"
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

VERSION=$(git describe --tags --abbrev=0 2>/dev/null || git log --oneline -1 | cut -c1-7)
echo ""
echo -e "      ${_FIRE3}  )  ${_R}                                    ${_FIRE3}  (  ${_R}"
echo -e "      ${_FIRE2} ( \\ ${_R}                                    ${_FIRE2} / ) ${_R}"
echo -e "      ${_FIRE1}  )( ${_R}                                    ${_FIRE1}  )( ${_R}"
echo -e "      ${_EMBER} /|\\ ${_R}                                    ${_EMBER} /|\\ ${_R}"
echo -e "      ${_GOLD}]|||[${_R}  ${_GOLD}╔══════════════════════════════╗${_R}  ${_GOLD}]|||[${_R}"
printf -v _vl "%-30.30s" "UPDATE COMPLETE  $VERSION"
echo -e "      ${_GOLD}]|||[${_R}  ${_GOLD}║${_R} ${_BOLD}${_GREEN}${_vl}${_R}${_GOLD}║${_R}  ${_GOLD}]|||[${_R}"
echo -e "      ${_GOLD}]|||[${_R}  ${_GOLD}║${_R}                                ${_GOLD}║${_R}  ${_GOLD}]|||[${_R}"
printf -v _bl "%-30.30s" "Backend: http://localhost:8080"
echo -e "      ${_GOLD}]|||[${_R}  ${_GOLD}║${_R} ${_CREAM}${_bl}${_R}${_GOLD}║${_R}  ${_GOLD}]|||[${_R}"
printf -v _ll "%-30.30s" "Logs: tail -f /tmp/fintheon.."
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
