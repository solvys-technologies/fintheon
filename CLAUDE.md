# FINTHEON — Claude Code Project Rules

## Identity

- **Platform**: Fintheon by Priced In Capital (PIC) / Solvys Technologies
- **Stack**: React 19 + Vite frontend, Hono backend (port 8080), Supabase Postgres, Electron desktop
- **AI**: Claude Opus 4.6 via VProxy gateway (localhost:8317)
- **Palette**: BG #050402, Accent #c79f4a (Solvys Gold), Text #f0ead6

## Agent Roster

| Agent           | Role                                             |
| --------------- | ------------------------------------------------ |
| **Harper-Opus** | CAO — executive synthesis, full platform access  |
| **Oracle**      | Prediction markets, probabilistic reasoning      |
| **Feucht**      | Futures/risk, technical levels, execution        |
| **Consul**      | Mega-cap fundamentals, earnings, sector rotation |
| **Herald**      | Breaking news, social sentiment, headline risk   |

Protocol: "Harper orchestrates, Oracle analyzes, Feucht guards, Consul validates, Herald communicates"

## Build & Deploy

- **Backend build**: `cd backend-hono && bun run build` (not just tsc)
- **Backend is launchd-managed**: `io.solvys.fintheon-backend` — must `launchctl unload` before restart
- **Frontend type-check**: `npx tsc --noEmit --project frontend/tsconfig.json`
- **Never bypass auth** (Supabase JWT enforced)
- **Required env var**: `OPENROUTER_API_KEY` — everything else has fallbacks

## File Rules

- All source files must be under 300 lines. Split on growth.
- Each file serves one purpose. Separate concerns: I/O, prompting, validation in distinct modules.
- Use functional, declarative patterns. Avoid classes.
- Use TypeScript strict mode. Prefer interfaces over types. Avoid enums; use maps.
- Use descriptive variable names with auxiliary verbs (isLoading, hasError).
- Lowercase with dashes for directories (e.g., `components/auth-wizard`).
- Favor named exports.

## Error Handling

- Handle errors at the beginning of functions with early returns.
- Place the happy path last.
- Use guard clauses for preconditions.
- Use Zod for runtime validation at system boundaries.
- Every service must work when its env var is missing (in-memory fallback, bypass auth, degraded AI).

## Key Paths

- `frontend/` — React 19 + Vite + Tailwind
- `backend-hono/src/` — Hono routes + services
- `electron/` — main + preload
- `backend-hono/src/services/harper-handler.ts` — Harper chat handler
- `backend-hono/src/services/ai/agent-instructions/` — Agent system prompts
- `backend-hono/src/routes/` — All API routes
- `src/lib/changelog.ts` — Changelog (add entry after every feature/fix)

## API Endpoints (Key)

- `POST /api/harper/chat` — Harper-Opus chat
- `GET /api/riskflow/feed` — Scored news feed
- `GET /api/riskflow/iv-aggregate` — IV score with VIX
- `POST /api/data/brief/generate` — Trigger brief (MDB/ADB/PMDB/TOTT)
- `GET /api/data/brief/latest?type=X` — Fetch latest brief
- `GET /api/mcp` — MCP server config list
- `GET /api/miroshark/latest` — Latest Aquarium simulation
- `GET /api/diagnostics` — Service health check

## Terminology

- **MDB** = Morning Daily Brief (6:30 AM ET weekdays)
- **ADB** = Afternoon Daily Brief (10:45 AM ET)
- **PMDB** = Post-Market Daily Brief (5:15 PM ET)
- **TOTT** = Tip of the Tape / Weekly Tribune (4:30 PM Sundays)
- **RiskFlow** = Scored news feed with IV-weighted urgency
- **NarrativeFlow** = Catalyst cards promoted from RiskFlow into narrative threads
- **Aquarium** = MiroShark multi-agent simulation
- **PsychAssist** = Trader tilt detection via ER scoring

## Platform Sections

- **Consilium** = Main workspace: Sanctum (narratives), Chat (Harper), Boardroom (team), Apparatus (tools)
- **Strategium** = Right panel: mission control, RiskFlow feed, economic calendar

## Changelog

After every feature or fix, add an entry to `src/lib/changelog.ts` with date, agent, summary, and files changed.

## Post-Ship

After every deploy, run `/install-maintenance` to audit setup/update scripts for env var drift and dependency sync.

## Custom Commands

Available via `/command-name`:

- `/quickscope` — Chart screenshot analysis + trade proposal
- `/macroscope-review` — PR review triage of Macroscope bot comments
- `/install-maintenance` — Post-ship installation audit
