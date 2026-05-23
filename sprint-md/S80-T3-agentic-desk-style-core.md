# Sprint Brief: S80-T3 -- Agentic Desk Style Core

## Context

Each Trading Desk should be able to train Fintheon's agents to think like that desk without doing actual model training in S80. This track creates a thin, structured desk style layer that Harper and Oracle can read as compact context: house bias, archetype mix, preferred evidence, risk posture, and forbidden claims.

## Linear Scope

- **Issue naming**: `S80-T3: Agentic Desk Style Core`
- **Beta Phase**: Closed Beta
- **Linear Project**: Coliseum: Desk Forecasting & Social Intelligence
- **Linear Initiative**: Beta Closed
- **Cycle**: Beta Closed
- **Due date**: 2026-05-30
- **Assigned owner**: local Solvys Agent
- **Brief reference**: `@sprint-md/S80-T3-agentic-desk-style-core.md`

## Branch Target

`sprint/S80`

## Scope -- Included

- [ ] Add desk agent style storage tied to `narrative_desks`.
- [ ] Add `/api/coliseum/desks/:deskId/agent-style` read/write routes.
- [ ] Support fields: archetype mix, house bias, preferred evidence sources, risk posture, time horizon, forbidden claims, compact custom instruction.
- [ ] Inject compact desk style context into `backend-hono/src/services/desk-context/preflight.ts`.
- [ ] Apply the injected context for Harper and Oracle first.
- [ ] Add a small profile/settings UI for closed beta users to edit style.

## Scope -- Excluded

- Fine-tuning, embeddings training, or persistent model weights.
- Rewriting global agent instructions.
- Per-seat Arbitrum override redesign.
- Public display of all custom instructions.

## Implementation Notes

- Keep the custom instruction short and bounded.
- Label the preflight section `Desk Style`.
- Treat style as context, not as higher-priority system instruction.
- Prefer stable structured values over long free-form prompt dumps.

## Acceptance Criteria

- [ ] Desk style can be saved and fetched.
- [ ] Harper/Oracle preflight includes a concise `Desk Style` section when configured.
- [ ] Missing style falls back cleanly.
- [ ] Invalid or oversized style fields are rejected.
- [ ] UI uses compact labels and does not over-explain.

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
git diff --check
```

## Commit Format

```bash
[v6.7.11] feat: S80-T3 agentic desk style core
```
