# Sprint Brief: T4 — NarrativeMap Pan Persistence + Sanctum Nav

## Context

Fix NarrativeMap pan/zoom state persistence and integrate with Sanctum navigation. The current `NarrativeMap.tsx` has layout save/restore stubs with a TODO comment about saving canvas pan position. `NarrativeCanvas.tsx` has a `cameraRef` but no persistence. This track completes the persistence layer and ensures smooth navigation between NarrativeFlow and other Sanctum pages. Runs in parallel with T2 after T1's API contract is locked.

## Branch Target

`sprint/S68`

## Scope — Included

- [ ] `frontend/components/narrative/NarrativeMap.tsx` (773 lines) — Complete pan persistence, add reset view button
- [ ] `frontend/components/narrative/NarrativeCanvas.tsx` (326 lines) — Add camera state persistence to localStorage
- [ ] `frontend/components/narrative/Sanctum.tsx` (460 lines) — Smooth nav transitions
- [ ] `frontend/lib/narrative-zoom.ts` — May need camera state serialization helpers

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/` — no backend changes
- `frontend/components/narrative/CatalystCard.tsx` — owned by T2/T3
- `frontend/contexts/NarrativeContext.tsx` — keep as-is

## Reuse Inventory

- `NarrativeMap.tsx:143` — `LAYOUT_KEY = "fintheon:narrative-map-layout"` existing key
- `NarrativeMap.tsx:145-157` — `handleSaveLayout` with TODO about saving canvas pan position
- `NarrativeMap.tsx:159-171` — `handleResetLayout` stub
- `NarrativeCanvas.tsx:42` — `cameraRef = useRef<CameraState>({ x: 0, y: 0, scale: 1 })`
- `NarrativeCanvas.tsx:264-284` — `handleWheel` for zoom, already manipulates camera
- `NarrativeCanvas.tsx:187-211` — `handleMouseDown/Move` for pan, already manipulates camera
- `frontend/lib/narrative-zoom.ts` — `CameraState` type, `fitToView`, `clampScale`

## Known Issues to Preserve

- Camera state key format: `narrativeflow:camera:{symbol}`
- Do not break existing layout save/restore for visibleLaneIds and activeTags
- Follow Solvys UI constraints: no gradients, no emojis, no Kanban borders, no AI sparkles

## Implementation Steps

1. In `NarrativeCanvas.tsx`, add camera persistence:
   - On unmount or before page switch: save `cameraRef.current` to localStorage with key `narrativeflow:camera:{symbol}`
   - On mount: restore camera state from localStorage if exists
   - Use `useEffect` cleanup function for save-on-unmount
   - Add `useBeforeUnload` or custom event listener for save-on-nav

2. In `NarrativeMap.tsx`, complete `handleSaveLayout`:
   - Add camera state to the saved layout object
   - Need to get camera state from NarrativeForceCanvas — either expose via ref or callback
   - Current `onScaleChange={setCanvasScale}` exists; add `onCameraChange` callback

3. Complete `handleResetLayout`:
   - Add camera state restoration from saved layout
   - Add explicit "Reset View" button that clears camera state and resets to default

4. Add "Reset View" button to the floating toolbar or top-right control area:
   - Clear localStorage camera key
   - Reset camera to `{ x: 0, y: 0, scale: 1 }`
   - Animate the reset (not instant)

5. In `Sanctum.tsx`, add smooth transitions:
   - When switching to/from NarrativeFlow page, use CSS transition for opacity/transform
   - Ensure `scrollToPage` behavior is smooth (`prefers-reduced-motion` respected)
   - Add a brief loading state if theme data needs to load

6. Ensure `NarrativeMap` force canvas and `NarrativeCanvas` bubble canvas share state correctly:
   - Both use `NarrativeContext` for lane/catalyst state
   - Camera state should be independent per surface (map vs canvas)

## Acceptance Criteria

- [ ] Pan position persists when user navigates away from NarrativeFlow and returns
- [ ] Zoom level persists across page switches
- [ ] "Reset View" button restores default camera position with animation
- [ ] Camera state is saved to localStorage with key `narrativeflow:camera:{symbol}`
- [ ] Sanctum nav transitions smoothly between pages
- [ ] No state loss when themes change while viewing NarrativeFlow
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build
```

## Commit Format

```
[v6.5.0] feat: S68-T4 narrativemap pan persistence and sanctum nav
```
