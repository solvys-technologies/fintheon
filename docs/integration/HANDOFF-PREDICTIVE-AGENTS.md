# Handoff Prompt — Predictive Agent Integration

> Use this prompt to continue implementation locally in Claude Code, Cursor, or Hermes Agent.

---

## Context

You are working in the `Solvys-technologies/fintheon` repository — a React 19 + Vite frontend with a Hono backend (Fly.io) trading platform. The agent pipeline lives at `backend-hono/src/services/agents/pipeline.ts` and runs a 4-stage collaborative AI pipeline:

- Stage 1 (parallel): Market Data + Technical + Herald (sentiment)
- Stage 2: Oracle (prediction markets + macro)  
- Stage 3: Consul (bull/bear fundamental research + debate)
- Stage 4: Feucht (risk check + proposal)

The Consilium UI (`components/consilium/`) is the agent discussion panel with message bubbles, agent badges, filter bar, and scorecards. Agent types are defined in `backend-hono/src/types/agents.ts`. The existing badge roster: Harper-Hermes (CAO), Oracle (All-Seer), Feucht (Risk Desk), Consul (Fundamentals), Herald (Sentiment).

Read `docs/integration/PERCEPTA-MIROFISH-OPENVIKING.md` for the full integration spec before starting.

---

## Tasks (in priority order)

### 1. OpenViking Memory Layer

**Goal**: Replace JSONL session logs and Notion control plane with OpenViking's structured `viking://` filesystem.

- Install OpenViking: `pip install openviking --upgrade --force-reinstall`
- Create `backend-hono/src/services/openviking/client.ts` — a bridge that wraps OpenViking's Python API for the Hono server. The API surface is minimal: `client.add_resource(path)`, `client.search(query)`, `client.read(uri)`, `client.ls(uri)`, `overview`.
- Add environment variables to `.env.example`: `OPENVIKING_PROVIDER`, `OPENVIKING_API_KEY`, `OPENVIKING_EMBEDDING_MODEL`
- Modify `pipeline.ts` post-pipeline hook: after Stage 4 completes, extract operational lessons and write to `viking://agent/{agentName}/skills/`
- Add Hermes MCP server config example to the repo (for `~/.hermes/config.yaml`)
- The L0/L1/L2 tiered context loading should be used when agents read from viking — start at L0, drill to L1 for planning, L2 only for execution

### 2. Oracle Router Service

**Goal**: New service that classifies events and dispatches to the correct MiroFish pipeline.

- Create `backend-hono/src/services/agents/oracle-router.ts`
- Event classification: `fed_meeting` | `earnings` | `geopolitical` | `sector_risk`
- Routing rules:
  - `fed_meeting`, `earnings`, `sector_risk` → adversarial fork (Oracle-only, no full swarm)
  - `geopolitical` → full MiroFish swarm
  - Geopolitical × rate cycle clash → dual-run (both pipelines) + aggregation
- The adversarial fork uses isolated bull/bear agents with ZERO communication, confidence delta execution, and a no-trade threshold
- New route: `POST /api/agents/oracle-dispatch` accepting `{ eventType, seedMaterial, options }`
- Register in `backend-hono/src/routes/agents/index.ts`

### 3. Fed Meeting Pipeline (Pipeline A)

**Goal**: Adversarial prediction pipeline for rate futures and dot plot trajectory.

- Seed material inputs: FOMC minutes, dot plot, CME FedWatch probs, yield curve snapshot
- Two isolated agents: Hawk Agent (rate hold/hike thesis) and Dove Agent (rate cut acceleration thesis)
- Each produces: per-meeting probability distribution, terminal rate estimate, dot plot trajectory
- Execution gate: confidence delta between hawk and dove outputs. If below threshold → no-conviction zone
- ReportAgent synthesizes into `FedMeetingPrediction` schema (see integration spec)
- Output feeds into Thinking Accords (task 5) and back to Feucht for risk sizing

### 4. Geopolitical Full Swarm Pipeline (Pipeline B)

**Goal**: Full MiroFish swarm simulation for geopolitical risk events.

