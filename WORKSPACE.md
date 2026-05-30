# Fintheon Workspace — Agent Context File

> **Last updated**: 2026-05-30 by codex (sprint numbering correction)
> This file is the source of truth for any agent on any device picking up this repo.

## What is Fintheon?

Fintheon is a trading intelligence platform built by **Priced In Capital (PIC)**. It provides real-time market analysis, narrative mapping, economic intelligence, and automated trade proposals through a multi-agent system.

## Quick Start (New Device Setup)

### 1. Prerequisites

- **Node.js** >= 20 (recommended 24 LTS)
- **Bun** >= 1.3 (package manager: `bun` is required, not npm)
- **Git** configured with SSH access to `solvys-technologies/fintheon`
- **Supabase** project connected (env vars in `backend-hono/.env`)

### 2. Install

```bash
git clone git@github.com:solvys-technologies/fintheon.git
cd fintheon
bun install
cd backend-hono && bun install && cd ..
```

### 3. Environment Variables

Copy `.env.example` to `.env` in both root and `backend-hono/`:

- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` — database
- `VITE_API_URL=http://localhost:8080` — backend URL
- `OPENCLAW_GATEWAY_URL` / `OPENCLAW_API_KEY` — agent gateway
- `VITE_CLERK_PUBLISHABLE_KEY` — auth (or `VITE_BYPASS_AUTH=true` for dev)

### 4. Run

```bash
# Backend (port 8080)
cd backend-hono && bun run dev

# Frontend (port 7777)
bun run dev

# Or build DMG
npm run desktop:build
```

### 5. Update (existing install)

```bash
./scripts/fintheon-update.sh
# Password-protected. Closes app, pulls, installs deps, builds.
```

## Architecture

### Frontend (Vite + React 19 + Tailwind)

- **Sanctum** — Main hub with dropdown: NarrativeFlow (default), ArbitrumChamber, Timeline
- **NarrativeFlow** — D3 force-directed mind map of market events with rope connections
- **ArbitrumChamber** (_shark tank_) — TradingView chart + prediction cards + KPIs + briefing
- **RiskFlow** — Live news feed with infinite scroll, scored by Claude CLI
- **Dashboard** — KPIs, session calendar, account tracker, proposals

### Backend (Hono on Bun, port 8080)

- `/api/predictions/outlook` — Forward-looking instrument predictions
- `/api/mirofish/*` — Simulation engine (context → simulation → report → briefing)
- `/api/data/econ-*` — Economic calendar, prints, history
- `/api/riskflow/*` — News feed, scoring, commentator registry
- `/api/proposals/*` — Trade proposals lifecycle
- `/api/boardroom/*` — Agent scorecards

### Database (Supabase/Postgres)

Key tables: `scored_riskflow_items`, `raw_riskflow_items`, `econ_events`, `econ_prints`, `trading_proposals`, `trade_runs`, `agent_scorecards`, `commentator_registry`, `briefs`

### Scheduled Tasks (launchd on macOS)

- **Claude CLI Scorer** — Polls raw items, scores via Sonnet, writes to scored table (every 2min)
- **Brief Dispatch** — Generates MDB/ADB/PMDB/TOTT briefs via Opus (scheduled per brief type)

## Claude CLI Setup (Required for Agents)

```bash
# Install Claude CLI (uses Anthropic subscription, zero API cost)
npm i -g @anthropic-ai/claude-code

# Scorer (runs continuously)
bun run backend-hono/scripts/claude-scorer.ts

# Brief dispatch (one-shot)
bun run backend-hono/scripts/dispatch-brief.ts -- --type MDB
```

## Hermes Agent Setup

Hermes is the primary AI agent on the device. To enable:

1. Set `HERMES_ENABLED=true` in frontend `.env`
2. Configure Grok 4.20 fast as primary model in Settings → Agent Config
3. Backend must be running for Hermes to access data APIs

### Source of Truth Integration

Agents follow the **PIC Source of Truth** — a neural web architecture where shared beliefs + per-agent philosophy blocks shape how each agent thinks. Located in:

- `backend-hono/src/services/ai/agent-instructions/` — modular prompt architecture
- `knowledge-base/source-of-truth/` — canonical knowledge base (5 files)
- **14 Commandments** in `commandments-data.ts` — hard/soft/guidance block levels
- **Risk Manager** — PDPT $1,550, 120s blackout, 11:30 AM circuit breaker
- **PsychAssist** — tilt detector + lockout protocol (soft→hard escalation)

When adding new agents, follow the modular architecture: new agents get a philosophy block in `philosophy-blocks.ts` and inherit shared beliefs automatically.

## Branching Convention

Format: `v.{MONTH}.{DATE}.{PATCH}`

- Current correction branch: `v7.0.9-security-infra`
- Always commit with the current package/release version tag, for example `[v7.0.9] feat(scope): description` on this branch.

## Sprint Numbering

- Read `sprint-md/SPRINT-NUMBERING.md` before creating or renumbering sprint files.
- The active sprint lane currently resumes from S83: S84 is App Store Review Readiness + iOS Developer Enrollment, and S85 is Infisical Secrets + Portless Desktop Infra.
- S100+ is a post-beta/deferred milestone lane, not the active sprint chronology. Do not choose the next sprint by taking the highest numeric `S{N}` file.
- The accidental S120/S121 jump was corrected to S84/S85 on 2026-05-30.

## Agent Coordination

- **Codi** — Development & Engineering (this agent in Claude Code)
- **Harper** — Chief Agent Officer (OpenClaw, strategy)
- **Sentinel** — Risk monitoring
- **Oracle** — Market prediction
- **Feucht** — Execution
- **Charles** — Research
- **Horace** — Historical analysis

Check `CLAUDE.md` for global rules. Check `MEMORY.md` for session context.

## Solvys Gold Palette (mandatory for all UI)

- Background: `#050402`
- Accent: `#c79f4a`
- Text: `#f0ead6`
- No gradients, no colored emojis, no kanban borders.
