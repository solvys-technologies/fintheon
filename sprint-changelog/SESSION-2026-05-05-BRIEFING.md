--- Briefing for Fintheon Agent Handoff ---
Generated: 2026-05-05T17:00-04:00
Project: Fintheon
Branch: v.05.04.00 (main: ahead +16, tag: v6.0.13)

## Identity

Fintheon is Priced In Capital's agentic trading platform. React 19 + Vite frontend, Hono backend (port 8080), Supabase Postgres, Electron desktop. Palette: BG #050402, Accent #c79f4a (Solvys Gold), Text #f0ead6.

## Stack

- Frontend: React 19 + Vite + Tailwind + TypeScript
- Backend: Hono (Bun), port 8080, Fly.io deployment
- Mobile: React 19 + Vite PWA, Vercel deployment
- Database: Supabase Postgres (`ilwzphjrbdllyoofukfc`)
- Desktop: Electron via launchd-managed `io.solvys.fintheon-backend`
- Scorer: Pass-through TS script (every 30s, `com.fintheon.claude-scorer`)

## Core Rules

- BANNED: gradients, emojis, AI sparkles, Kanban borders/side-stripes
- Glassmorphic > Kanban (frosted glass: translucent bg + backdrop-blur + thin accent border)
- Always `rm -rf dist` before vite build; never start vite dev server
- Always add changelog entry after every change (`src/lib/changelog.ts`)
- commit messages use conventional format (`fix:`, `feat:`, `INSTALL-UPDATE:`)
- Source files <300 lines; split on growth
- Bun binary at `/Users/tifos/.bun/bin/bun` — backend-hono dir broken for bun, use `npx tsc` there

## Key Paths

| Path                                         | Purpose                              |
| -------------------------------------------- | ------------------------------------ |
| `frontend/`                                  | React 19 + Vite desktop frontend     |
| `mobile/`                                    | React 19 + Vite PWA                  |
| `backend-hono/src/routes/`                   | Hono API routes                      |
| `backend-hono/src/services/`                 | Business logic, agent services       |
| `backend-hono/src/services/riskflow/`        | Feed service, scorer, source-policy  |
| `backend-hono/src/workers/riskflow-worker/`  | X collector, persist, sources        |
| `backend-hono/src/services/strands/`         | Agent factory, Harper agent          |
| `electron/main.cjs`                          | Electron main (SOTA manual updater)  |
| `scripts/fintheon-update.sh`                 | CLI update (pulls tag + DMG install) |
| `scripts/fintheon-install-update.sh`         | In-app one-click DMG updater         |
| `supabase/migrations/`                       | DB schema                            |
| `src/lib/changelog.ts`                       | Changelog (add entry after changes)  |
| `sprint-md/`                                 | In-flight sprint briefs              |
| `sprint-changelog/`                          | Archived sprint plans                |

## Agent Roster

| Agent   | Role                                          | Notes                        |
| ------- | --------------------------------------------- | ---------------------------- |
| Harper  | CAO — executive synthesis, chat               | `/api/harper/chat`           |
| Oracle  | Prediction markets, probabilistic reasoning   |                              |
| Feucht  | Futures/risk, technical levels                |                              |
| Consul  | Mega-cap fundamentals, earnings               |                              |
| Herald  | Breaking news, social sentiment               |                              |

## Recent Changes (Last 15 Commits)

| Hash      | Summary                                                                              | Files |
| --------- | ------------------------------------------------------------------------------------ | ----- |
| 87072286  | feat: pass-through scorer (scores raw→scored every 30s). Fix normalizeSource. | 1     |
| d63b2923  | fix: normalizeSource handles twitter: sources by extracting handle                   | 1     |
| 69662bb8  | fix: watchlist type fixes, add X handles to default watchlist, 15s cache merge       | 3     |
| 9b32722e  | debug: add collection output log                                                     | 1     |
| b16b0051  | fix: browser timeline primary (home→click Following, no login). API fallback         | 2     |
| b1c0777d  | fix: syndication fetch-first, XActions fallback                                      | 1     |
| 745ff98f  | fix: XActions primary, syndication fallback. Add image/video extraction              | 2     |
| bfe22654  | fix: kill browser timeline scraper — API is now primary. Fix duplicate tweet push    | 5     |
| 47836e10  | fix: when browser timeline empty, fall back to per-handle syndication+XActions       | 1     |
| 7faa96be  | fix: source-policy loads from DB + X Following tab direct nav + 15s cache            | 2     |
| 3cbbd786  | feat: wire per-user BYOK API keys into chat inference                                | 4     |
| 1bc2ff7e  | fix: X browser collector timeout                                                     | 1     |
| 915c7590  | fix: filter local-user from ai-keys auth + Strategium border-y removed               | 5     |
| 291308f6  | v6.0.13 deploy — RETTIWT removal + Strategium mirror + DMG fallback                  | 5     |
| b5a52da0  | fix: remove RETTIWT from API settings + mirror Strategium layering                   | 2     |

## What Changed and Why

