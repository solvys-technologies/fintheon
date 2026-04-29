# CLAUDE.md — Combined Global + Fintheon Project Rules

> Merged from `~/.claude/CLAUDE.md` (global) + `~/Documents/Codebases/fintheon/CLAUDE.md` (workspace) on 2026-04-26.
> Drop this file at the user's `~/.claude/CLAUDE.md` AND keep a copy at the repo root as `CLAUDE.md`. Workspace rules win on conflict.

---

## Identity

You work for **Priced In Capital (PIC)** / **Solvys Technologies** — an agentic hedge fund run by **TP** (Chief).

You are one of several agents in the PIC ecosystem. Others include **Harper** (CAO), **Oracle**, **Feucht**, **Consul**, **Herald**, **Sentinel**, **Charles**, and **Horace**. These are agent personas, not humans. When you see those names in code or docs, treat them as personas.

Protocol: **"Harper orchestrates, Oracle analyzes, Feucht guards, Consul validates, Herald communicates."**

| Agent          | Role                                             |
| -------------- | ------------------------------------------------ |
| **Harper** | CAO — executive synthesis, full platform access  |
| **Oracle**     | Prediction markets, probabilistic reasoning      |
| **Feucht**     | Futures/risk, technical levels, execution        |
| **Consul**     | Mega-cap fundamentals, earnings, sector rotation |
| **Herald**     | Breaking news, social sentiment, headline risk   |

TP communicates via iMessage (+13053479816) and CSpace webchat. Harper coordinates agent work. If you see a task that overlaps with another agent's work, check the changelog and `~/.openclaw/workspace/memory/` for context before proceeding.

---

## Platform

- **Stack**: React 19 + Vite frontend, Hono backend (port 8080), Supabase Postgres, Electron desktop
- **AI**: Claude Opus 4.6 via VProxy gateway (localhost:8317); Hermes for sub-agent routing; Ollama Cloud for Arbitrum seats
- **Palette (Solvys Gold)**: BG `#050402`, Accent `#c79f4a` (gold), Text `#f0ead6`

### Canonical Feature Names (locked 2026-04-24)

| Canonical name                | What it is                                              | Internal locator                                     |
| ----------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| **Consilium**                 | Main workspace                                          | `frontend/components/consilium/`                     |
| **Sanctum**                   | Timeline + Aquarium + NarrativeFlow composite           | `frontend/components/narrative/Sanctum.tsx`          |
| **Forum**                     | Team channel (Fluxer iframe)                            | `frontend/components/consilium/FluxerEmbed.tsx`      |
| **Agentic Forum** (Boardroom) | DAG + agent-swarm runtime                               | `backend-hono/src/services/boardroom-*` + DAG routes |
| **Apparatus**                 | Where the agents live (registry)                        | `frontend/components/apparatus/`                     |
| **Strategium**                | Right rail — mission control + RiskFlow + econ calendar | `frontend/components/MissionControl.tsx`             |
| **Arbitrum**                  | 5-seat deliberation engine (replaces MiroShark)         | `backend-hono/src/services/arbitrum/`                |
| **Aquarium**                  | Surface label inside Sanctum for Arbitrum output        | `frontend/components/narrative/Sanctum.tsx`          |
| **RiskFlow**                  | Scored news feed                                        | `backend-hono/src/services/riskflow/`                |
| **NarrativeFlow**             | Catalyst cards promoted from RiskFlow                   | `frontend/components/narrative/NarrativeCanvas.tsx`  |
| **CAO chat**                  | Main chat (Harper persona)                              | `/api/harper/chat` + frontend ChatInterface          |
| **PsychAssist**               | Trader tilt detector                                    | `backend-hono/src/services/psych-assist/`            |
| **MDB / ADB / PMDB / TWT**    | Morning / Afternoon / Post-market / Weekly briefs       | `backend-hono/src/services/brief-generator.ts`       |

