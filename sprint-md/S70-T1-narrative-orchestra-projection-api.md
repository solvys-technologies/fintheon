# Sprint Brief: S70-T1 -- Narrative Orchestra Projection API

## Context

NarrativeFlow needs a backend projection that turns existing Theme Tracker,
RiskFlow catalysts, and future S69 lounge outputs into research hypotheses. This
track creates the contract and read endpoint only; it does not own the full S69
research pipeline or frontend rebuild.

## Linear Scope

- **Issue**: SOL-131
- **Beta Phase**: Closed Beta
- **Cycle**: Cycle 8
- **Branch Target**: `sprint/S70`
- **Constituent**: @sprint-md/S70-T1-narrative-orchestra-projection-api.md

## Scope -- Included

- [ ] `backend-hono/src/services/narrative-orchestra/types.ts` [new]
- [ ] `backend-hono/src/services/narrative-orchestra/store.ts` [new]
- [ ] `backend-hono/src/services/narrative-orchestra/projector.ts` [new]
- [ ] `backend-hono/src/routes/narrative/orchestra.ts` [new]
- [ ] `backend-hono/src/routes/narrative/index.ts` [modify]

## Scope -- Excluded

- S69 lounge ingestion and deliberation internals.
- Frontend NarrativeFlow layout.
- Existing `/api/narrative/catalysts` behavior.
- Human review actions; owned by S70-T5.

## Reuse Inventory

- `backend-hono/src/routes/narrative/handlers.ts` -- current catalyst APIs.
- `backend-hono/src/services/theme-tracker/` -- existing theme, IPV, and trajectory data.
- `backend-hono/src/services/riskflow/` -- catalyst and headline source data.
- `frontend/lib/narrative-store.ts` -- legacy local narrative shape to preserve.

## Implementation Steps

1. Define `NarrativeHypothesis`, `NarrativeEvidence`,
   `NarrativeDeliberationEntry`, and `NarrativeRoutingDecision` interfaces.
2. Build a store module that can return fallback in-memory projections when
   lounge tables or live data are missing.
3. Build a projector that maps Theme Tracker themes and promoted RiskFlow
   catalysts into hypotheses with empty deliberation summaries.
4. Add `GET /api/narrative/orchestra` under the existing narrative route mount.
5. Keep `/api/narrative/catalysts` untouched and compatible.

## Acceptance Criteria

- [ ] `GET /api/narrative/orchestra` returns hypotheses with evidence,
  deliberation summary, and routing decision.
- [ ] Missing S69 lounge data falls back to Theme Tracker plus promoted RiskFlow
  catalysts.
- [ ] Existing narrative catalyst routes remain unchanged.
- [ ] Files stay under 300 lines or are split.

## Validation Commands

```bash
cd backend-hono && bun run build
curl -s http://localhost:8080/api/narrative/orchestra | head -c 500
```
