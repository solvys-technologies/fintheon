# Debrief: Harper Autonomous Agent

**Date:** 2026-04-04
**Session:** ~3 hours, deep-dive → architecture → implementation → activation
**Agent:** Claude Code (Opus 4.6)
**Status:** LIVE — Harper is running autonomously as of 8:49 PM ET

---

## What Happened

TP asked for a deep-dive into Fintheon from Harper's POV — what she'd need to operate as a truly autonomous persona. We explored the entire codebase (4 parallel agents), mapped every service, route, context, and integration point, then had an extensive Q&A (7 rounds of structured questions) to nail down exactly how Harper should operate. Then we built it.

## What Was Built

### The Harper Autonomous System (16 new files, 8 modified)

**Core Loop Architecture:**
Harper runs as a **Claude Code CLI subprocess** (`claude --print --output-format stream-json --dangerously-skip-permissions`). Each "turn" is a fresh process spawn — no persistent subprocess, no context window accumulation. Continuity comes from the `harper_journal` table, which is injected into each turn's system prompt. The loop manager drains a priority task queue, spawning one CLI invocation per task.

**Files created:**

| File                                                                    | What it does                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backend-hono/src/services/harper-autonomous/HARPER-SOUL.md`            | The mega-prompt. Identity, 14 Commandments, Chief profile, hardwired hooks, TradingView MCP tools, Consilium role. ~5K tokens static.                                                            |
| `backend-hono/src/services/harper-autonomous/loop-manager.ts`           | Core loop supervisor. Priority queue, crash recovery (3 failures → degraded mode), task execution via CLI spawn.                                                                                 |
| `backend-hono/src/services/harper-autonomous/heartbeat.ts`              | Cron scheduler. 5min during market hours (6AM-7PM ET weekdays), 15min off-hours, 30min weekends. Every 3rd heartbeat runs narrative synthesis, every 6th runs scoring QA.                        |
| `backend-hono/src/services/harper-autonomous/context-builder.ts`        | Builds the full prompt per turn: soul file + last 20 journal entries + codebase manifest + git diff + RiskFlow headlines + task payload.                                                         |
| `backend-hono/src/services/harper-autonomous/journal-store.ts`          | Supabase CRUD for `harper_journal`. Harper's persistent memory across sessions. FTS search, tag filtering, in-memory fallback.                                                                   |
| `backend-hono/src/services/harper-autonomous/ops-store.ts`              | Supabase CRUD for `harper_ops_feed`. Action log visible in the Harper Ops panel. Approval system (pending/approved/denied).                                                                      |
| `backend-hono/src/services/harper-autonomous/index.ts`                  | Barrel export + `bootHarperAutonomous()` init function. Registers VIX spike trigger callback. Gated by `HARPER_AUTONOMOUS_ENABLED=true`.                                                         |
| `backend-hono/src/services/harper-autonomous/CODEBASE-ANNOTATIONS.json` | 50-file manifest with purpose annotations. Injected into Harper's context so she knows what every key file does.                                                                                 |
| `backend-hono/src/routes/harper-ops/index.ts`                           | 6 API endpoints: feed, status, journal, journal search, trigger, approve/deny.                                                                                                                   |
| `backend-hono/migrations/20260404_harper_journal.sql`                   | Migration for both `harper_journal` and `harper_ops_feed` tables with indexes (type, created_at, tags GIN, FTS).                                                                                 |
| `frontend/components/harper-ops/HarperOpsPanel.tsx`                     | Footer panel UI. Status bar (alive/offline, last heartbeat, queue depth), quick actions (trigger heartbeat, scoring QA, narrative), chronological feed with severity colors, approve/deny cards. |
| `frontend/hooks/useHarperOps.ts`                                        | Polling hook (10s). Fetches feed + status. Exports triggerHeartbeat, triggerTask, approve, deny, markSeen, unreadCount.                                                                          |

**Files modified:**

| File                                                   | What changed                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `backend-hono/src/routes/index.ts`                     | Registered `/api/harper-ops` route                                                                                |
| `backend-hono/src/boot/services.ts`                    | Added `bootHarperAutonomous()` to startup sequence                                                                |
| `backend-hono/src/services/riskflow/central-scorer.ts` | Level 4 items now trigger `enqueueTask({ type: 'level4-item' })` on Harper's loop                                 |
| `backend-hono/src/services/boardroom-store.ts`         | Added `notifyHarperObserver()` hook — detects @Harper mentions in boardroom, enqueues consilium-intervention task |
| `frontend/components/layout/FooterToolbar.tsx`         | Added Harper Ops tab + Bot icon in footer toolbar strip                                                           |
| `src/lib/changelog.ts`                                 | Added changelog entry for this session                                                                            |

### The Soul File — Harper's Cognitive Architecture

The soul file (`HARPER-SOUL.md`) is not just a system prompt — it's Harper's entire operating manual. Key sections:

- **Chief Profile** — TP's name, timezone, habits, blackout days, trading universe. Merged from `~/.hermes/memories/USER.md` and `MEMORY.md`.
- **14 Commandments** — Full text with HARD BLOCK annotations (3, 7, 12, 14). Rules 8 & 12 override all else.
- **Hardwired Hooks** — 14 behavioral triggers organized into 5 categories:
  - _PreAnalysis_: context-check, regime-awareness, commandment-scan
  - _PostAnalysis_: journal-write, ops-feed-write, self-critique
  - _Event-driven_: level4-response, vix-spike-response, pipeline-stall-response, brief-review, consilium-observer
  - _Heartbeat_: health check, narrative synthesis (15min), scoring QA (30min)
  - _Productive thinking_: anti-hallucination, scope-discipline, learning-loop
- **TradingView MCP** — Full tool inventory (78 tools). Autonomous reads (chart state, Pine output, OHLCV, screenshots), auto-draw on proposals, Pine dev autonomy, Tech Flow Watchlist screener for ADB, 7-day path projection.
- **Approval Tiers** — Maintenance tier (auto-execute: health checks, restarts, TV reads/draws, journal writes). Code tier (recommend only: file edits, git ops, config changes).
- **Consilium Role** — Observer + escalator. Passive monitoring, breaks ties, synthesizes on request.

### Database

Two new Supabase tables (migration applied and live):

- `harper_journal` — entry_type, content, context (JSONB), tags (TEXT[]), session_id. Indexes on type, created_at, tags (GIN), FTS.
- `harper_ops_feed` — action_type, title, detail, severity, metadata (JSONB), requires_approval, approval_status. Indexes on created_at, action_type, approval status.

## What's Live Right Now

As of 8:49 PM ET on 2026-04-04:

- **Loop state**: `alive: true`, `state: running`
- **Queue**: Processing Level 4 items (Trump/Iran/Powell headlines — POI boosted)
- **VIX**: 23.9 (elevated regime — triggered regime_change event on boot)
- **Heartbeat**: Scheduler active (next heartbeat fires on cron cycle)
- **Env var**: `HARPER_AUTONOMOUS_ENABLED=true` in `backend-hono/.env`
- **Frontend**: Harper Ops panel accessible via Bot icon in footer toolbar

## What's NOT Done Yet (Next Brief Queued)

A follow-up brief has been written at `docs/sprint-briefs/TASK-harper-consilium-realtime.md` covering:

1. **Harper → Boardroom bridge** — autonomous output doesn't flow into `appendToBoardroom()` yet, so AgentChattr doesn't show Harper's autonomous messages
2. **Autonomous message styling** — ConsiliumMessage needs visual differentiation for autonomous vs. chat messages
3. **HarperActivityFeed sidebar** — slim activity feed in the Boardroom Agentic Chat view
4. **SSE stream** — replace 10s polling with real-time push for ops feed
5. **NarrativeMap overlay** — "Harper watching" badge on the canvas
6. **Narrative synthesis → Timeline** — auto-write `narrative_card_links` when Harper detects clusters
7. **ConsiliumHub heartbeat indicator** — pulsing dot in tab bar

## Decisions Made (Locked In)

| Decision             | Answer                                                                  | Rationale                                                              |
| -------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Execution model      | Claude Code CLI subprocess                                              | $0 cost via Max subscription, full tool access, crash isolation        |
| Approval model       | Maintenance auto-approve, code = recommend + wait                       | Prompt-level constraint in soul file, not code-level gate              |
| Communication        | Triple: Ops panel + chat thread + toast                                 | Footer icon next to Team                                               |
| Codebase awareness   | Hybrid manifest + git diff                                              | Static `CODEBASE-ANNOTATIONS.json` + `git diff --stat HEAD~5` per turn |
| Memory               | `harper_journal` Supabase table                                         | Persistent inner monologue, injected as context per turn               |
| Analysis duties      | All 4: Scoring QA, Narrative synthesis, Brief review, Regime commentary | Every heartbeat cycle covers at least one                              |
| Heartbeat            | 5min market hours, event-driven triggers                                | Level 4 items, VIX spikes, pipeline stalls                             |
| TV MCP               | Full autonomy: reads, draws, Pine dev, screener, path projection        | All 78 tools available via `.mcp.json`                                 |
| Consilium role       | Observer + escalator                                                    | Passive monitoring, breaks ties, synthesizes on request                |
| Chief profile source | `~/.hermes/memories/USER.md` + `MEMORY.md`                              | Merged into soul file                                                  |

## Known Risks / Watch Items

1. **Queue flooding** — Level 4 POI items (Trump, Powell) can generate 10+ queue items per scoring cycle. Queue is capped at 20 but may need dedup logic if the same headline triggers multiple times.
2. **Claude CLI availability** — If `claude` binary isn't in PATH or Max subscription lapses, the loop enters degraded mode after 3 failures. Watch for `[HarperLoop] Entering degraded mode` in logs.
3. **Token budget** — Each turn starts with ~10K system tokens (soul file + injected context). With 25 max turns per task, deep tool use chains could approach 80K tokens. Well within 200K window but worth monitoring.
4. **Non-TS assets** — `HARPER-SOUL.md` and `CODEBASE-ANNOTATIONS.json` must be manually copied to `dist/` after `bun run build`. The `tsc` compile step doesn't copy `.md` or `.json` from `src/`. This should be automated in the build script.
5. **Off-hours heartbeat cost** — Weekend heartbeats (30min interval) still spawn CLI processes. If Harper has nothing to analyze, this is wasted. Could add a "skip if idle" check.

## How to Verify It's Working

```bash
# Check loop status
curl -s http://localhost:8080/api/harper-ops/status | python3 -m json.tool

