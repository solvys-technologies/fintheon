# Percepta × MiroFish × OpenViking — Fintheon Integration Spec

> Date: 2026-03-23  
> Status: Architecture — ready for local implementation  
> Scope: Backend services, Consilium UI, Oracle routing, OpenViking memory layer

---

## Overview

Three external technologies integrate into Fintheon's existing agent pipeline to upgrade prediction capability, persistent memory, and deterministic compute.

| Layer | Technology | Primary Agent | What It Replaces |
|-------|-----------|---------------|------------------|
| Memory | OpenViking (ByteDance) | All agents | JSONL session logs + Notion control plane |
| Simulation | MiroFish (OASIS engine) | Oracle + Consul | Single-pass LLM reasoning for event prediction |
| Compute | Percepta (WASM-in-Transformer) | Feucht + Oracle | External tool calls for exact math/logic |

---

## Layer 1: OpenViking as Persistent Agent Memory

### What It Does

OpenViking replaces Notion as the structured context store for Hermes agents. It organizes all agent context into a virtual filesystem via the `viking://` protocol with three root directories:

- `viking://resources/` — market data snapshots, filings, seed documents, economic calendars
- `viking://user/` — per-user trading preferences, risk tolerance, P&L history, instrument preferences
- `viking://agent/` — per-agent learned skills and operational lessons (e.g., `viking://agent/oracle/skills/fed-meeting-patterns`)

### Tiered Context Loading (L0/L1/L2)

Every piece of context is compressed into three tiers on write:

- **L0 (Abstract)**: One-sentence summary, <100 tokens. Agents skim this for planning.
- **L1 (Overview)**: Essential structure + usage scenarios, <2,000 tokens.
- **L2 (Detail)**: Full content, loaded on demand via URI.

This reduces input token consumption by ~80% (from 24.6M to 4.3M tokens on benchmarks, further to 2.1M with memory-core enabled).

### Integration Points in Fintheon

| Current System | OpenViking Replacement |
|---|---|
| `~/.hermes/agents/main/sessions/*.jsonl` | `viking://agent/{agentName}/sessions/` |
| Notion control plane (task routing, approvals) | `viking://resources/control-plane/` |
| `knowledge-base/` directory | `viking://resources/knowledge-base/` |
| Per-user settings in Neon DB | `viking://user/{userId}/preferences/` |

### Backend Changes

- **New service**: `backend-hono/src/services/openviking/client.ts` — wraps `pip install openviking` Python API (`client.add_resource`, `client.search`, `client.read`, `client.ls`) via a thin Hono-compatible bridge.
- **Config**: Add `OPENVIKING_PROVIDER`, `OPENVIKING_API_KEY`, `OPENVIKING_EMBEDDING_MODEL` to `.env`.
- **Agent pipeline change**: Each agent in `pipeline.ts` reads from `viking://agent/{name}/skills/` at start and writes session learnings on completion.
- **Session extraction**: Post-pipeline hook that analyzes pipeline results and persists operational lessons to `viking://agent/{name}/skills/`.
- **Hermes MCP config**: Add OpenViking as an MCP server in `~/.hermes/config.yaml`:
  ```yaml
  mcp_servers:
    openviking:
      command: python
      args: ["-m", "openviking.mcp_server"]
      env:
        OV_PROVIDER: openai
        OV_API_KEY: ${OPENAI_API_KEY}
  ```

### "Agents That Know You" — User Layer

Each Fintheon user gets a `viking://user/{userId}/` directory that accumulates:
- Trading style classification (scalper, swing, position)
- Risk tolerance derived from actual behavior (not just settings)
- Instrument preferences and sector focus
- Historical P&L context and drawdown patterns
- Communication preferences (brief vs. detailed, when to surface alerts)

This replaces the static user profile in Neon and makes every agent session contextually aware of who it's serving.

---

## Layer 2: MiroFish Simulation Pipelines

### Architecture Decision: Adversarial Fork, Not Raw Swarm

For direct financial execution, MiroFish's full swarm architecture introduces consensus collapse and $800+/run token costs. The research-backed approach uses a **forked adversarial pipeline** that strips the social simulation layers and keeps only:

1. **GraphRAG** — knowledge graph construction from seed material (kept)
2. **ReportAgent** — structured analysis and synthesis (kept)
3. **Persona generation + dual-platform social sim** — stripped for financial use cases

This reduces per-run cost from ~$800 to ~$5 via mixed model routing and eliminates the 14-minute latency penalty.

**Exception**: Full swarms are used for **geopolitical risk** simulations where emergent social dynamics ARE the signal.

### Pipeline A: Fed Meeting / Rate Futures

