# Fintheon — Setup & Handoff Guide

> **For AI agents** (Harper-Hermes, Oracle, Feucht, Consul, Herald, Claude Code): Read this file when bootstrapping the repo on a new machine. Follow the steps in order. The first-run setup wizard will verify everything is connected.

## Prerequisites

- Node.js 20+
- npm or bun
- macOS (for Electron DMG builds)

## Installation

```bash
git clone https://github.com/solvys-technologies/fintheon.git
cd fintheon

# Install all dependencies (root + frontend + backend)
npm install && npm --prefix frontend install && npm --prefix backend-hono install
```

## Configuration

Copy the environment file:
```bash
cp backend-hono/.env.example backend-hono/.env
```

### Required Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `OPENROUTER_API_KEY` | `backend-hono/.env` | OpenRouter API key (Nous subscription — Claude Opus 4.6; also used for voice sentiment) |
| `OPENAI_API_KEY` | `backend-hono/.env` | **Voice Engine**: Whisper (transcription) + OpenAI TTS (synthesis). Required for voice features. |
| `NOTION_API_KEY` | `backend-hono/.env` | Notion integration token for trade ideas DB |
| `FMP_API_KEY` | `backend-hono/.env` | Financial Modeling Prep key (free at financialmodelingprep.com) |

Default inference is **Claude Opus 4.6** via OpenRouter. No other agent API keys (Anthropic, 21st, Exa, etc.) are required. **Do NOT ask users for PostgreSQL credentials or database URLs.**

## Voice Engine (OpenAI)

Voice features (mic input → transcription, TTS responses) use **OpenAI** only. Set `OPENAI_API_KEY` in `backend-hono/.env` (from [OpenAI API keys](https://platform.openai.com/api-keys)). Optional env vars: `OPENAI_TRANSCRIBE_MODEL` (default `whisper-1`), `OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`), `OPENAI_TTS_VOICE` (default `alloy`). Voice sentiment analysis uses OpenRouter (same `OPENROUTER_API_KEY`), not Anthropic.

## Hermes / OpenRouter (Opus 4.6)

Fintheon uses **OpenRouter** with your **Nous subscription** for all analyst chat. Set `OPENROUTER_API_KEY` in `backend-hono/.env` (get it from [OpenRouter](https://openrouter.ai/settings/keys)). The default model is **Claude Opus 4.6** (`anthropic/claude-opus-4.6`). Health checks run periodically; the Hermes status in **Settings → Hermes** shows connection state.

## Running

### Development
```bash
# Terminal 1: Backend
cd backend-hono && npm run dev    # Starts on port 8080

# Terminal 2: Frontend
cd frontend && npm run dev        # Starts on port 5173
```

### Production (Electron)
```bash
npm run desktop:build             # Builds DMG → desktop-dist/Fintheon-1.0.0.dmg
npm run release                   # Full release: frontend + backend + DMG + checksums
```

The Electron app auto-spawns the backend as a child process.

## Architecture

```
Electron App (main.cjs)
  ├── spawns: Backend (Hono, port 8080)
  │     ├── VIX polling (Yahoo Finance, 60s)
  │     ├── News feed poller (RSS + X)
  │     ├── Notion poller (trade ideas, 60s)
  │     └── Hermes → OpenRouter (Opus 4.6, Nous subscription)
  └── loads: Frontend (React 19 + Vite + Tailwind 4)
        └── connects to Backend at localhost:8080
```

## In-App Setup Guide

On first launch, Fintheon shows a **Setup Guide** card on the Dashboard with status indicators:

| Service | What It Checks |
|---------|----------------|
| Backend API | `GET /health` on port 8080 |
| Hermes / OpenRouter | OpenRouter API key + models endpoint |
| Notion Integration | Polls for trade ideas |
| Market Data (VIX) | Checks FMP API response |

Green = connected, yellow = connecting, red = not configured.

## Verification

```bash
# Backend running?
curl http://localhost:8080/health

# OpenRouter (Hermes) configured?
# Ensure OPENROUTER_API_KEY is set in backend-hono/.env

# Notion working?
# Check backend logs for: [Notion] Polling...

# VIX data flowing?
# Check IV score in toolbar (should show a number, not --)
```

## For AI Agents Onboarding Users

When helping a user set up Fintheon:
1. Install Node.js 20+ if not present
2. Clone and install deps (see Installation above)
3. **Get OpenRouter API key** — from OpenRouter (Nous subscription) at openrouter.ai/settings/keys; set `OPENROUTER_API_KEY` in `backend-hono/.env`
4. **Get OpenAI API key (Voice Engine)** — from platform.openai.com/api-keys; set `OPENAI_API_KEY` in `backend-hono/.env` for voice transcription and TTS
5. **Get Notion API key** — user creates integration at notion.so/my-integrations
6. **Get FMP API key** — free at financialmodelingprep.com
7. **Do NOT** ask for: PostgreSQL, database URLs; no Anthropic, 21st, or Exa keys
8. Start the app and use the in-app Setup Guide to verify connections
