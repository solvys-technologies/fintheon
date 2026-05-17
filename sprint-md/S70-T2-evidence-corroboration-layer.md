# Sprint Brief: S70-T2 -- Evidence Model + Corroboration Layer

## Context

NarrativeFlow must show why a market story is credible or fragile. This track
adds stance-aware evidence grouping and an explainable corroboration score that
S70-T1 can expose through the projection endpoint.

## Linear Scope

- **Issue**: SOL-132
- **Beta Phase**: Closed Beta
- **Cycle**: Cycle 8
- **Branch Target**: `sprint/S70`
- **Constituent**: @sprint-md/S70-T2-evidence-corroboration-layer.md

## Scope -- Included

- [ ] `backend-hono/src/services/narrative-orchestra/evidence-linker.ts` [new]
- [ ] `backend-hono/src/services/narrative-orchestra/corroboration.ts` [new]
- [ ] `backend-hono/src/services/theme-tracker/` [read-only or narrow adapter]
- [ ] `backend-hono/src/services/riskflow/` [read-only dependency]

## Scope -- Excluded

- Route registration; owned by S70-T1.
- Agent deliberation bridge; owned by S70-T3.
- Human routing mutations; owned by S70-T5.

## Reuse Inventory

- `backend-hono/src/services/theme-tracker/` -- theme catalyst source.
- `backend-hono/src/services/riskflow/` -- live headline and catalyst source.
- `backend-hono/src/services/narrative-orchestra/types.ts` -- contract from T1.

## Implementation Steps

1. Link RiskFlow catalyst IDs and theme catalyst IDs to a shared hypothesis ID.
2. Group evidence by `supports`, `contradicts`, and `neutral`.
3. Compute corroboration from count, stance mix, recency, and confidence.
4. Return a compact explanation string or factor list with the score.
5. Export pure functions that T1 can call without importing route internals.

## Acceptance Criteria

- [ ] Evidence can be grouped by stance.
- [ ] RiskFlow catalysts and theme catalyst IDs resolve to the same hypothesis.
- [ ] Corroboration score is explainable from evidence factors.
- [ ] No hidden product ownership shift from NarrativeFlow to Theme Tracker.

## Validation Commands

```bash
cd backend-hono && bun run build
```
