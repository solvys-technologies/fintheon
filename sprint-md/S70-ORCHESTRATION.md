# S70 Orchestration -- NarrativeFlow Research Orchestra

- **Parent branch**: `sprint/S70`
- **Cycle**: Cycle 8
- **Beta Phase**: Closed Beta
- **Owner**: Shashank
- **ORCH brief**: @sprint-md/S70-ORCH-narrativeflow-research-orchestra.md
- **Linear ORCH**: SOL-130

## Goal

Rebuild NarrativeFlow as the market story room: a research desk surface where
catalysts become hypotheses, evidence is visible, agents deliberate, consensus
is formed, and only corroborated stories reach the human trader.

## Wave 1 -- Projection Foundation

- @sprint-md/S70-T1-narrative-orchestra-projection-api.md
- @sprint-md/S70-T2-evidence-corroboration-layer.md

T1 owns route, store, and projection shape. T2 owns evidence linking and
corroboration functions. T2 consumes T1 types and must not import route internals.

## Wave 2 -- Agent Bridge

- @sprint-md/S70-T3-agent-deliberation-bridge.md

T3 consumes S69-style lounge outputs when present, but it must work against
fallback projection data while S69 is incomplete.

## Wave 3 -- Surface and Controls

- @sprint-md/S70-T4-narrativeflow-surface-rebuild.md
- @sprint-md/S70-T5-human-promotion-review-controls.md

T4 owns layout and hook ergonomics. T5 owns action persistence and RoutingGate
mutations. Coordinate only through `NarrativeHypothesis` and
`NarrativeRoutingDecision`.

## Wave 4 -- Unification

- @sprint-md/S70-T6-unification-validation-visual-tightening.md

T6 starts only after implementation tracks are reviewable. It is blocked by
S70-T1 through S70-T5.

## Linear Mirror

Linear tickets are required before agent pickup. Every issue must include its
matching `@sprint-md/` constituent path. ORCH tickets are human/runbook context
and should not be picked up by the watcher.

| Issue | Title | Brief |
| --- | --- | --- |
| SOL-130 | S70-ORCH: NarrativeFlow Research Orchestra | @sprint-md/S70-ORCH-narrativeflow-research-orchestra.md |
| SOL-131 | S70-T1: Narrative Orchestra Projection API | @sprint-md/S70-T1-narrative-orchestra-projection-api.md |
| SOL-132 | S70-T2: Evidence Model + Corroboration Layer | @sprint-md/S70-T2-evidence-corroboration-layer.md |
| SOL-133 | S70-T3: Agent Deliberation Bridge | @sprint-md/S70-T3-agent-deliberation-bridge.md |
| SOL-134 | S70-T4: NarrativeFlow Surface Rebuild | @sprint-md/S70-T4-narrativeflow-surface-rebuild.md |
| SOL-135 | S70-T5: Human Promotion + Review Controls | @sprint-md/S70-T5-human-promotion-review-controls.md |
| SOL-136 | S70-T6: Unification, Validation, and Visual Tightening | @sprint-md/S70-T6-unification-validation-visual-tightening.md |

## Validation Gate

- [ ] `cd backend-hono && bun run build`
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json`
- [ ] `rm -rf dist && npx vite build`
- [ ] `/api/narrative/catalysts` smoke
- [ ] `/api/themes` smoke
- [ ] `/api/narrative/orchestra` smoke
- [ ] NarrativeFlow manual smoke with empty, fallback, and populated states