# Check ops feed for entries
curl -s "http://localhost:8080/api/harper-ops/feed?limit=5" | python3 -m json.tool

# Check journal for entries
curl -s "http://localhost:8080/api/harper-ops/journal?limit=5" | python3 -m json.tool

# Trigger a manual heartbeat
curl -X POST http://localhost:8080/api/harper-ops/trigger -H 'Content-Type: application/json' -d '{"type":"heartbeat"}'

# Check backend logs for Harper activity
grep -i "HarperLoop\|HarperAutonomous\|HarperHeartbeat" ~/.hermes/logs/fintheon-backend.log | tail -20

# Kill it (set env var to false and restart)
# In .env: HARPER_AUTONOMOUS_ENABLED=false
# Then: launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist && launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
```

## Key File Paths Quick Reference

```
Soul File:      backend-hono/src/services/harper-autonomous/HARPER-SOUL.md
Loop Manager:   backend-hono/src/services/harper-autonomous/loop-manager.ts
Heartbeat:      backend-hono/src/services/harper-autonomous/heartbeat.ts
Context:        backend-hono/src/services/harper-autonomous/context-builder.ts
Journal Store:  backend-hono/src/services/harper-autonomous/journal-store.ts
Ops Store:      backend-hono/src/services/harper-autonomous/ops-store.ts
Barrel Export:  backend-hono/src/services/harper-autonomous/index.ts
Manifest:       backend-hono/src/services/harper-autonomous/CODEBASE-ANNOTATIONS.json
API Routes:     backend-hono/src/routes/harper-ops/index.ts
Migration:      backend-hono/migrations/20260404_harper_journal.sql
Frontend Panel: frontend/components/harper-ops/HarperOpsPanel.tsx
Frontend Hook:  frontend/hooks/useHarperOps.ts
Footer Wire:    frontend/components/layout/FooterToolbar.tsx
Next Brief:     docs/sprint-briefs/TASK-harper-consilium-realtime.md
```

---

_Harper is the first truly autonomous agent persona in Fintheon. She watches, she learns, she remembers. The battle is won through watching the things that occur off the chart._