**Trigger**: Scheduled before each FOMC meeting, or on-demand when rate-sensitive data drops (CPI, NFP, PCE).

**Seed Material**:
- Latest FOMC minutes + statement
- Fed dot plot data (current + historical trajectory)
- CME FedWatch probabilities (current term structure)
- Recent Fed governor speeches and dissent patterns
- Treasury yield curve snapshot (2Y, 5Y, 10Y, 30Y)

**Pipeline Architecture** (adversarial fork):
```
Seed Material → GraphRAG Knowledge Graph
                    ↓
    ┌───────────────┴───────────────┐
    │                               │
  Hawk Agent                    Dove Agent
  (isolated, no                 (isolated, no
   communication)                communication)
    │                               │
    ├─ Models: rate hold/hike      ├─ Models: rate cut acceleration
    ├─ Dot plot trajectory         ├─ Dot plot trajectory
    ├─ Probability assignment      ├─ Probability assignment
    │  per meeting date            │  per meeting date
    │                               │
    └───────────┬───────────────────┘
                ↓
        Execution Gate (Confidence Delta)
                ↓
        ┌───────┴───────┐
        │ Δ > threshold │ → Structured prediction output
        │ Δ < threshold │ → No-conviction zone (hold current view)
        └───────────────┘
                ↓
        ReportAgent → Structured forecast:
          - Rate path probability distribution
          - Dot plot trajectory comparison
          - Cut/hike count for next 4 meetings
          - Confidence delta score
          - Key risk factors that could flip the call
```

**Output Schema**:
```typescript
interface FedMeetingPrediction {
  nextMeeting: {
    date: string;
    holdProb: number;
    cutProb: number;
    hikeProb: number;
    bpsMove: number; // expected basis point move
  };
  ratePathForward: Array<{
    meetingDate: string;
    cumulativeCuts: number;
    cumulativeHikes: number;
    terminalRate: number;
    confidence: number;
  }>;
  dotPlotDrift: 'hawkish' | 'dovish' | 'unchanged';
  confidenceDelta: number; // hawk vs dove conviction gap
  regime: 'cutting' | 'holding' | 'hiking' | 'transitional';
  keyRisks: string[];
}
```

### Pipeline B: Geopolitical Risk (FULL SWARM)

**This is the exception that uses full MiroFish swarm simulation.** Geopolitical risk depends on emergent social dynamics — coalition formation, narrative shifts, escalation/de-escalation cascades — which is exactly what MiroFish's persona agents model.

**Trigger**: Oracle detects elevated geopolitical risk score or H.E. manual trigger.

**Seed Material**:
- Breaking news / intelligence reports on the conflict
- Historical policy positions of key actors
- UN/NATO/bilateral communiqués
- Sanctions and trade flow data
- Military positioning intelligence (public sources)

**Behavioral Profiles** (persona generation):
- War-hawk politicians (each major faction)
- Dove/diplomatic faction leaders
- Military advisors with distinct doctrines
- Economic advisors weighing sanctions impact
- Alliance leaders (NATO, EU, regional blocs)
- Energy/commodity market participants
- Defense contractor lobbyists

Each persona gets:
- Ideological stance (neo-realist, liberal institutionalist, nationalist, pragmatist)
- Risk tolerance (escalation-prone vs. de-escalation-seeking)
- Domestic political constraints (election cycles, approval ratings)
- Historical decision patterns from similar crises

**Simulation runs on full dual-platform OASIS engine** (Twitter-like + Reddit-like) to capture:
- Narrative formation and propaganda dynamics
- Coalition stability and fracture points
- Escalation ladder progression
- De-escalation off-ramp detection

**God's-eye interaction**: Inject counterfactuals mid-simulation:
- "What if sanctions are expanded to energy sector?"
- "What if a ceasefire proposal is tabled?"
- "What if a military incident occurs in [region]?"

### Pipeline C: Earnings / Market Maker Behavioral Profiles

**Trigger**: Pre-earnings for watchlist tickers, or on-demand.

**Seed Material**:
- Company 10-Q/10-K filings (most recent)
- Analyst consensus estimates (EPS, revenue, guidance)
- Options flow data (unusual activity, put/call ratio, gamma exposure)
- Institutional ownership changes (13F delta)
- Management commentary from prior calls

**Pipeline Architecture** (adversarial fork):
```
Seed Material → GraphRAG Knowledge Graph
                    ↓
    ┌───────────────┴───────────────┐
    │                               │
  Bull MM Agent                 Bear MM Agent
  (institutional buyer          (institutional seller
   behavioral profile)           behavioral profile)
    │                               │
    ├─ Position accumulation       ├─ Distribution patterns
    │  thesis                      │  thesis
    ├─ Gamma positioning           ├─ Hedging requirements
    ├─ Flow-implied direction      ├─ Flow-implied direction
    │                               │
    └───────────┬───────────────────┘
                ↓
        Execution Gate (Confidence Delta)
                ↓
        ReportAgent → Structured forecast:
          - Beat/miss probability
          - Expected move vs implied move
          - Smart money positioning read
          - Post-earnings drift direction
          - Key metric to watch
```

