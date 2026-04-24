# Sprint Brief: T8 — Canonical Naming Docs + Agent Roster

## Context

Fintheon's internal naming has drifted — agents don't know what TP means when he says "the Forum is broken" or "fix the Apparatus." This track publishes the canonical-names table inside the project CLAUDE.md so any agent reading repo-level instructions has the vocabulary locked in. Also confirms the 4-sub-agent roster (Oracle, Feucht, Consul, Herald) and adds Arbitrum + TWT terminology. Does NOT touch global `~/.claude/CLAUDE.md` — that stays as Harper's system prompt.

## Branch Target

`s35-t8-canonical-naming` (off `s34-unified`)

## Scope — Included

Edit only: `/Users/tifos/Documents/Codebases/fintheon/CLAUDE.md`

Additions / updates:

1. **Canonical Feature Names table** — add a new section near the top of the Terminology block:

```markdown
## Canonical Feature Names (locked 2026-04-24)

When TP directs an agent to "fix X," these are the authoritative names. Any internal identifier that doesn't match goes on the rename list.

| Canonical name                            | What it is                                                       | Internal locator                                               |
| ----------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| **Consilium**                             | Main workspace                                                   | `frontend/components/consilium/`                               |
| **Sanctum**                               | Timeline + Aquarium + NarrativeFlow composite                    | `frontend/components/narrative/Sanctum.tsx`                    |
| **Forum**                                 | Team channel (Fluxer iframe)                                     | `frontend/components/consilium/FluxerEmbed.tsx`                |
| **Agentic Forum** (aka Agentic Boardroom) | DAG + agent-swarm runtime                                        | `backend-hono/src/services/boardroom-*` + DAG routes           |
| **Apparatus**                             | Where the agents live (agent registry)                           | `frontend/components/apparatus/`                               |
| **Strategium**                            | Right rail — mission control + RiskFlow feed + economic calendar | `frontend/components/MissionControl.tsx` + Strategium panels   |
| **Arbitrum**                              | 5-seat deliberation engine (replaces MiroShark)                  | `backend-hono/src/services/arbitrum/`                          |
| **Aquarium**                              | Surface label inside Sanctum for Arbitrum output                 | `frontend/components/narrative/Sanctum.tsx` (chart-mode panel) |
| **RiskFlow**                              | Scored news feed                                                 | `backend-hono/src/services/riskflow/`                          |
| **NarrativeFlow**                         | Catalyst cards promoted from RiskFlow                            | `frontend/components/narrative/NarrativeCanvas.tsx`            |
| **CAO chat**                              | Main chat feature (persona: Harper)                              | `/api/harper/chat` + frontend ChatInterface                    |
| **PsychAssist**                           | Trader tilt detector                                             | `backend-hono/src/services/psych-assist/`                      |
| **MDB / ADB / PMDB / TWT**                | Morning / Afternoon / Post-market / Weekly briefs                | `backend-hono/src/services/brief-generator.ts`                 |

**Legacy names (DO NOT use in new code):** Ask Harp → CAO chat, TOTT → TWT, News Worker → RiskFlow Worker, Econ Enricher → RiskFlow Econ Enricher, OpenClaw → Hermes, Pulse* → Fintheon*, MiroShark → Arbitrum.
```

2. **Agent Roster confirmation** — the existing `## Agent Roster` table stays. VERIFY it lists Harper (CAO), Oracle, Feucht, Consul, Herald and NO others. If stray names exist (e.g., Sentinel, Charles, Horace), remove them — those are global PIC personas, not Fintheon agents.

3. **Arbitrum terminology block** — add a new subsection under Terminology:

```markdown
## Arbitrum (deliberation engine, replaces MiroShark)

**What:** 5-seat Qwen-family debate via Hermes. Output is a signal digest (consensus probability, confidence, dissent summary, digest text, IV simulation, upcoming catalysts). NO trade tickets, NO auto-actions — human makes the call.

**Seats:**

| Seat | Role         | Model                                   | Provider            | Weight | Persona voice       |
| ---- | ------------ | --------------------------------------- | ------------------- | ------ | ------------------- |
| 1    | Lead Analyst | Qwen3-235B-A22B                         | DashScope free-tier | 30%    | Harper (CAO)        |
| 2    | Forecaster   | Qwen2.5-72B-Instruct                    | Ollama              | 30%    | Oracle              |
| 3    | Risk Manager | QwQ-32B-Preview                         | Ollama              | 20%    | Feucht              |
| 4    | Quantitative | Qwen2.5-Coder-32B                       | Ollama              | 10%    | Consul              |
| 5    | Bear Case    | Qwen3-14B (w/ non-Qwen Ollama fallback) | Ollama              | 10%    | Feucht alt / Herald |

**Cadence:** event-driven (scored_riskflow_items.iv_score ≥ 8.5 AND speaker is top-10 commentator OR party-of-interest) + session cron 17:00 ET weekdays (feeds into PMDB as "Chamber Read" section at 17:15).

**Routing:** Hermes-only, never OpenRouter. Harper-CAO keeps its existing Claude-Opus path for chat; Arbitrum seats route through Hermes → Ollama/DashScope/Groq.

**Engine surface vs UI surface:** the engine is `services/arbitrum/`. The user sees output inside Sanctum's Aquarium surface and as a peek textbox in the IV scoring widget hover modal.

**Brand note:** yes, the name collides with Arbitrum the Ethereum L2. Disambiguate as "Fintheon Arbitrum" when needed.
```