**Legacy (DO NOT use in new code):** Ask Harp → CAO chat, TOTT → TWT, News Worker → RiskFlow Worker, OpenClaw → Hermes, Pulse* → Fintheon*, MiroShark → Arbitrum.

---

## Core Rules (Non-Negotiable)

- **BANNED ornaments** (no exceptions): no Kanban borders, no gradients, no AI sparkles, no emojis. Not in UI, not in prose, not in push copy, not anywhere. "AI sparkles" includes ✨, 🪄, shimmer effects, animated gradient text, and any decorative glyph meant to signal "AI did this." Emojis includes the colored Unicode set AND the monochrome ones.
- **Glassmorphic before Kanban.** TP hates Kanban. Default to frosted-glass surfaces (translucent bg + backdrop-blur + thin accent border) for any card, panel, sheet, or list item. (Note: project rules elsewhere ban `backdrop-blur` outright — when in conflict, use **flat surfaces + accent borders**, never the gray-card grid.)
- **Solvys Gold palette** for personal branding: BG `#050402`, Accent `#c79f4a`, Text `#f0ead6`.
- **Always run the full build** (`bun run build` / `vite build`) after changes — not just `tsc`.
- **Never start a vite dev server** — verify via `tsc --noEmit` + build only. Fintheon runs in production.
- **Always `rm -rf dist` before vite build** (stale bundle prevention) — especially mobile.
- **Never bypass auth** (Supabase JWT enforced).
- **Required env var**: `OPENROUTER_API_KEY` — everything else has fallbacks.
- **Check `src/lib/changelog.ts` before modifying files** — recent entries are intentional code.
- **No paid services without TP signoff.** Default to free + on-stack: TradingView, FinancialDatasets MCP, Exa, browser-harness, Ollama Cloud free models. **OpenRouter + DashScope + FMP banned (2026-04-26).**

---

## Build, Deploy, Restart

- **Backend build**: `cd backend-hono && bun run build` (not just tsc)
- **Backend is launchd-managed**: `io.solvys.fintheon-backend` — must `launchctl unload` before restart
- **Local backend reads from Desktop checkout**: `~/Desktop/Codebases/fintheon` (NOT Documents). New routes 404 on localhost until TP syncs Desktop.
- **Frontend type-check**: `npx tsc --noEmit --project frontend/tsconfig.json`
- **Fly.io app**: `fintheon` (fintheon.fly.dev) — deploy from `backend-hono/`, NEVER repo root, NEVER to `pulse-api`.
- **Desktop frontend**: Vercel prebuilt from `frontend/`.
- **Mobile PWA**: Vercel prebuilt from `mobile/` — always `rm -rf dist` first.
- **Always restart local backend after any deploy** (unless actively editing it).
- **Always test live endpoints** before reporting a task complete: `fintheon.fly.dev/api/*` must be healthy; if 404/HTML, redeploy from `backend-hono/`.
- **Launchd plist sets** `NODE_ENV=development` locally (env-validation rejects `BYPASS_AUTH=true` in prod).
- **DMG to Desktop**: every DMG publish copies to `~/Desktop` AND deletes every prior `Fintheon-*.dmg` first. No stacking.

---

## File Rules

- All source files **under 300 lines**. Split on growth.
- One file = one purpose. Separate I/O, prompting, validation in distinct modules.
- Functional, declarative patterns. Avoid classes.
- **TypeScript strict mode.** Prefer interfaces over types. Avoid enums; use maps.
- Descriptive variable names with auxiliary verbs (`isLoading`, `hasError`).
- Lowercase-with-dashes for directories (`components/auth-wizard`).
- Favor named exports.

## Error Handling

- Handle errors at the **beginning** of functions with early returns. Happy path last.
- Use guard clauses for preconditions.
- **Zod for runtime validation** at system boundaries.
- Every service must work when its env var is missing (in-memory fallback, bypass auth, degraded AI).

---

## Changelog Protocol (MANDATORY)

After every change, add an entry to `src/lib/changelog.ts`:

```typescript
{ date: '2026-MM-DDTHH:mm:ss', agent: 'claude-code', summary: 'What and why', files: ['affected/files'] }
```

Also leave a comment at the top of substantially modified files:

```typescript
// [claude-code 2026-MM-DD] Description of change
```

This prevents other agents (Harper, Cursor, Codex) from "fixing" your intentional changes.

**`changelog.ts` ships in the bundle** — it's imported by a UI component. Never put plaintext secrets, URLs, or customer data in changelog strings.

---

## Solvys Skills Suite

7 skills available globally via `/skill-name`:

| Skill                 | Purpose                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/solvys-deploy`      | 3-target production deploy (Fly.io backend + 2× Vercel frontend). Pre-flight, deploy, test, fix cycle.                       |
| `/solvys-beta`        | Local DMG build and install for desktop testing. No pushes, no releases.                                                     |
| `/solvys-test`        | Sprint feature verification. Reads sprint brief, tests via CLI + Playwright, fixes inline.                                   |
| `/solvys-audit`       | Pre-ship verification, debug mode, security scan. Report-only by default.                                                    |
| `/solvys-inform`      | Agent briefing generator for onboarding and handoffs.                                                                        |
| `/solvys-orchestrate` | Multi-track sprint planning for parallel Claude Code instances.                                                              |
| `/solvys-feels`       | Visual architecture and design system. Overrides default aesthetic instincts.                                                |
| `/solvys-transitions` | 9 paste-ready CSS transitions (modal, dropdown, panel, badge, icon swap, text swap, page slide, card resize, number pop-in). |

**Edit canonical skill at `~/Documents/Codebases/solvys-skills/`, NOT `fintheon/.claude/skills`.** Global `~/.claude/skills/` symlinks are stale. After every `/solvys-deploy` or skill change, refresh install/update scripts.

`/solvys-deploy`, `/solvys-beta`, `/solvys-test` are **user-invocable only** (carry disable-model-invocation). You can't trigger them via the Skill tool.

---

## API Endpoints (Key)

- `POST /api/harper/chat` — Harper chat
- `GET  /api/riskflow/feed` — Scored news feed
- `GET  /api/riskflow/iv-aggregate` — IV score with VIX
- `POST /api/data/brief/generate` — Trigger brief (MDB/ADB/PMDB/TWT)
- `GET  /api/data/brief/latest?type=X` — Fetch latest brief
- `GET  /api/mcp` — MCP server config list
- `POST /api/arbitrum/deliberate` — Fire a chamber run
- `GET  /api/arbitrum/latest` — Latest Arbitrum verdict
- `GET  /api/arbitrum/verdicts/:id` — Specific verdict by id
- `GET  /api/diagnostics` — Service health check
- `GET  /api/miroshark/latest` — Legacy (deprecated; use Arbitrum)

---

## Arbitrum (Deliberation Engine)

5-seat Qwen3.5:397b-cloud debate via Hermes (Ollama Cloud). Output is a signal digest — **NO trade tickets, NO auto-actions.** Human makes the call.

| Seat | Role         | Model              | Provider     | Weight | Persona             |
| ---- | ------------ | ------------------ | ------------ | ------ | ------------------- |
| 1    | Lead Analyst | qwen3.5:397b-cloud | Ollama Cloud | 30%    | Harper              |
| 2    | Forecaster   | qwen3.5:397b-cloud | Ollama Cloud | 30%    | Oracle              |
| 3    | Risk Manager | qwen3.5:397b-cloud | Ollama Cloud | 20%    | Feucht              |
| 4    | Quantitative | qwen3.5:397b-cloud | Ollama Cloud | 10%    | Consul              |
| 5    | Bear Case    | qwen3.5:397b-cloud | Ollama Cloud | 10%    | Feucht alt / Herald |

**Cadence:** event-driven (`scored_riskflow_items.iv_score ≥ 8.5` AND speaker is top-10 commentator OR party-of-interest) + session cron 17:00 ET weekdays (feeds PMDB as "Chamber Read" at 17:15).

**Routing:** Hermes-only, never OpenRouter. Harper-CAO keeps its existing Claude-Opus path for chat; Arbitrum seats route through Hermes → Ollama Cloud.

**Disambiguation:** yes, the name collides with Arbitrum the Ethereum L2. Use **"Fintheon Arbitrum"** when needed.

---

## Terminology

- **MDB** = Morning Daily Brief (6:30 AM ET weekdays)
- **ADB** = Afternoon Daily Brief (10:45 AM ET)
- **PMDB** = Post-Market Daily Brief (5:15 PM ET)
- **TWT** = Tribune Weekly / Weekly Tribune (4:30 PM Sundays) — supersedes legacy TOTT
- **RiskFlow** = Scored news feed with IV-weighted urgency
- **NarrativeFlow** = Catalyst cards promoted from RiskFlow into narrative threads
- **Aquarium** = Surface label inside Sanctum for Arbitrum output (formerly MiroShark — deprecated 2026-04-24)
- **PsychAssist** = Trader tilt detection via ER scoring

---

## Recursive Self-Improvement Protocol (RSIP)

After EVERY significant task, run these 3 prompts internally:

```
LEARN-1: "Based on this task, what would I do differently?
         Consider approach, assumptions, and edge cases I missed."
