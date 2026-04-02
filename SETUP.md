# Fintheon — Setup & Handoff Guide

> **For AI agents** (Harper-Hermes, Oracle, Feucht, Consul, Herald, Claude Code, Perplexity Computer): Read this file when bootstrapping the repo on a new machine. Follow the steps in order.

## Automated Setup (Recommended)

For users — one command handles everything:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh)"
```

For subsequent updates:

```bash
fintheon update
```

The automated setup installs Xcode CLI Tools, Homebrew, Node.js, Bun, clones the repo, writes `.env` with production defaults, installs Hermes, builds everything, and launches the app.

---

## Manual Setup (For Agents / Advanced Users)

### Prerequisites

- Node.js 20+ (`brew install node@22`)
- Bun (`curl -fsSL https://bun.sh/install | bash`)
- macOS (for Electron DMG builds)

### Installation

```bash
git clone https://github.com/solvys-technologies/fintheon.git
cd fintheon
bun install
cd backend-hono && bun install && cd ..
```

### Configuration

Copy the environment file:
```bash
cp backend-hono/.env.example backend-hono/.env
```

The `.env.example` ships with production-safe defaults including Supabase connection. The ONLY variable a user needs to add is `OPENROUTER_API_KEY` for AI features.

### Required Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `OPENROUTER_API_KEY` | `backend-hono/.env` | OpenRouter API key — get at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) |

### Pre-Configured (DO NOT prompt users for these)

These are embedded in `.env.example` with production defaults:

| Variable | Value | Why |
|----------|-------|-----|
| `SUPABASE_URL` | `https://nrcfnzclbjboctptxaxx.supabase.co` | Production Supabase project |
| `SUPABASE_ANON_KEY` | Pre-filled | Publishable anon key (safe for client-side) |
| `BYPASS_AUTH` | `true` | Local/Electron auth bypass |
| `PORT` | `8080` | Backend port |
| `AI_PRIMARY_PROVIDER` | `openrouter` | Default inference provider |
| All scheduling vars | Pre-filled | Boardroom, pre/post market crons |

### NEVER ask users for these — the app works without them:
- `DATABASE_URL` / `NEON_DATABASE_URL` — app uses in-memory fallback automatically
- `SUPABASE_SERVICE_ROLE_KEY` — only for production multi-user auth
- `NOTION_API_KEY` — legacy, migrating away
- `EXA_API_KEY`, `FRED_API_KEY`, `FIRECRAWL_API_KEY` — optional research APIs

### Optional Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `OPENAI_API_KEY` | `backend-hono/.env` | Voice features only (Whisper + TTS) |

---

## Voice Engine (OpenAI)

Voice features (mic input, transcription, TTS responses) use OpenAI. Set `OPENAI_API_KEY` in `backend-hono/.env`. Optional env vars: `OPENAI_TRANSCRIBE_MODEL` (default `whisper-1`), `OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`), `OPENAI_TTS_VOICE` (default `alloy`). Voice sentiment analysis routes through OpenRouter.

## Hermes / OpenRouter

Fintheon uses OpenRouter for all analyst chat. The default model is Claude Opus 4.6 (`anthropic/claude-opus-4.6`). Health checks run periodically; the Hermes status in Settings shows connection state. Hermes config lives at `~/.hermes/config/default.json`.

---

## Running

### Development
```bash
# Terminal 1: Backend
cd backend-hono && bun run dev     # Starts on port 8080

# Terminal 2: Frontend
cd frontend && bun run dev         # Starts on port 5173
```

### Production (Electron)
```bash
bun run release                    # Full release: frontend + backend + DMG
```

The Electron app auto-spawns the backend as a child process.

---

## Architecture

```
Electron App (main.cjs)
  ├── spawns: Backend (Hono, port 8080)
  │     ├── VIX polling (Yahoo Finance, 60s)
  │     ├── News feed poller (RSS + X)
  │     ├── Notion poller (trade ideas, 60s)
  │     └── Hermes → OpenRouter (Opus 4.6)
  └── loads: Frontend (React 19 + Vite + Tailwind 4)
        └── connects to Backend at localhost:8080
```

## Fintheon CLI

The setup script installs a global `fintheon` command:

```bash
fintheon update     # Pull latest, rebuild, restart
fintheon start      # Start backend + launch app
fintheon stop       # Stop everything
fintheon status     # Check if services are running
fintheon logs       # Tail backend logs
fintheon setup      # Re-run first-time setup
fintheon version    # Show current version
```

The CLI is installed to `/usr/local/bin/fintheon` (or `~/.local/bin/fintheon` if `/usr/local/bin` is not writable).

---

## For AI Agents Onboarding Users

When helping a user set up Fintheon:
1. Direct them to the one-line install command above
2. The only thing they may need to provide after setup is `OPENROUTER_API_KEY`
3. Everything else is pre-configured

**CRITICAL — DO NOT ask users for:**
- PostgreSQL / Neon database URLs
- Supabase service role keys
- Notion API keys
- Any API key other than OpenRouter (and only if they want AI features)

---

## In-App Setup Guide

On first launch, Fintheon shows a Setup Guide card on the Dashboard:

| Service | What It Checks |
|---------|----------------|
| Backend API | `GET /health` on port 8080 |
| Hermes / OpenRouter | OpenRouter API key + models endpoint |
| Notion Integration | Polls for trade ideas |
| Market Data (VIX) | Checks FMP API response |

Green = connected, yellow = connecting, red = not configured.

---

## Updating Installation Scripts

When developing new features that add dependencies, env vars, or services, update these files:

1. `scripts/fintheon-setup.sh` — Add new deps to the install step, new env vars to the .env template
2. `scripts/fintheon-update.sh` — Ensure new deps are installed, new env vars are backfilled
3. `scripts/install-cli.sh` — Add new CLI commands if needed
4. `backend-hono/.env.example` — Add new env vars with defaults
5. `README.md` — Document any new user-facing changes

The update script (`fintheon update`) automatically installs new dependencies and backfills missing env vars, so users never see errors after an update.
