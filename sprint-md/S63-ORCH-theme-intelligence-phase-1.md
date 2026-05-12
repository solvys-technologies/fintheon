# S63-ORCH Phase 1 — Theme Intelligence: Contracts + Stage B

- **Parent sprint branch**: `sprint/S63`
- **Cycle**: Cycle 8 (Closed Beta)
- **Due**: June 6
- **Milestone**: Phase 1 — Contracts + Stage B
- **Owner**: Shashank

## What this covers

Phase 1 of the Theme Intelligence refactor. Establish the product contract and KPI lexicon (SOL-78), build the IPV Engine v1 with weekly aggregation (SOL-79), and add a cost-controlled Stage B deliberation gate (SOL-80). This phase lays the foundation: define what we measure, build the engine that measures it, and gate when to deliberate on results.

## Codebase map

### Existing regime/intelligence system

- `frontend/components/regimes/ConfidenceBar.tsx` — Regime confidence bar display
- `frontend/components/regimes/` — Other regime components
- `frontend/components/narrative/` — Narrative surfacing (Sanctum, NarrativeCanvas)
- `frontend/components/narrative/Sanctum.tsx` — Main Sanctum surface (hosts ArbitrumChamber, NarrativeFlow)
- `frontend/components/narrative/NarrativeCanvas.tsx` — Narrative flow canvas

### Arbitrum deliberation engine

- `backend-hono/src/services/arbitrum/` — Full deliberation engine (5-seat chamber)
- `backend-hono/src/services/arbitrum/arbitrum-engine.ts` — Core engine
- `backend-hono/src/routes/arbitrum/` — Arbitrum route handlers

### Backend services

- `backend-hono/src/services/` — Various scoring/tracking services
- `backend-hono/src/routes/data/index.ts` — Data routes

## Child tickets

### SOL-78 — S63-T1: Theme Intelligence product contract + KPI lexicon lock (2 pts, Medium)

Branch: `sprint/S63`

**What to do**: Define the product contract for Theme Intelligence. Document:

- What KPIs the system tracks (drift magnitude, confidence, consensus, impact)
- Lexicon: "Theme" vs "Regime", "Impact Vector" vs "Score", "Stage" definitions
- Data model: what fields each KPI has, how they're calculated
- Contracts: input/output shapes for the IPV engine, deliberation gate, and drift model
  Create this as a spec doc in `docs/` or `sprint-md/S63-T1-theme-contract.md`.

**Key files to create**: `sprint-md/S63-T1-theme-contract.md`

**Validation**: Document is reviewed and approved before Phase 2 starts. All downstream tracks (T2-T9) reference this contract.

### SOL-79 — S63-T2: IPV Engine v1 + weekly aggregation (5 pts, High)

Branch: `sprint/S63`

**What to do**: Build the Impact Vector (IPV) engine. This engine:

- Takes scored riskflow items and narrative data as input
- Produces per-theme impact vectors on a weekly aggregation cadence
- Each IPV includes: magnitude (0-100), direction (bullish/bearish/neutral), confidence, contributing catalyst count
- Stores results in a database table for query by the frontend
- Has a clean API endpoint for the frontend to consume

**Key files to create**: `backend-hono/src/services/ipv-engine/`, backend routes for IPV data
**Frontend files**: Likely a new component to display IPV results

**Validation**: Engine runs successfully with sample data. IPV output has correct shape. API returns expected data. `cd backend-hono && bun run build` passes.

### SOL-80 — S63-T3: Stage B cost-controlled deliberation gate (5 pts, High)

Branch: `sprint/S63`

**What to do**: Add a "Stage B" deliberation gate that triggers the 5-seat Arbitrum chamber only when specific cost criteria are met. The gate should:

- Check IPV significance (certain themes above a threshold trigger deliberation)
- Cost-control: prevent runaway API costs by limiting daily deliberation runs
- Gate logic: only deliberate on themes with IPV magnitude > threshold AND delta confidence > threshold
- Expose a health/status endpoint showing gate state, daily budget used, last trigger time

**Key files to touch**: `backend-hono/src/services/arbitrum/` (add gate logic), `backend-hono/src/services/arbitrum/arbitrum-engine.ts` (add pre-deliberation check)

**Validation**: Gate correctly triggers for high-impact themes and suppresses low-impact ones. Budget tracking works. `cd backend-hono && bun run build` passes.

## Execution order (wave sequence)

### Sequential (strict dependency chain)

1. **SOL-78 — Product contract** (T1): Must complete first. The contract defines what the other tracks build to.
2. **SOL-79 — IPV Engine v1** (T2): Starts after T1 contract is locked. Builds the engine that produces impact vectors.
3. **SOL-80 — Stage B gate** (T3): Starts after T2 is stable. The gate consumes IPV output to trigger deliberation.

## Validation

- [ ] Product contract documented and approved
- [ ] IPV engine produces weekly aggregated impact vectors
- [ ] Stage B gate correctly triggers/caps deliberation based on cost rules
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] Add changelog entry

## Reference

- @sprint-md/S43-T7-component-extraction.md — component extraction patterns (for any new UI surfaces)
- `frontend/components/regimes/` — existing regime system being evolved
- `backend-hono/src/services/arbitrum/` — deliberation engine being extended