4. **Update Key Paths section** — if the existing Key Paths list doesn't include `backend-hono/src/services/arbitrum/` or `frontend/components/arbitrum/`, add both.

5. **Update API Endpoints section** — add:
   - `POST /api/arbitrum/deliberate` — fire a chamber run
   - `GET /api/arbitrum/latest` — latest verdict
   - `GET /api/arbitrum/verdicts/:id` — specific verdict

6. **Deprecate MiroShark from the Terminology section** — if any existing `## Terminology` bullet mentions "MiroShark multi-agent simulation," replace with "MiroShark (deprecated 2026-04-24, replaced by Arbitrum)" and cross-reference the new Arbitrum section.

## Scope — Excluded (DO NOT TOUCH)

- Global `~/.claude/CLAUDE.md` — stays (Harper's system prompt)
- `~/CLAUDE.md` — TP's personal workspace CLAUDE.md; do NOT touch unless it lives inside the fintheon repo
- Agent soul files (`HARPER-SOUL.md`, any other `*-SOUL.md`) — T5 touches HARPER-SOUL.md for TOTT→TWT only; this track does not touch souls
- Any source code — docs only
- `backend-hono/CLAUDE.md` — backend-hono's own instructions file; stays

## Reuse Inventory

- Existing fintheon/CLAUDE.md structure — preserve section ordering; insert new sections alongside existing ones with consistent formatting
- Terminology abbreviations already documented there (MDB/ADB/PMDB/RiskFlow/etc) — mirror the bullet-style format

## Known Issues to Preserve

- Do NOT rewrite the RSIP (Recursive Self-Improvement Protocol) block — it's live and referenced by other tooling
- Do NOT rewrite the Changelog Protocol block — that drives every agent's behavior
- Do NOT modify the Identity / Core Rules sections — those define TP's company identity
- When adding the Arbitrum block, place it AFTER the existing Terminology section, not replacing anything

## Implementation Steps

1. Read current `/Users/tifos/Documents/Codebases/fintheon/CLAUDE.md` in full
2. Identify the Terminology section — that's where the Canonical Feature Names table and Arbitrum block go
3. Identify the Agent Roster section — verify it's exactly (Harper CAO, Oracle, Feucht, Consul, Herald); prune any stray entries
4. Identify the Key Paths section — add arbitrum paths if missing
5. Identify the API Endpoints section — add arbitrum endpoints
6. Apply edits in a single `Write` of the full file (since multiple sections change). OR use sequential `Edit` calls if the file is large enough that full-file replacement is risky.
7. Verify the file still parses as valid markdown; no broken tables

## Acceptance Criteria

- [ ] Canonical Feature Names table present with all 13 rows (Consilium through MDB/ADB/PMDB/TWT)
- [ ] Legacy Names DO NOT USE list present
- [ ] Agent Roster contains exactly 5 entries (Harper CAO + 4 sub-agents)
- [ ] Arbitrum terminology block present with seat table + cadence + routing
- [ ] Key Paths includes arbitrum backend + frontend directories
- [ ] API Endpoints includes 3 arbitrum endpoints
- [ ] MiroShark mentioned in Terminology is deprecated-marked with cross-ref to Arbitrum

## Validation Commands

```bash
# Verify new sections exist
grep -nE "^## Canonical Feature Names" /Users/tifos/Documents/Codebases/fintheon/CLAUDE.md
grep -nE "^## Arbitrum" /Users/tifos/Documents/Codebases/fintheon/CLAUDE.md
grep -n "Harper (CAO)" /Users/tifos/Documents/Codebases/fintheon/CLAUDE.md
grep -n "Legacy names (DO NOT use" /Users/tifos/Documents/Codebases/fintheon/CLAUDE.md

# Confirm no stray agents
grep -iE "Sentinel|Charles|Horace" /Users/tifos/Documents/Codebases/fintheon/CLAUDE.md

# Markdown lint (if tool available)
# npx markdownlint /Users/tifos/Documents/Codebases/fintheon/CLAUDE.md 2>/dev/null || true
```

## Commit Format

```
[v5.25.0-S35-T8] docs: Canonical naming table + Arbitrum terminology + agent roster

Adds Canonical Feature Names locked table (Consilium/Sanctum/Forum/
Agentic Forum/Apparatus/Strategium/Arbitrum/Aquarium/RiskFlow/
NarrativeFlow/CAO chat/PsychAssist/MDB-ADB-PMDB-TWT). Adds Arbitrum
deliberation engine block with 5-seat config + cadence + routing.
Confirms 4-sub-agent roster (Oracle/Feucht/Consul/Herald under CAO
Harper). Deprecates MiroShark with cross-ref. Global ~/.claude/CLAUDE.md
untouched (Harper system prompt stays).
```
