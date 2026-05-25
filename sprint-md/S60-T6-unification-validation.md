# Sprint Brief: S60-T6 -- Unification + Full Validation

## Context

Tracks T1-T5 land in parallel waves with strict file ownership. T6 is the only track allowed to resolve cross-track integration edges, mount new backend routes, run launchd-managed end-to-end checks, and finalize sprint changelog entry.

## Branch Target

`s60-openagents-plane-loop`

## Dependencies

- Requires T1, T2, T3, T4, and T5 merged first.

## Scope -- Included

- [ ] Resolve merge conflicts between T1-T5 outputs.
- [ ] Mount Plane integration router under `/api/integrations/plane` in root route registration.
- [ ] Verify chat runtime migration works across all chat surfaces.
- [ ] Verify Refinement Plane surface + sidebar chat coexistence.
- [ ] Validate signed inbound + outbound roundtrip.
- [ ] Validate autonomous policy gate blocks deploy without verification pass.
- [ ] Add one consolidated changelog entry.

## Scope -- Excluded (DO NOT TOUCH)

- No feature redesign.
- No new endpoint schema changes unless required to fix integration breakage.
- No deploy to production unless explicitly requested after validation.

## File Ownership

- `backend-hono/src/routes/index.ts`
- `src/lib/changelog.ts`
- Any tiny integration-fix shims required to compile after merge

## Reuse Inventory

- `backend-hono/src/routes/index.ts:367` -- `/api/ai` mount placement reference.
- `backend-hono/src/routes/index.ts:415` -- auth-gated route mounting pattern.
- `frontend/components/layout/MainLayout.tsx:1039` -- global chat panel integration location.
- `frontend/components/layout/TabRenderer.tsx:66` -- Refinement/admin rendering path.

## Known Issues to Preserve

- Preserve RiskFlow reliability fixes logged on 2026-05-05 and 2026-05-06 in changelog.
- Preserve existing Harper/DeepSeek provider defaults.
- Preserve Electron auth popup behavior.

## Implementation Steps

1. Merge T1-T5 in wave order and resolve conflicts.
2. Mount `createPlaneIntegrationRoutes()` (or equivalent) in `backend-hono/src/routes/index.ts`.
3. Run full build checks for frontend and backend.
4. Restart local backend via launchd and run diagnostics.
5. Execute integration smoke:
   - inbound signed webhook accepted,
   - outbound relay signs and sends,
   - policy gate denies deploy when verification fails.
6. Verify UI behavior:
   - Plane in Refinement,
   - sidebar chat still works,
   - chat runtime functional in analysis/sidebar/floating.
7. Append single changelog entry for S60 and final touched files.

## Acceptance Criteria

- [ ] All tracks merged without ownership drift.
- [ ] `/api/integrations/plane/*` routes are mounted and reachable.
- [ ] Frontend + backend builds pass from clean dist.
- [ ] Launchd backend restart + diagnostics pass.
- [ ] End-to-end signed relay roundtrip succeeds.
- [ ] Deploy guard behavior verified.
- [ ] Changelog entry added.

## Validation Commands

```bash
# Frontend
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && cd frontend && bun run build && cd ..

# Backend
cd backend-hono && bun run build && cd ..

# Restart launchd backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Diagnostics
curl -s http://localhost:8080/api/diagnostics
```

## Commit Format

```
[v6.1.0] feat: T6 unify S60 tracks and validate open-agents + Plane autonomous loop
```
