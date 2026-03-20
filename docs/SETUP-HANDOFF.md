# Pulse Setup Handoff — LLM Agent Guide

This document is for any LLM agent (Claude Code, Cursor, OpenClaw, Codex) setting up or deploying Pulse. Read this to understand all backend dependencies, startup sequence, and deployment steps.

## Repository Structure

```
/Users/tifos/Desktop/Codebases/pulse/
  backend-hono/     — Hono API server (Node.js, TypeScript)
  frontend/         — React 19 + Tailwind 4 + Vite
  electron/         — Electron main process (main.cjs)
  docs/             — Documentation
  desktop-dist/     — Build output (DMG)
```

## Backend Dependencies

### Required Services

1. **Node.js 20+** — Runtime for backend
2. **Bun** — Package manager (used instead of npm for installs)
3. **PostgreSQL** (optional) — If `DATABASE_URL` is set, used for journal, feed items, etc. Falls back to in-memory storage if unavailable.

### Required Environment Variables (`backend-hono/.env`)

```bash
# Core — OpenRouter (Nous subscription) = Claude Opus 4.6; also used for voice sentiment
OPENROUTER_API_KEY=<key>                   # OpenRouter API key (get at openrouter.ai/settings/keys)
NOTION_API_KEY=<key>                       # Notion integration token

# Voice Engine — transcription (Whisper) + TTS; required for voice features
OPENAI_API_KEY=<key>                       # OpenAI API key (platform.openai.com/api-keys)

# Optional but recommended
DATABASE_URL=postgresql://...              # PostgreSQL
FMP_API_KEY=<key>                          # Financial Modeling Prep
GITHUB_CLIENT_ID=<id>                      # GitHub OAuth
GITHUB_CLIENT_SECRET=<secret>              # GitHub OAuth
```

No other agent API keys (Anthropic, 21st, Exa) are required. Voice sentiment uses OpenRouter.

### External CLI Tools

- **twitter-cli** (`~/.local/bin/twitter`) — Python CLI for X/Twitter search. Install: `pip install twitter-cli && twitter login`

## Startup Sequence

The backend starts these services in order (see `backend-hono/src/index.ts`):

1. **Hono server** on port 8080 (configurable via `PORT` env)
2. **Feed poller** — polls RSS feeds for RiskFlow items
3. **Notion poller** — polls Notion DBs every 60s for trade ideas + P&L
4. **Econ enricher** — enriches economic events with FMP actuals (nightly + intraday during market hours)
5. **Econ Twitter poller** — polls X for economic print reactions
6. **Claude SDK bridge** — health check for AI services (non-blocking)

### Electron Auto-Start

When the Electron app launches (`electron/main.cjs`), it automatically:
1. Checks for `backend-hono/dist/index.js`
2. Spawns `node dist/index.js` as a child process
3. Kills the backend on app quit

For this to work, the backend must be built first:
```bash
cd backend-hono && npx tsc && cd ..
```

## Build and Deploy

### Full Build (Frontend + DMG)

```bash
cd /Users/tifos/Desktop/Codebases/pulse
npm run desktop:build    # tsc + vite build + electron-builder --mac dmg
cp desktop-dist/Pulse-1.0.0.dmg ~/Desktop/Pulse-1.0.0.dmg
```

### Backend Only

```bash
cd backend-hono
npx tsc              # Compile TypeScript
npm run dev           # Dev mode with watch
```

### Frontend Only

```bash
npx vite build        # Production build (from repo root)
npx vite dev          # Dev server with HMR
```

### Type Checking

```bash
# Frontend
npx vite build                    # Catches all frontend issues

# Backend
cd backend-hono && npx tsc --noEmit   # Type check only
```

## API Routes Overview

| Route | Auth | Description |
|-------|------|-------------|
| `GET /api/market-data/iv-score` | No | Blended IV score (60% VIX + 40% headlines) |
| `GET /api/riskflow/feed` | Yes* | RiskFlow feed items |
| `GET /api/riskflow/sources` | Yes* | Source connection status (Notion, X) |
| `GET /api/notion/trade-ideas` | No | Notion trade ideas |
| `GET /api/notion/ntn-brief` | No | AI-generated daily brief |
| `GET /api/notion/schedule` | No | Economic calendar events |
| `GET /api/journal/entries` | No | Trading journal entries |
| `GET /api/journal/summary` | No | Journal summary stats |
| `GET /api/regimes` | No | Active trading regimes |
| `GET /api/market-data/quotes` | No | Market quotes via FMP |

*RiskFlow routes skip auth for cron endpoints.

## Key Notion Databases

| Database | ID | Purpose |
|----------|----|---------|
| Trade Ideas | `136fa9a2069e4afc835e0e139ead49f2` | Agent/human trade proposals |
| Daily P&L | `ee7d03052a424dcb95f6406c166e7584` | Daily performance tracking |

## Common Issues

- **DMG build fails with hdiutil error**: A previous DMG volume is mounted. Run `hdiutil detach "/Volumes/Pulse 1.0.0" -force`
- **Code signing warning**: Expected — no Developer ID cert. Ignore.
- **Backend dist not found on Electron launch**: Run `cd backend-hono && npx tsc` first
- **Notion status shows disconnected**: Backend may not be running. Check `http://localhost:8080/health`
- **X CLI not found**: Install with `pip install twitter-cli`, ensure `~/.local/bin` is in PATH or set `TWITTER_CLI_PATH` env var

## Commit Convention

```
feat(scope): description        # New features
fix(scope): description         # Bug fixes
chore(scope): description       # Maintenance

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Always run `npx vite build` after changes (not just `tsc`).
