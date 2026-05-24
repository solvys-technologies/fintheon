# FINTHEON — Claude Code Project Rules

## Identity

- **Platform**: Fintheon by Priced In Capital (PIC) / Solvys Technologies
- **Stack**: React 19 + Vite frontend, Hono backend (port 8080), Supabase Postgres, Electron desktop
- **AI**: DeepSeek/Hermes provider chain
- **Palette**: BG #050402, Accent #c79f4a (Solvys Gold), Text #f0ead6

## Agent Roster

| Agent      | Role                                             |
| ---------- | ------------------------------------------------ |
| **Harper** | CAO — executive synthesis, full platform access  |
| **Oracle** | Prediction markets, probabilistic reasoning      |
| **Feucht** | Futures/risk, technical levels, execution        |
| **Consul** | Mega-cap fundamentals, earnings, sector rotation |
| **Herald** | Breaking news, social sentiment, headline risk   |

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

## Development Doctrine

- Work in small vertical slices with a direct validation path.
- Diagnose bugs by reproducing, minimizing, hypothesizing, instrumenting, fixing, and regression-testing.
- Separate I/O, validation, prompting, routing, and presentation. Do not collapse boundaries into one growing file.
- Treat approved GitHub stars and external references as architectural thinking sources only: patterns, vocabulary, constraints, failure modes, and review heuristics. Do not import external skills, dependencies, services, prompt text, or runtime code without TP approval.
- TP-vetoed S47 references must not influence architecture, prompts, code, or review language: `Xquik-dev/x-twitter-scraper`, `EveryInc/compound-engineering-plugin`, `jamiepine/voicebox`, `elder-plinius/CL4R1T4S`, `Bitterbot-AI/bitterbot-desktop`.

## Design Doctrine

- Solvys visual language is industrial-luxe: warm near-black canvas, Solvys Gold accent, warm off-white text, precise typography, and restrained motion.
- Prefer frosted-glass surfaces over Kanban/card-grid layouts when separation is needed: translucent warm dark fill, subtle backdrop blur, and thin low-opacity gold border.
- No gradients, emojis, AI sparkles, Kanban side-stripe borders, generic shadows, or copied upstream visual language.
- New UI briefs must review devl.dev for layout/component references and apply Jakub detail checks: text wrapping, concentric radii, tabular numbers, optical alignment, antialiasing, interruptible transitions, and contextual icon motion.
- Use charts, loaders, and motion only to clarify state or decision-making. Re-skin any inspiration to Solvys materials.

## Key Paths

- `frontend/` — React 19 + Vite + Tailwind
- `backend-hono/src/` — Hono routes + services
- `electron/` — main + preload
- `backend-hono/src/services/harper-handler.ts` — Harper chat handler
- `backend-hono/src/services/ai/agent-instructions/` — Agent system prompts
- `backend-hono/src/services/arbitrum/` — Arbitrum deliberation engine (5-seat chamber)
- `backend-hono/src/routes/` — All API routes
- `frontend/components/arbitrum/` — Arbitrum UI surfaces (ArbitrumChamber panel, hover peek)
- `src/lib/changelog.ts` — Changelog (add entry after every feature/fix)

## API Endpoints (Key)

- `POST /api/harper/chat` — Harper chat
- `GET /api/riskflow/feed` — Scored news feed
- `GET /api/riskflow/iv-aggregate` — IV score with VIX
- `POST /api/data/brief/generate` — Trigger brief (MDB/ADB/PMDB/TWT)
- `GET /api/data/brief/latest?type=X` — Fetch latest brief
- `GET /api/mcp` — MCP server config list
- `GET /api/miroshark/latest` — Latest ArbitrumChamber simulation (legacy; deprecated with MiroShark)
- `POST /api/arbitrum/deliberate` — Fire a chamber run
- `GET /api/arbitrum/latest` — Latest Arbitrum verdict
- `GET /api/arbitrum/verdicts/:id` — Specific verdict by id
- `GET /api/diagnostics` — Service health check

## Canonical Feature Names (locked 2026-04-24)

When TP directs an agent to "fix X," these are the authoritative names. Any internal identifier that doesn't match goes on the rename list.