**RiskFlow restoration (core battle)**: X feed was dead — zero tweets for weeks. Root cause: browser login automation was destroying auth cookies (clearing cookies every cycle, then failing to re-authenticate), while a duplicate tweet push corrupted the persist pipeline. Fix: killed login automation entirely (use injected cookies only), navigate to x.com/home → click Following tab → scrape 47 tweets/cycle → persist → auto-score. The source-policy now loads approved handles from `riskflow_source_accounts` DB table (managed by Refinement UI). Default watchlist includes all 9 X handles.

**Feed normalization**: X items stored with `twitter:handle` source needed `normalizeSource` to extract handles and map them to display categories (FinancialJuice, OSINTSources, Commentary). Without this, all X items showed as "Untrusted".

**Pass-through scorer**: Original Claude CLI scorer dead since April 25 (org blocked Claude subscriptions). Replaced with `scripts/riskflow-scorer.ts` — reads raw items from DB every 30s, upserts to scored table with default sentiment/IV. Runs via launchd `com.fintheon.claude-scorer`.

**API key wiring**: `user_api_keys` table stored per-user BYOK but chat never used them. Added `getUserApiKey()` → decrypts key from DB → threaded through Harper agent → `createDeepSeekDirectModel(apiKey)`. Both deepseek and opencode-go providers supported.

**DMG deploy fix**: Deploy skill never built/uploaded DMG — every user got "Release DMG download failed". Added DMG build+upload step to deploy skill. In-app updater now has build fallback when `gh` download fails.

## Open Issues

1. **X auth cookies must be valid** — login automation is disabled. If cookies expire, X collection stops. Rotate `X_AUTH_TOKEN` and `X_CT0_TOKEN` in `.env` manually.
2. **XActions API not configured** — `XACTIONS_API_BASE` not set in `.env`. If set, would provide Twitter API fallback.
3. **`authedUserId` rejects "local-user"** — API key saves fail on Electron desktop (BYPASS_AUTH=true). Only works with real Supabase JWT.
4. **`stocks-to-screen.csv` accidentally committed then removed** — check git history.
5. **Supabase migration history desynced** — remote has 20260503 applied but local migration file deleted. Use `supabase migration repair` if changing schema.
6. **Bun binary broken for backend-hono directory** — `bun run build` fails with "CouldntReadCurrentDirectory". Use `npx tsc && node scripts/copy-assets.mjs` instead.

## Available Commands

| Command               | Purpose                                      |
| --------------------- | -------------------------------------------- |
| `/solvys-deploy`      | Full 3-target production deploy              |
| `/solvys-beta`        | Local DMG build + install                    |
| `/solvys-inform`      | This briefing generator                      |
| `/solvys-audit`       | Pre-ship verification + security scan        |
| `/solvys-feels`       | Visual architecture + design system          |
| `/solvys-diagnose`    | Bug/regression diagnosis                     |
| `/solvys-test`        | Sprint feature verification (CLI + Playwright) |
| `/quickscope`         | Chart screenshot analysis + trade proposal   |
| `/install-maintenance` | Post-ship installation audit                 |

## Build and Deploy

```bash
# Backend build (NOT bun)
cd backend-hono && npx tsc && node scripts/copy-assets.mjs

# Backend deploy
cd backend-hono && fly deploy --yes

# Frontend deploy
cd frontend && rm -rf dist && npx vite build && vercel build --prod && vercel deploy --prebuilt --prod

# Mobile deploy
cd mobile && rm -rf dist && npx vite build && vercel build --prod && vercel deploy --prebuilt --prod

# DMG build
bun run desktop:build

# Restart local services
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist ~/Library/LaunchAgents/io.solvys.fintheon-riskflow-worker.plist
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist ~/Library/LaunchAgents/io.solvys.fintheon-riskflow-worker.plist
```

## Environment Variables

Required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`
Optional: `X_AUTH_TOKEN`, `X_CT0_TOKEN` (X browser auth), `XACTIONS_API_BASE` (Twitter API fallback), `BYPASS_AUTH` (local dev), `FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW` (must be true for persist)

## How to Work Here

- Always `rm -rf dist` before vite build; never start a vite dev server
- Add `// [claude-code YYYY-MM-DD]` comment at top of substantially modified files
- Add changelog entry after every change: `{ date, agent, summary, files }`
- Conventional commits preferred; `INSTALL-UPDATE:` prefix for installer script changes
- File size: <300 lines; split on growth. Named exports preferred.

## Architectural Guidance

- Small vertical slices with direct validation paths
- Zod validation at system boundaries
- Every service must work when its env var is missing (in-memory fallback, degraded mode)
- Separate I/O, validation, prompting, routing, and presentation
- Solvys visual language: industrial-luxe — warm near-black canvas, gold accent, frosted glass surfaces
- TP-vetoed references (do NOT use): `Xquik-dev/x-twitter-scraper`, `EveryInc/compound-engineering-plugin`, `jamiepine/voicebox`, `elder-plinius/CL4R1T4S`, `Bitterbot-AI/bitterbot-desktop`

---

End Briefing ---
