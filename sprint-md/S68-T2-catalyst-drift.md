# Sprint Brief: T2 — Catalyst Drift Model + Drift Bubble UI

## Context

Build a Catalyst Drift model that tracks how a theme's narrative shifts over time. Drift measures the divergence between a theme's current IPV and its historical trajectory. This is consumed by T3 (Surface refactor) for drift indicators on catalyst cards and theme headers. Runs in parallel with T4 after T1's API contract is locked.

## Branch Target

`sprint/S68`

## Scope — Included

- [ ] `backend-hono/src/services/catalyst-drift/types.ts` [NEW] — DriftResult, DriftDirection types
- [ ] `backend-hono/src/services/catalyst-drift/drift-calculator.ts` [NEW] — Drift calculation logic
- [ ] `backend-hono/src/services/catalyst-drift/index.ts` [NEW] — Service export
- [ ] `backend-hono/src/routes/themes/handlers.ts` — Wire drift endpoint (created by T1)
- [ ] `frontend/components/narrative/DriftBubble.tsx` [NEW] — Visual bubble component
- [ ] `frontend/components/narrative/ThemeHeader.tsx` — Integrate drift indicator into theme header

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/theme-tracker/` — owned by T1, treat as read-only dependency
- `frontend/components/narrative/NarrativeCanvas.tsx` — owned by T3
- `frontend/components/narrative/NarrativeMap.tsx` — owned by T4

## Reuse Inventory

- `backend-hono/src/services/theme-tracker/theme-tracker.ts` (T1) — provides theme trajectory data for drift calculation
- `backend-hono/src/services/desk-drift/` — existing drift service, model structure after this
- `frontend/components/narrative/CatalystCard.tsx` (94 lines) — where drift bubbles will be integrated
- `frontend/lib/narrative-physics.ts` (219 lines) — physics engine, may need drift-aware bubble sizing

## Known Issues to Preserve

- Drift endpoint must match the contract T1 stubs: `GET /api/themes/:id/drift`
- Follow Solvys UI constraints: no gradients, no emojis, no Kanban borders, no AI sparkles

## Implementation Steps

1. Create `backend-hono/src/services/catalyst-drift/types.ts` with DriftResult: themeId, magnitude (0-1), direction (positive/negative/neutral), confidence (0-1), period (N trailing periods used), currentIPV, historicalAvgIPV.
2. Create `backend-hono/src/services/catalyst-drift/drift-calculator.ts` with:
   - `calculateDrift(themeId, trailingPeriods)`: fetches theme trajectory from Theme Tracker, computes trailing N-period average, compares to current IPV.
   - Drift magnitude = |currentIPV - historicalAvg| / max(historicalAvg, 0.01)
   - Drift direction = currentIPV > historicalAvg ? "positive" : currentIPV < historicalAvg ? "negative" : "neutral"
   - Confidence = min(dataPoints / trailingPeriods, 1.0)
3. Wire drift calculator into `backend-hono/src/routes/themes/handlers.ts` to replace T1's stub for `GET /api/themes/:id/drift`.
4. Create `frontend/components/narrative/DriftBubble.tsx`:
   - Color-coded: positive=gold (`#c79f4a`), negative=red (`#ef4444`), neutral=gray (`#6b7280`)
   - Size proportional to confidence (radius 4px to 12px)
   - Pulse animation for magnitude > 0.5 (CSS keyframe, no box-shadow per Solvys rules — use opacity animation)
   - Tooltip on hover showing magnitude, direction, confidence
5. Create `frontend/components/narrative/ThemeHeader.tsx`:
   - Theme name, IPV score, status badge (from T1), drift bubble (from this track)
   - Layout: `[Theme Name]  [IPV: 0.73]  [Active]  [DriftBubble]`
6. Update `CatalystCard.tsx` to accept optional `drift` prop and render small drift indicator.

## Acceptance Criteria

- [ ] `GET /api/themes/:id/drift` returns valid DriftResult with magnitude, direction, confidence
- [ ] Drift values are sensible for sample data (e.g., rising IPV = positive drift, flat = neutral)
- [ ] `DriftBubble` renders with correct color, size, and pulse animation
- [ ] `ThemeHeader` displays theme name, IPV, status badge, and drift indicator
- [ ] `CatalystCard` shows drift indicator when drift prop is provided
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

# Drift smoke test
curl -s http://localhost:8080/api/themes/test-theme-id/drift | head -c 500
```

## Commit Format

```
[v6.5.0] feat: S68-T2 catalyst drift model and drift bubble UI
```
