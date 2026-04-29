# Sprint Brief: T3 -- Arbitrum Surface Pass (Sanctum/Aquarium/Peek)

## Context

Sprint intent includes visible Arbitrum updates. This track verifies and implements missing Arbitrum surface improvements across Sanctum/Aquarium/peek/chamber states while preserving current engine behavior. This is UI/state polish and consistency, not backend architecture change.

## Branch Target

`s51-cards-and-arbitrum`

## Scope -- Included

- [ ] Audit current Arbitrum UI behavior on local desktop surfaces.
- [ ] Implement missing UI/state refinements for loading/empty/error/polish.
- [ ] Confirm shared data-source behavior across chamber and peek surfaces.
- [ ] Fix confirmed gaps only, no speculative rewrites.

## Scope -- Excluded (DO NOT TOUCH)

- `backend-hono/src/services/arbitrum/*`
- `backend-hono/src/routes/arbitrum.ts`
- `frontend/components/RiskFlowMini.tsx`
- `mobile/components/riskflow/*`
- `src/lib/changelog.ts` (owned by T4 only)

## File Ownership

- `frontend/components/arbitrum/ArbitrumChamber.tsx`
- `frontend/components/arbitrum/ArbitrumPeek.tsx`
- `frontend/components/narrative/Sanctum.tsx`
- `frontend/hooks/useArbitrumLatest.ts` (only if required by confirmed UI gap)

## Reuse Inventory (existing code to call, not reinvent)

- `useArbitrumLatest()` for latest verdict fetch + state lifecycle.
- Existing chamber seat rendering/state wrappers in `ArbitrumChamber.tsx`.
- Existing Sanitized loader/error primitives used across frontend.

## Known Issues to Preserve

- Keep seat composition and routing assumptions untouched (5-seat chamber behavior preserved).
- No provider/model remapping in this track.
- Preserve Solvys visual language: no gradients, no emojis, no Kanban stripes.

## Implementation Steps

1. Perform local walkthrough:
   - Sanctum Aquarium panel,
   - Arbitrum chamber,
   - peek/hover surfaces,
   - loading-empty-error transitions.
2. Log concrete gaps and patch only those files in ownership list.
3. Remove stale props/paths if proven unused and causing drift.
4. Verify no behavior regression in verdict rendering and state transitions.

## Acceptance Criteria

- [ ] Arbitrum surfaces show visible improvements in local desktop runtime.
- [ ] Loading/empty/error states are complete and visually consistent.
- [ ] No data-source divergence between Arbitrum surface consumers.
- [ ] No backend behavior/model routing regressions introduced.

## Validation Commands

```bash
# Frontend checks
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# API smoke
curl -s http://localhost:8080/api/arbitrum/latest | jq '.'
```

## Commit Format

```text
[v.5.29.3] feat: S52-T3 Arbitrum Sanctum/Aquarium surface pass
```