**Market Maker Behavioral Profiles**:
- Large institutional holders (top 10 from 13F)
- Options market makers (gamma exposure and hedging behavior)
- Retail flow proxy (social sentiment + small-lot options activity)
- Short interest participants (squeeze potential modeling)

### Pipeline D: General Sector Risk (Adversarial)

For non-geopolitical, non-Fed, non-earnings risk events (e.g., trade policy, regulatory changes, sector rotation signals).

Uses the standard adversarial fork with sector-specific behavioral profiles configurable per run.

---

## Layer 2E: Oracle Routing Logic

### Routing Rules

```
EVENT TYPE              → PIPELINE        → AGENTS INVOLVED
──────────────────────────────────────────────────────────────
Fed meeting / rate data → Pipeline A      → Oracle runs adversarial fork
Earnings (watchlist)    → Pipeline C      → Oracle runs adversarial fork
Sector risk (general)   → Pipeline D      → Oracle runs adversarial fork
Geopolitical risk       → Pipeline B      → Oracle runs FULL SWARM
Geo × Rate clash        → Pipeline B + A  → Oracle runs BOTH, Aggregator merges
```

### Dual-Run Aggregation (Geopolitical × Rate Cycle Clash)

When geopolitical tensions intersect with a rate cut/hike cycle (the current environment):

1. **Run 1**: Full MiroFish swarm for geopolitical risk → produces conflict trajectory, escalation probability, sanctions impact score
2. **Run 2**: Adversarial fork for rate path → produces rate path distribution, dot plot drift, terminal rate estimate
3. **Aggregation layer**: Merges both outputs into a unified risk-adjusted view:
   - How does the geopolitical trajectory shift rate expectations?
   - What's the conditional probability: "rates get cut faster IF conflict escalates"?
   - Net positioning recommendation that accounts for both vectors

**Implementation**: New service at `backend-hono/src/services/agents/oracle-router.ts` that:
- Classifies incoming events by type
- Dispatches to the correct pipeline(s)
- Runs aggregation when dual-run is required
- Feeds unified output back to the Consilium and to downstream agents (Feucht for risk sizing, Consul for fundamental overlay)

---

## Layer 2D: Persistent Thinking Accords — Consilium Cards

### Concept

"Active accords of thinking" — persistent, auto-updating prediction cards that live in a dedicated tab within the Consilium. Each card represents an ongoing Oracle assessment of the next data print (CPI, NFP, PCE, earnings, FOMC) with a beat/miss call and a bullish/bearish market impact assessment.

### Card Schema

```typescript
interface ThinkingAccord {
  id: string;
  eventType: 'fed_meeting' | 'cpi' | 'nfp' | 'pce' | 'earnings' | 'gdp' | 'geopolitical';
  eventDate: string; // when the print/event drops
  ticker?: string; // for earnings
  
  // Oracle's current assessment
  prediction: {
    direction: 'beat' | 'miss' | 'inline';
    confidence: number; // 0-1
    magnitude: 'slight' | 'moderate' | 'significant';
  };
  
  marketImpact: {
    bias: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    rationale: string; // 2-3 sentence summary
    keyMetric: string; // the single number to watch
    expectedValue: string; // Oracle's estimate
    consensusValue: string; // street consensus
  };

  // Pipeline metadata
  lastPipelineRun: string; // ISO timestamp
  pipelineType: 'adversarial' | 'full_swarm' | 'dual_run';
  confidenceDelta: number;
  
  // Accord evolution
  history: Array<{
    timestamp: string;
    previousBias: string;
    newBias: string;
    trigger: string; // what data point caused the update
  }>;
  
  status: 'active' | 'locked' | 'resolved';
  resolution?: {
    actualResult: string;
    predictionAccuracy: 'correct' | 'incorrect' | 'partial';
    pnlImpact: number;
  };
}
```

### Frontend Implementation

**New component**: `components/consilium/ThinkingAccords.tsx`

Each card renders as a compact tile showing:
- Event name + countdown to print
- Beat/miss call with confidence bar
- Bull/bear market impact with rationale preview
- Last updated timestamp
- Expand to see full accord history and pipeline details

**New tab in Consilium**: "Accords" tab alongside existing message history and agent scorecards.

