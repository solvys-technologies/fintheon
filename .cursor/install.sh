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
VITE_SUPABASE_URL=https://nrcfnzclbjboctptxaxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY2ZuemNsYmpib2N0cHR4YXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDgxODksImV4cCI6MjA4OTUyNDE4OX0.JXzVk5CDL6rxU5t_rl-Ku2YnPi0PeBF-VOpcSEZTbIM
VITE_FLUXER_COMMUNITY_URL=https://web.fluxer.app/channels/1492795127439495222
ROOT_ENV

cat > "$ROOT/backend-hono/.env" <<'BACKEND_ENV'
NOTION_API_KEY=ntn_b53970766054GDqCRP7OlJAozGmxJrlUm1XUNMeEEUIg0g
AI_PRIMARY_PROVIDER=anthropic-vproxy
USE_VPROXY_ANTHROPIC=true
VPROXY_BASE_URL=http://localhost:8317
OPENROUTER_API_KEY=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
NOUS_API_KEY=sk-0kd71fk7u39bt7gytv3w5a
SUPABASE_URL=https://nrcfnzclbjboctptxaxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_anM2RX8GwKPAdkmoYqM3hg_vAKC8t9k
OPENAI_API_KEY=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
EXA_API_KEY=00fadee8-c5fc-4915-947b-4d642dd32a94
FRED_API_KEY=e7584a6e17cabdbe7df9ab4f4ba429a7
HERMES_BOARDROOM_CRON=0,30 7-9 * * 1-5
HERMES_BOARDROOM_TZ=America/New_York
BOARDROOM_MEETING_WINDOW_MINUTES=90
BOARDROOM_MEETING_HOUR_LOCAL=10
HERMES_PREMARKET_CRON=0 8 * * 1-5
HERMES_POSTMARKET_CRON=30 16 * * 1-5
DISPATCH_SCHEDULER_ENABLED=false
ENABLE_CENTRAL_SCORING=false
CRON_SECRET_TOKEN=local-dev
DATABASE_URL=postgresql://postgres:PIR0670963957%24@db.nrcfnzclbjboctptxaxx.supabase.co:5432/postgres
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY2ZuemNsYmpib2N0cHR4YXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDgxODksImV4cCI6MjA4OTUyNDE4OX0.JXzVk5CDL6rxU5t_rl-Ku2YnPi0PeBF-VOpcSEZTbIM
PORT=8080
GH_TOKEN=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
VAPID_PUBLIC_KEY=BJAVZwJa6NxfRXMViasE1VREZTod9xnEuKtK90FJaBS9bbjALejxrhd-EM1KAHwpJ7PBMX253YDAG9YrYte3TPc
VAPID_PRIVATE_KEY=YlEVH_uXJcl_ABY9gP6uU6fANaXmyrQg0n0qlyZmyj0
VAPID_SUBJECT=mailto:admin@pricedinresearch.io
BACKEND_ENV

cat > "$ROOT/frontend/.env.development" <<'FRONTEND_ENV'
VITE_CLIENT_TARGET=http://localhost:8080
VITE_API_URL=http://localhost:8080
VITE_BYPASS_AUTH=false
VITE_SUPABASE_URL=https://nrcfnzclbjboctptxaxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY2ZuemNsYmpib2N0cHR4YXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDgxODksImV4cCI6MjA4OTUyNDE4OX0.JXzVk5CDL6rxU5t_rl-Ku2YnPi0PeBF-VOpcSEZTbIM
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
