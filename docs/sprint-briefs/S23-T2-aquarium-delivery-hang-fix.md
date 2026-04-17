# Sprint Brief: S23-T2 — Aquarium Delivery Hang Fix

## Context

When a MiroShark simulation completes the deliberation phase and Harper finishes scoring, the frontend KPIs, Analysis paragraph, and Key Findings never refresh. `SanctumHeader` stays on "Updating…" indefinitely. Root cause: `isLoading` at [frontend/components/narrative/Sanctum.tsx:130](../../frontend/components/narrative/Sanctum.tsx#L130) is keyed on the simulation top-level status, but nothing invalidates the `/api/miroshark/latest` query when `deliberationState.phase === "complete"`. Polling fallback is 120s which is both too long and independent of synthesis completion.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] Wire deliberation-phase completion to trigger an immediate refetch of `/api/miroshark/latest`
- [ ] Add a callback/event from [MiroSharkDebatePanel.tsx](../../frontend/components/miroshark/MiroSharkDebatePanel.tsx) → `Sanctum.tsx` the first time `phase === "complete"` is observed
- [ ] Derive `isLoading` in `Sanctum.tsx` to clear when either top-level status flips OR deliberation reaches complete
- [ ] Lower `AquariumPredictionCards` fallback polling from 120s to 30s — as fallback only, not primary path
- [ ] Backend sanity check in [backend-hono/src/routes/miroshark/index.ts](../../backend-hono/src/routes/miroshark/index.ts) and [backend-hono/src/services/miroshark/miroshark-service.ts](../../backend-hono/src/services/miroshark/miroshark-service.ts): confirm `GET /latest` returns the post-synthesis Harper-scored payload (persistent, not in-memory only). If cached only in memory on synthesis completion, add the durable write.

## Scope — Excluded (DO NOT TOUCH)

- Layout/styling — T1 territory
- Harper system prompt — T3 + T4
- Agent memory bank — T4

## Known Issues to Preserve

- Forum deliberation sub-analysts auto-collapse on synthesis (commit `c15abff`). Panel persistence is intentional — don't change collapse behavior.
- 3s deliberation polling cadence is fine — only add the completion event, don't restructure the polling loop.

## Implementation Steps

1. Read [MiroSharkDebatePanel.tsx](../../frontend/components/miroshark/MiroSharkDebatePanel.tsx) to find the phase-polling effect. Track the previous phase in a ref; when transitioning into `"complete"`, fire `props.onSynthesisComplete?.()` exactly once per simulation.
2. In `Sanctum.tsx`, pass `onSynthesisComplete={() => queryClient.invalidateQueries({ queryKey: ["miroshark","latest"] })}` (or equivalent refetch hook if React Query isn't used).
3. Update derived loading: `isLoading = running || (status === "running" && deliberationPhase !== "complete")` so the header spinner clears immediately when synthesis lands.
4. Read [backend-hono/src/services/miroshark/miroshark-service.ts](../../backend-hono/src/services/miroshark/miroshark-service.ts) and confirm the Harper-scored report is written to durable Supabase persistence in the deliberation-completion path (the `getLatestReport` chain must see post-synthesis data). If not, add the write.
5. Lower [frontend/components/narrative/AquariumPredictionCards.tsx:12](../../frontend/components/narrative/AquariumPredictionCards.tsx#L12) from `120_000` to `30_000`.
6. Add changelog entry + file-header comment.

## Acceptance Criteria

- [ ] Trigger a new simulation; within ~3 seconds of Harper scoring completing, KPIs, Analysis, and Key Findings update without manual refresh
- [ ] "Updating…" indicator clears exactly when synthesis lands, not 120s later
- [ ] Fallback 30s poll catches edge cases where the completion event is missed
- [ ] `GET /api/miroshark/latest` consistently returns post-synthesis report after deliberation completes
- [ ] No regression in the 3s deliberation state polling
- [ ] Changelog entry added

## Validation Commands

```bash
cd frontend && npx tsc --noEmit && rm -rf dist && bun run build
cd ../backend-hono && bun run build

# Reload local
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke
curl -s http://localhost:8080/api/miroshark/latest | head
```

## Commit Format

```
[v.04.17.1] feat: S23-T2 aquarium delivery hang fix
```