- This is the ONLY pipeline that uses full persona generation + dual-platform OASIS simulation
- Behavioral profiles must model distinct ideological stances: neo-realist, liberal institutionalist, nationalist, pragmatist
- Each persona gets: ideology, risk tolerance, domestic political constraints, historical decision patterns
- Configure via MiroFish's `.env` pointed at OpenRouter (same `LLM_BASE_URL` as Hermes)
- Cap simulation rounds at 40 max
- Expose God's-eye counterfactual injection: `POST /api/agents/oracle-dispatch/inject` to modify variables mid-run
- When geopolitical risk clashes with rate cycle: run both Pipeline B and Pipeline A, then aggregate via dedicated merge service

### 5. Thinking Accords — Consilium Cards

**Goal**: Persistent, auto-updating prediction cards in a new Consilium tab.

- New migration: `backend-hono/migrations/014_thinking_accords.sql` with schema from integration spec (`ThinkingAccord` interface)
- New API routes under `/api/agents/accords`: GET list, GET by ID, POST trigger re-evaluation
- New frontend component: `components/consilium/ThinkingAccords.tsx` — renders as compact tiles with:
  - Event name + countdown timer to print
  - Beat/miss call with confidence bar
  - Bull/bear bias with rationale preview
  - Last updated timestamp
  - Expandable history showing every bias shift and what triggered it
- Add "Accords" as a new tab in the Consilium panel
- SSE integration: accords push real-time updates via the existing `sse-broadcaster.ts`
- Auto-update triggers: new RiskFlow data, Oracle pipeline runs, Herald sentiment shifts, manual H.E. trigger
- Lifecycle: Created → Active (updating) → Locked (1hr before event) → Resolved (actual result recorded, feeds AgentScorecard)
- Follow existing Consilium styling: `#c79f4a` accent, `#0a0a00` bg, `#f0ead6` text, rounded borders

### 6. Earnings Pipeline (Pipeline C)

**Goal**: Adversarial fork for earnings prediction with market maker behavioral profiles.

- Seed material: 10-Q/10-K, analyst consensus, options flow, 13F institutional ownership delta, prior management commentary
- Bull MM Agent: models institutional accumulation thesis, gamma positioning bullish read
- Bear MM Agent: models distribution thesis, hedging requirements, squeeze vulnerability
- Execution gate: confidence delta → beat/miss call with magnitude
- Output: beat/miss probability, expected vs implied move, smart money read, post-earnings drift direction

### 7. Percepta Integration (Future — Track Only)

- No actionable code yet — weights and compiler not publicly released as of 2026-03-23
- When available: compile risk primitives (Kelly, VaR, Monte Carlo, Greeks) to WASM, embed as fast-path model for Feucht
- Monitor: https://www.percepta.ai/blog/can-llms-be-computers and HN thread

---

## Architecture Rules

- All MiroFish pipelines route through OpenRouter (same as existing Hermes agents)
- Agent outputs write to OpenViking (`viking://agent/`) for persistent learning
- Thinking Accords are the user-facing surface — agents produce accords, users consume them in Consilium
- Oracle owns all MiroFish dispatch — no other agent triggers simulations directly
- Full swarm is ONLY for geopolitical risk — everything else uses the adversarial fork
- Dual-run aggregation is automatic when Oracle detects geopolitical × rate cycle overlap

## File Structure Reference

```
backend-hono/src/
├── services/
│   ├── agents/
│   │   ├── pipeline.ts          # existing 4-stage pipeline
│   │   ├── oracle-router.ts     # NEW — event classification + dispatch
│   │   ├── fed-pipeline.ts      # NEW — Pipeline A (adversarial)
│   │   ├── geopolitical-swarm.ts # NEW — Pipeline B (full swarm)
│   │   ├── earnings-pipeline.ts  # NEW — Pipeline C (adversarial)
│   │   ├── dual-run-aggregator.ts # NEW — merges geo + rate outputs
│   │   └── accord-service.ts    # NEW — thinking accord CRUD + lifecycle
│   └── openviking/
│       └── client.ts            # NEW — OpenViking bridge
├── routes/
│   └── agents/
│       ├── index.ts             # MODIFY — add oracle-dispatch + accords routes
│       └── handlers.ts          # MODIFY — add new handlers
├── migrations/
│   └── 014_thinking_accords.sql # NEW
└── types/
    └── agents.ts                # MODIFY — add new types

components/consilium/
├── ThinkingAccords.tsx          # NEW — accord card grid
├── AccordCard.tsx               # NEW — individual accord tile
└── (existing files unchanged)
```
