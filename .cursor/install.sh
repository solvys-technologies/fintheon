#!/usr/bin/env bash
# [claude-code 2026-04-17] Ultrareview / Cursor Background Agent bootstrap.
# Installs dependencies and materializes .env files in cloud containers that
# clone the repo fresh (where gitignored .env files don't exist).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Fintheon bootstrap ($ROOT)"

# ----------------------------------------------------------------------------
# 1. Bun — install if missing (Debian/Ubuntu containers typically lack it)
# ----------------------------------------------------------------------------
if ! command -v bun >/dev/null 2>&1; then
  echo "==> Installing Bun"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
bun --version

# ----------------------------------------------------------------------------
# 2. Write .env files (gitignored; needed for typecheck/build/tests)
# ----------------------------------------------------------------------------
echo "==> Writing env files"

cat > "$ROOT/.env" <<'ROOT_ENV'
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FLUXER_COMMUNITY_URL=https://web.fluxer.app/channels/1492795127439495222
ROOT_ENV

cat > "$ROOT/backend-hono/.env" <<'BACKEND_ENV'
NOTION_API_KEY=
AI_PRIMARY_PROVIDER=deepseek
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
HERMES_API_URL=http://localhost:8081/v1
OPENROUTER_API_KEY=
NOUS_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
EXA_API_KEY=
FRED_API_KEY=
HERMES_BOARDROOM_CRON=0,30 7-9 * * 1-5
HERMES_BOARDROOM_TZ=America/New_York
BOARDROOM_MEETING_WINDOW_MINUTES=90
BOARDROOM_MEETING_HOUR_LOCAL=10
HERMES_PREMARKET_CRON=0 8 * * 1-5
HERMES_POSTMARKET_CRON=30 16 * * 1-5
DISPATCH_SCHEDULER_ENABLED=false
ENABLE_CENTRAL_SCORING=false
CRON_SECRET_TOKEN=
DATABASE_URL=
SUPABASE_ANON_KEY=
PORT=8080
GH_TOKEN=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@pricedinresearch.io
BACKEND_ENV

cat > "$ROOT/frontend/.env.development" <<'FRONTEND_ENV'
VITE_CLIENT_TARGET=http://localhost:8080
VITE_API_URL=http://localhost:8080
VITE_BYPASS_AUTH=false
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FLUXER_COMMUNITY_URL=https://web.fluxer.app/channels/1492795127439495222
FRONTEND_ENV

# ----------------------------------------------------------------------------
# 3. Install dependencies — root, backend, frontend
# ----------------------------------------------------------------------------
echo "==> bun install (root)"
bun install --frozen-lockfile || bun install

echo "==> bun install (backend-hono)"
cd "$ROOT/backend-hono" && (bun install --frozen-lockfile || bun install)

echo "==> bun install (frontend)"
cd "$ROOT/frontend" && (bun install --frozen-lockfile || bun install)

cd "$ROOT"
echo "==> Bootstrap complete"