| Canonical name                            | What it is                                                       | Internal locator                                               |
| ----------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| **Consilium**                             | Main workspace                                                   | `frontend/components/consilium/`                               |
| **Sanctum**                               | Timeline + ArbitrumChamber + NarrativeFlow composite             | `frontend/components/narrative/Sanctum.tsx`                    |
| **Forum**                                 | Team channel (Fluxer iframe)                                     | `frontend/components/consilium/FluxerEmbed.tsx`                |
| **Agentic Forum** (aka Agentic Boardroom) | DAG + agent-swarm runtime                                        | `backend-hono/src/services/boardroom-*` + DAG routes           |
| **Apparatus**                             | Where the agents live (agent registry)                           | `frontend/components/apparatus/`                               |
| **Strategium**                            | Right rail — mission control + RiskFlow feed + economic calendar | `frontend/components/MissionControl.tsx` + Strategium panels   |
| **Arbitrum**                              | 5-seat deliberation engine (replaces MiroShark)                  | `backend-hono/src/services/arbitrum/`                          |
| **ArbitrumChamber**                       | Surface label inside Sanctum for Arbitrum output                 | `frontend/components/narrative/Sanctum.tsx` (chart-mode panel) |
| **RiskFlow**                              | Scored news feed                                                 | `backend-hono/src/services/riskflow/`                          |
| **NarrativeFlow**                         | Catalyst cards promoted from RiskFlow                            | `frontend/components/narrative/NarrativeCanvas.tsx`            |
| **CAO chat**                              | Main chat feature (persona: Harper)                              | `/api/harper/chat` + frontend ChatInterface                    |
| **PsychAssist**                           | Trader tilt detector                                             | `backend-hono/src/services/psych-assist/`                      |
| **MDB / ADB / PMDB / TWT**                | Morning / Afternoon / Post-market / Weekly briefs                | `backend-hono/src/services/brief-generator.ts`                 |

**Legacy names (DO NOT use in new code):** Ask Harp → CAO chat, TOTT → TWT, News Worker → RiskFlow Worker, Econ Enricher → RiskFlow Econ Enricher, OpenClaw → Hermes, Pulse\* → Fintheon\*, MiroShark → Arbitrum.

## Terminology

- **MDB** = Morning Daily Brief (6:30 AM ET weekdays)
- **ADB** = Afternoon Daily Brief (10:45 AM ET)
- **PMDB** = Post-Market Daily Brief (5:15 PM ET)
- **TWT** = Tribune Weekly / Weekly Tribune (4:30 PM Sundays) — supersedes legacy TOTT
- **RiskFlow** = Scored news feed with IV-weighted urgency
- **NarrativeFlow** = Catalyst cards promoted from RiskFlow into narrative threads
- **ArbitrumChamber** = Surface label inside Sanctum for Arbitrum output (formerly MiroShark multi-agent simulation — **MiroShark deprecated 2026-04-24**, replaced by Arbitrum; see Arbitrum section below)
- **PsychAssist** = Trader tilt detection via ER scoring

## Arbitrum (deliberation engine, replaces MiroShark)

**What:** 5-seat Qwen3.5:397b-cloud debate via Hermes (Ollama Cloud). Output is a signal digest (consensus probability, confidence, dissent summary, digest text, IV simulation, upcoming catalysts). NO trade tickets, NO auto-actions — human makes the call.

**Seats:** all 5 seats run `qwen3.5:397b-cloud` via Ollama Cloud. Divergence comes from persona/role + temperature, not separate model IDs.

| Seat | Role         | Model              | Provider     | Weight | Persona voice       |
| ---- | ------------ | ------------------ | ------------ | ------ | ------------------- |
| 1    | Lead Analyst | qwen3.5:397b-cloud | Ollama Cloud | 30%    | Harper (CAO)        |
| 2    | Forecaster   | qwen3.5:397b-cloud | Ollama Cloud | 30%    | Oracle              |
| 3    | Risk Manager | qwen3.5:397b-cloud | Ollama Cloud | 20%    | Feucht              |
| 4    | Quantitative | qwen3.5:397b-cloud | Ollama Cloud | 10%    | Consul              |
| 5    | Bear Case    | qwen3.5:397b-cloud | Ollama Cloud | 10%    | Feucht alt / Herald |

**Cadence:** event-driven (scored_riskflow_items.iv_score ≥ 8.5 AND speaker is top-10 commentator OR party-of-interest) + session cron 17:00 ET weekdays (feeds into PMDB as "Chamber Read" section at 17:15).

**Routing:** Hermes-only, never OpenRouter. Harper-CAO keeps its existing Claude-Opus path for chat; Arbitrum seats route through Hermes → Ollama Cloud (qwen3.5:397b-cloud). DashScope removed 2026-04-26 (paid, no key); Groq retained as an explicit alternate provider but not currently mapped to any seat.

**Engine surface vs UI surface:** the engine is `services/arbitrum/`. The user sees output inside Sanctum's ArbitrumChamber surface and as a peek textbox in the IV scoring widget hover modal.

**Brand note:** yes, the name collides with Arbitrum the Ethereum L2. Disambiguate as "Fintheon Arbitrum" when needed.

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
