# S63-ORCH Phase 3 — Theme Intelligence: Explainability + Ramp

- **Parent sprint branch**: `sprint/S63`
- **Cycle**: Cycle 8 (Closed Beta)
- **Due**: June 6
- **Milestone**: Phase 3 — Explainability + Ramp
- **Owner**: Shashank

## What this covers

Phase 3 of the Theme Intelligence refactor. Add KPI explainability UX so users can understand why the system scored a theme the way it did (SOL-84), build the Stage C external enrichment gate that brings in third-party data (SOL-85), and add observability + success metrics to track system health (SOL-86).

## Codebase map

### Frontend surfaces

- `frontend/components/narrative/NarrativeCanvas.tsx` — Narrative canvas (refactored in Phase 2, extended here)
- `frontend/components/narrative/Sanctum.tsx` — Sanctum surface
- `frontend/components/regimes/` — Regime system components
- `frontend/components/arbitrum/` — Arbitrum components (may need KPI explainability integration)
- `frontend/components/chat/slots/CatalystCardSlot.tsx` — Catalyst card in chat
- `frontend/components/journal/KPICard.tsx` — Existing KPI card pattern

### Backend

- `backend-hono/src/services/arbitrum/` — Deliberation engine
- `backend-hono/src/services/riskflow/` — RiskFlow scoring
- `backend-hono/src/services/ipv-engine/` — IPV engine (built in Phase 1)
- `backend-hono/src/services/theme-tracker/` — Theme tracker (built in Phase 2)
- `backend-hono/src/services/brief-generator.ts` — Brief generation (for KPI summaries)
- `backend-hono/src/routes/` — API routes

### Observability

- `backend-hono/src/services/` — All services (add metrics)
- `backend-hono/src/boot/services.ts` — Service boot (registration)
- `backend-hono/src/config/feature-flags.ts` — Feature flags

## Child tickets

### SOL-84 — S63-T7: KPI explainability UX (3 pts, Medium)

Branch: `sprint/S63`

**What to do**: Build a UI that explains why the theme intelligence system scored a theme the way it did. For each theme/IPV, show:

- What factors contributed to the score (contributing catalysts, their weight, sentiment)
- How confidence was determined (consensus, recency, volatility)
- Why drift was detected (which catalysts drifted, by how much)
- A visual breakdown (radial or bar chart showing factor contributions)
  The explainability panel should be accessible from the NarrativeFlow surface and any catalyst card that displays IPV data.

**Key files to create**: Frontend KPI explainability panel component
**Key files to touch**: `frontend/components/narrative/NarrativeCanvas.tsx` (add explainability trigger), `frontend/components/chat/slots/CatalystCardSlot.tsx` (add explainability link), `frontend/components/arbitrum/VerdictCard.tsx` (add KPI context if appropriate)

**Validation**: Clicking "explain" on a theme/IPV shows the breakdown panel with meaningful factor contributions. Numbers are accurate (match backend calculations).

### SOL-85 — S63-T8: Stage C external enrichment gate (3 pts, Medium)

Branch: `sprint/S63`

**What to do**: Build the Stage C enrichment gate that fetches external data to enrich theme intelligence. Stage C runs after Stage B deliberation (when a theme is deemed significant). Enrichment sources may include:

- News/research APIs for additional context
- Market data for price-aligned confirmation
- Social sentiment for narrative validation
  The gate should:
- Have a configurable enrichment provider list
- Cache enriched data to avoid redundant API calls
- Append enrichment results to the theme data model
- Have a configurable timeout/fail-open policy (don't block on enrichment failure)

**Key files to create**: `backend-hono/src/services/enrichment-gate/` (Stage C gate + provider adapters)
**Key files to touch**: `backend-hono/src/services/arbitrum/arbitrum-engine.ts` (add Stage C trigger after deliberation), `backend-hono/src/config/feature-flags.ts` (add enrichment feature flag)

**Validation**: Enrichment gate runs after Stage B deliberation. Enriched data appears in theme model. Gate fails open on provider errors.

### SOL-86 — S63-T9: Observability + success metrics (3 pts, Medium)

Branch: `sprint/S63`

**What to do**: Add observability and success metrics for the Theme Intelligence system:

- Track: IPV engine run times, deliberation gate triggers, enrichment successes/failures
- Track: phase transition rates (Stage A → B → C)
- Track: API endpoint latency for theme endpoints
- Expose a `/api/themes/metrics` endpoint with summary stats
- Add a diagnostics endpoint `/api/diagnostics` entry for Theme Intelligence status
- Frontend: add a simple metrics display (toggleable, for admin use)

**Key files to create**: Observability service for theme intelligence metrics
**Key files to touch**: `backend-hono/src/services/ipv-engine/`, `backend-hono/src/services/arbitrum/`, `backend-hono/src/services/theme-tracker/`, `backend-hono/src/routes/` (API), `backend-hono/src/routes/diagnostics/`

**Validation**: `/api/themes/metrics` returns expected data. `/api/diagnostics` shows Theme Intelligence health. Frontend metrics display works.

## Execution order (wave sequence)

### Parallel (all three can run independently)

All three tickets are independent and build on the Phase 1+2 foundation:

- SOL-84 — KPI explainability (frontend-only, consumes IPV/theme data)
- SOL-85 — Stage C enrichment gate (backend-only, post-deliberation)
- SOL-86 — Observability (cross-cutting, can be done last)

Recommended order:

1. **SOL-84 — KPI explainability**: Highest user-facing value
2. **SOL-86 — Observability**: Needed to verify system health
3. **SOL-85 — Stage C enrichment**: Nice-to-have enhancement

## Validation

- [ ] KPI explainability panel shows factor breakdown for each theme
- [ ] Stage C enrichment gate enriches themes with external data
- [ ] Observability metrics are tracked and exposed via `/api/themes/metrics`
- [ ] `/api/diagnostics` includes Theme Intelligence health
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `npx vite build` passes
- [ ] Add changelog entry

## Handoff to Developer (Shashank)

This file is your single entry point for the S63-ORCH Phase 3 — Theme Intelligence work. All three tickets can run in parallel after Phase 1+2 foundations are stable.

**To execute:**

1. Read this entire plan file for codebase map and context
2. All three tickets are independent; recommended order: SOL-84 (KPI explainability) → SOL-86 (observability) → SOL-85 (Stage C enrichment)
3. Each child ticket in Linear has enriched context with specific files and validation steps
4. After each ticket, run the validation steps listed in this file
5. Phases 1 and 2 must be complete and deployed before starting Phase 3 (IPV engine, Theme Tracker, NarrativeFlow refactor are prerequisites)
6. Add changelog entries to `src/lib/changelog.ts` after each ticket

**Branch**: `sprint/S63` | **Cycle**: Cycle 8 (Closed Beta) | **Due**: June 6 | **Milestone**: Phase 3

## Reference

- @sprint-md/S63-ORCH-theme-intelligence-phase-1.md — Phase 1 (contract, IPV engine, Stage B gate)
- @sprint-md/S63-ORCH-theme-intelligence-phase-2.md — Phase 2 (drift, theme tracker, NarrativeFlow refactor)
- `frontend/components/narrative/` — Main narrative surfaces
- `backend-hono/src/services/arbitrum/` — Deliberation engine
