# Sprint Brief: S70-T5 -- Human Promotion + Review Controls

## Context

NarrativeFlow should not just show agent conclusions. TP needs explicit controls
to accept, reject, pin, or send a hypothesis back for more research while
keeping rejected decisions auditable.

## Linear Scope

- **Issue**: SOL-135
- **Beta Phase**: Closed Beta
- **Cycle**: Cycle 8
- **Branch Target**: `sprint/S70`
- **Constituent**: @sprint-md/S70-T5-human-promotion-review-controls.md

## Scope -- Included

- [ ] `frontend/components/narrative/NarrativeRoutingGate.tsx`
- [ ] `backend-hono/src/routes/narrative/orchestra.ts`
- [ ] `backend-hono/src/services/narrative-orchestra/review-actions.ts` [new]
- [ ] `backend-hono/src/services/research/task-board.ts` [reuse]

## Scope -- Excluded

- Full NarrativeFlow layout ownership; T4 owns layout.
- Evidence scoring; T2 owns corroboration.
- Replacing the existing research task board.

## Actions

- accept as active narrative
- send back for more research
- reject with reason
- pin to Sanctum
- create research task

## Implementation Steps

1. Add review action service functions with explicit decision reasons.
2. Add route handlers for accept, research, reject, pin, and create task.
3. Wire `Needs more research` to existing `task-board.ts` patterns.
4. Add RoutingGate controls that call the action endpoints and refresh the
   selected hypothesis.
5. Keep labels compact and decisions auditable.

## Acceptance Criteria

- [ ] Human decisions are persisted.
- [ ] Rejected hypotheses remain auditable with a reason.
- [ ] `Needs more research` creates or updates a research task.
- [ ] RoutingGate actions are visible but do not dominate the story surface.

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```
