# Sprint Brief: S70-T3 -- Agent Deliberation Bridge

## Context

S70 depends on S69's autonomous research lifecycle without replacing it.
This track bridges lounge-style deliberation events into NarrativeFlow
hypotheses and keeps the legacy `surface.narrative` catalyst event compatible.

## Linear Scope

- **Issue**: SOL-133
- **Beta Phase**: Closed Beta
- **Cycle**: Cycle 8
- **Branch Target**: `sprint/S70`
- **Constituent**: @sprint-md/S70-T3-agent-deliberation-bridge.md

## Scope -- Included

- [ ] `backend-hono/src/services/narrative-orchestra/lounge-bridge.ts` [new]
- [ ] `backend-hono/src/services/agent-bus/types.ts` [modify only if topics are missing]
- [ ] `frontend/contexts/NarrativeContext.tsx` [consume richer narrative events]
- [ ] `frontend/hooks/useAgentBusSSE.ts` [read-only pattern]

## Scope -- Excluded

- Lounge gatherer, deliberation engine, and output router implementation.
- NarrativeFlow visual rebuild.
- Review action endpoints.

## Reuse Inventory

- `backend-hono/src/services/agent-bus/types.ts` -- current
  `surface.narrative` topic and `NarrativePushEvent`.
- `backend-hono/src/services/agent-bus/bus.ts` -- publish/subscribe pattern.
- `frontend/contexts/NarrativeContext.tsx` -- legacy catalyst SSE handling.
- `sprint-md/S69-T5-deliberation-engine.md` -- source lifecycle for reflections.
- `sprint-md/S69-T6-output-router.md` -- source lifecycle for routing decisions.

## Implementation Steps

1. Add a typed `hypothesis-updated` payload without breaking
   `catalyst-discovered`.
2. Create bridge helpers that map lounge brief, reflection, consensus, and
   routing events into `NarrativeDeliberationEntry` updates.
3. Update NarrativeContext to ignore unknown richer events safely until the new
   hook consumes them.
4. Preserve the legacy catalyst dispatch path exactly.

## Acceptance Criteria

- [ ] NarrativeFlow can show agent reflections for a hypothesis.
- [ ] `surface.narrative` carries legacy `catalyst-discovered` or new
  `hypothesis-updated` events.
- [ ] Legacy catalyst SSE remains compatible.

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
cd backend-hono && bun run build
```