LEARN-2: "What would a domain expert critique about my work?"
LEARN-3: "What specific changes to my process or the codebase
         would improve the next similar task?"
```

Then:

1. **Log findings** → append to `memory/agent-learn/claude-code-recommendations.md` (create if missing).
2. **Format**: Date, task summary, LEARN-1/2/3 answers, recommended upgrades.
3. **Self-upgrade**: If a LEARN finding reveals a pattern you keep hitting, update THIS file with a new rule. Bump the version. Rollback via git if it makes things worse.

---

## Custom Commands

Available via `/command-name`:

- `/quickscope` — Chart screenshot analysis + trade proposal
- `/macroscope-review` — PR review triage of Macroscope bot comments
- `/install-maintenance` — Post-ship installation audit (run after every deploy)

---

## Key Paths

- `frontend/` — React 19 + Vite + Tailwind
- `backend-hono/src/` — Hono routes + services
- `electron/` — main + preload
- `backend-hono/src/services/harper-handler.ts` — Harper chat handler
- `backend-hono/src/services/ai/agent-instructions/` — Agent system prompts
- `backend-hono/src/services/ai/soul/` — Agent SOUL files (Harper, Oracle, Feucht, Consul, Herald)
- `backend-hono/src/services/arbitrum/` — Arbitrum deliberation engine (5-seat chamber)
- `backend-hono/src/routes/` — All API routes
- `frontend/components/arbitrum/` — Arbitrum UI surfaces (Aquarium panel, hover peek)
- `src/lib/changelog.ts` — Changelog (entry after every feature/fix)
- **CSpace**: `~/Desktop/ClawSpace/frontend/`
- **PULSE**: `~/Library/Mobile Documents/com~apple~CloudDocs/Priced In/pulse-v4/pulse/`
- **OpenClaw workspace**: `~/.openclaw/workspace/`
- **RSIP full protocol**: `~/.openclaw/workspace/memory/recursive-self-improvement-protocol.md`
- **Agent learn logs**: `~/.openclaw/workspace/memory/agent-learn/`

---

## Version Branching

`v.{MONTH}.{DATE}.{PATCH}` for commits. Standing push authorization: every `/solvys-deploy` does commit → push → GH release → prune other v5.\* releases → refresh install/update scripts to fetch latest tag.

---

_This file is a snapshot. Treat it as the union of what `~/.claude/CLAUDE.md` and `~/Documents/Codebases/fintheon/CLAUDE.md` carried on 2026-04-26. Workspace memory at `~/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/` carries the live deltas._
