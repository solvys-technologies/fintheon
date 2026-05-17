# Sprint Brief: S70-T4 -- NarrativeFlow Surface Rebuild

## Context

This track turns NarrativeFlow from an overlay list and ambient canvas into a
research-room interface. The first viewport should read as an active desk:
story spine, evidence constellation, agent rail, and routing gate.

## Linear Scope

- **Issue**: SOL-134
- **Beta Phase**: Closed Beta
- **Cycle**: Cycle 8
- **Branch Target**: `sprint/S70`
- **Constituent**: @sprint-md/S70-T4-narrativeflow-surface-rebuild.md

## Scope -- Included

- [ ] `frontend/components/narrative/NarrativeCanvas.tsx` [split]
- [ ] `frontend/components/narrative/NarrativeStorySpine.tsx` [new]
- [ ] `frontend/components/narrative/NarrativeEvidenceConstellation.tsx` [new]
- [ ] `frontend/components/narrative/NarrativeAgentRail.tsx` [new]
- [ ] `frontend/components/narrative/NarrativeRoutingGate.tsx` [new]
- [ ] `frontend/hooks/useNarrativeOrchestra.ts` [new]

## Scope -- Excluded

- Backend projection endpoint internals.
- Human action persistence; T5 owns action endpoints and mutations.
- Removing legacy NarrativeMap behavior unless it blocks the new surface.

## Reuse Inventory

- `frontend/components/narrative/NarrativeCanvas.tsx` -- current host, over 300
  lines and must be split.
- `frontend/components/narrative/NarrativeMap.tsx` -- ambient spatial context.
- `frontend/components/narrative/ThemeHeader.tsx` -- compact theme metadata.
- `frontend/components/narrative/ThemeCatalystGroup.tsx` -- catalyst grouping.
- `frontend/components/narrative/DriftBubble.tsx` -- trajectory visual.

## Design Rules

- Warm near-black canvas, Solvys Gold accent, warm off-white text.
- No gradients, AI sparkles, Kanban borders, or explanatory marketing copy.
- Compact labels and honest empty states.
- Cards only for repeated evidence items or deliberation entries.

## Implementation Steps

1. Create `useNarrativeOrchestra` for the new endpoint with fallback and error
   states.
2. Split `NarrativeCanvas` into shell plus dedicated story, evidence, agent,
   and gate components.
3. Keep existing canvas physics as ambient context only if it does not obscure
   the research workflow.
4. Ensure selecting a story updates all zones without leaving NarrativeFlow.
5. Add responsive constraints so text does not overlap in desktop or mobile
   widths.

## Acceptance Criteria

- [ ] First viewport reads as an active research desk.
- [ ] Selecting a story reveals evidence, agent deliberation, and routing status.
- [ ] Empty, fallback, and populated states are compact and honest.
- [ ] No banned visual ornaments.

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```