**Backend**: 
- New table: `thinking_accords` in Neon (migration `014_thinking_accords.sql`)
- New route: `/api/agents/accords` (GET list, GET by id, POST trigger re-evaluation)
- Oracle pipeline writes accord updates after each run
- SSE broadcaster pushes real-time updates to the Consilium

### Auto-Update Triggers

Accords auto-refresh when:
- New RiskFlow data comes in (economic feed poller detects relevant data)
- Oracle runs a scheduled pipeline
- Herald detects sentiment shift related to the event
- H.E. manually triggers a re-evaluation

### Lifecycle

1. **Created**: Oracle identifies an upcoming event and initializes the accord
2. **Active**: Accord updates as new data flows in; history tracks each bias shift
3. **Locked**: 1 hour before the event, accord locks to capture the final prediction
4. **Resolved**: After the event, actual result is recorded and prediction accuracy is scored (feeds into AgentScorecard)

---

## Layer 3: Percepta Deterministic Compute

### Current Status (2026-03-23)

Percepta's WASM-in-Transformer research was published 2026-03-11 by Christos Tzamos. Key facts:

- **Weights are NOT released publicly** — no downloadable model weights or compiler tool as of this date
- **No public SDK or API** — percepta.ai is a General Catalyst transformation company focused on government/enterprise AI deployments (Maryland state partnership with Anthropic)
- The blog post demonstrates a proof-of-concept on a small 7-layer transformer (`d_model=36, n_heads=18`)
- HullKVCache achieves 31,037 tok/s on CPU with O(log n) attention
- The architecture is a vanilla PyTorch transformer — reproducible in principle

### What's Actionable Now

The HullKVCache and 2D attention head architecture described in the paper can be implemented independently — the construction is fully documented:

- Index lookup: store index as 2D key `(i, -i²)`, query direction `(1, -2i)`, dot product maximizes at exact match
- Cumulative sums: keys set to same value, attention averages uniformly, multiply by position
- Convex hull maintenance: dynamic insertion as tokens generate, log-time retrieval

### Integration Path for Feucht

When reproducible weights or a compiler become available:

1. **Compile risk computation primitives to WASM**: Kelly criterion, VaR calculation, Monte Carlo path generation, options Greeks, position sizing math
2. **Embed as a small dedicated model** that Feucht calls as a fast-path for exact computation
3. **Speculative execution mode**: Small Percepta model proposes, larger Claude model verifies
4. Route through OpenRouter alongside existing Claude Opus/Sonnet calls

### Tracking

Monitor `percepta.ai/blog` and the Hacker News thread (https://news.ycombinator.com/item?id=47348275) for weight releases or open-source compiler announcements.

---

## Implementation Priority

| Priority | Task | Effort | Dependency |
|----------|------|--------|------------|
| P0 | OpenViking integration (memory layer) | 2-3 days | `pip install openviking`, `.env` config |
| P0 | Oracle router service | 1-2 days | None |
| P1 | Fed meeting adversarial pipeline (Pipeline A) | 2-3 days | Oracle router |
| P1 | Thinking Accords DB migration + API | 1-2 days | None |
| P1 | Thinking Accords Consilium tab UI | 1-2 days | Accords API |
| P2 | Geopolitical full swarm pipeline (Pipeline B) | 3-4 days | MiroFish local setup |
| P2 | Earnings adversarial pipeline (Pipeline C) | 2-3 days | Oracle router |
| P2 | Dual-run aggregation (Geo × Rate) | 1-2 days | Pipelines A + B |
| P3 | Percepta compute primitives | TBD | Weight/compiler release |

---

## MiroFish Local Setup

```bash
git clone https://github.com/666ghj/MiroFish.git
cd MiroFish
cp .env.example .env

# Configure for OpenRouter (same backend as Hermes agents)
# .env:
LLM_API_KEY=<openrouter_key>
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL_NAME=anthropic/claude-sonnet-4-20250514
ZEP_API_KEY=<zep_cloud_key>

npm run setup:all
npm run dev
# Frontend: http://localhost:3000
# Backend API: http://localhost:5001
```

For fully local/offline operation, use the MiroFish-Offline fork (Ollama + Neo4j, no cloud APIs).

---

## References

- Percepta blog: https://www.percepta.ai/blog/can-llms-be-computers
- MiroFish repo: https://github.com/666ghj/MiroFish
- OpenViking repo: https://github.com/volcengine/OpenViking
- OpenViking architecture: https://emelia.io/hub/openviking-context-database-ai-agents
- MiroFish adversarial trading pipeline: https://www.youtube.com/watch?v=gp8GIpXScKg
- Hermes Agent quickstart: https://hermes-agent.nousresearch.com/docs/getting-started/quickstart/
- OASIS engine (CAMEL-AI): powers MiroFish simulation layer
