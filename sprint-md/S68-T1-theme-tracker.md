# Sprint Brief: T1 — Replace Regime Tracker with Theme Tracker

## Context

NarrativeFlow currently relies on the Regime Tracker system (`backend-hono/src/services/regime/`) to classify market conditions. This is being replaced with a Theme Tracker that manages active market themes with Impact Probability Value (IPV) scores, associated catalysts, drift state, and lifecycle status (Active / Decaying / Resolved). This is the foundation track — T2 (Drift) and T3 (Surface refactor) both consume its API. No other track can run until T1 lands.

## Branch Target

`sprint/S68`

## Scope — Included

- [ ] `backend-hono/src/services/theme-tracker/types.ts` [NEW] — Theme, ThemeStatus, ThemeIPV, ThemeTrajectory types
- [ ] `backend-hono/src/services/theme-tracker/theme-tracker.ts` [NEW] — Core tracker logic: create, update, score, expire themes
- [ ] `backend-hono/src/services/theme-tracker/persistence.ts` [NEW] — In-memory store (Supabase later)
- [ ] `backend-hono/src/routes/themes/index.ts` [NEW] — Route registration
- [ ] `backend-hono/src/routes/themes/handlers.ts` [NEW] — API handlers
- [ ] `frontend/hooks/useThemes.ts` [NEW] — Theme data hook
- [ ] `frontend/components/narrative/ThemeStatusBadge.tsx` [NEW] — Status badge component (Active=gold, Decaying=amber, Resolved=muted)
- [ ] Deprecate `backend-hono/src/services/regime/` — regime-detector.ts, regime-service.ts, propose.ts
- [ ] Deprecate `backend-hono/src/routes/regime/` — handlers.ts, index.ts, proposals.ts
- [ ] Deprecate `backend-hono/src/routes/regimes/` — index.ts

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/riskflow/` — source of catalyst data, leave alone
- `frontend/components/narrative/NarrativeCanvas.tsx` — owned by T3
- `frontend/components/narrative/NarrativeMap.tsx` — owned by T4
- `frontend/lib/narrative-physics.ts` — owned by T3/T5
- Drift model — owned by T2

## Reuse Inventory

- `backend-hono/src/services/regime/regime-service.ts` — existing regime service to model Theme Tracker after
- `backend-hono/src/services/regime/regime-detector.ts` — detection logic to migrate into theme-tracker.ts
- `backend-hono/src/routes/narrative/index.ts` — existing narrative route pattern to follow
- `backend-hono/src/routes/riskflow/` — catalyst data source that themes will reference
- `frontend/contexts/NarrativeContext.tsx` — narrative state that will eventually consume theme data
- `frontend/components/narrative/useIVScoreData.ts` — existing IV data hook pattern to follow for useThemes.ts

## Known Issues to Preserve

- Regime routes may still be referenced by other services — add deprecation comments, do not delete imports that break other code
- Theme Tracker API must be backward-compatible where regime data is consumed elsewhere
- Follow Solvys UI constraints: no gradients, no emojis, no Kanban borders, no AI sparkles
- Backend is launchd-managed on port 8080

## Implementation Steps

1. Create `backend-hono/src/services/theme-tracker/types.ts` with Theme interface: id, name, ipv (0-1), status (Active/Decaying/Resolved), catalystIds, createdAt, updatedAt, trajectory (array of {timestamp, ipv}).
2. Create `backend-hono/src/services/theme-tracker/persistence.ts` with in-memory Map-based store. Add CRUD operations: createTheme, getTheme, listThemes, updateTheme, deleteTheme, addCatalyst, removeCatalyst.
3. Create `backend-hono/src/services/theme-tracker/theme-tracker.ts` with core logic: computeIPV from catalyst severity weights, transitionStatus based on IPV decay over time, getTrajectory.
4. Create `backend-hono/src/routes/themes/handlers.ts` with handlers for all 6 endpoints.
5. Create `backend-hono/src/routes/themes/index.ts` wiring routes:
   - `GET /api/themes` — List all active themes with IPV + status
   - `GET /api/themes/:id` — Single theme detail with catalysts
   - `POST /api/themes` — Create theme (admin/agent)
   - `PATCH /api/themes/:id` — Update theme status/metadata
   - `GET /api/themes/:id/catalysts` — Catalysts for a theme
   - `GET /api/themes/:id/drift` — Drift data stub (returns empty, T2 fills this in)
6. Register theme routes in the main app router (`backend-hono/src/index.ts` or equivalent).
7. Add deprecation comments to `backend-hono/src/services/regime/` files and `backend-hono/src/routes/regime/` files. Do not delete — preserve for migration reference.
8. Create `frontend/hooks/useThemes.ts` — fetches from `/api/themes`, returns `{ themes, isLoading, error }`.
9. Create `frontend/components/narrative/ThemeStatusBadge.tsx` — renders status with color: Active=`var(--fintheon-accent)`, Decaying=amber, Resolved=muted.
10. Update any `frontend/components/regimes/` references to point to new theme data source if they exist.

## Acceptance Criteria

- [ ] `GET /api/themes` returns list of themes with IPV, status, catalyst count
- [ ] `GET /api/themes/:id` returns single theme with full detail and catalyst list
- [ ] `POST /api/themes` creates a theme and returns it
- [ ] `PATCH /api/themes/:id` updates theme status and metadata
- [ ] `GET /api/themes/:id/catalysts` returns catalysts associated with a theme
- [ ] `GET /api/themes/:id/drift` returns stub (T2 will implement)
- [ ] Regime service files have deprecation comments
- [ ] `useThemes.ts` hook fetches and caches theme data
- [ ] `ThemeStatusBadge` renders correct colors for each status
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Smoke test
curl -s http://localhost:8080/api/themes | head -c 500
```

## Commit Format

```
[v6.5.0] feat: S68-T1 replace regime tracker with theme tracker
```
