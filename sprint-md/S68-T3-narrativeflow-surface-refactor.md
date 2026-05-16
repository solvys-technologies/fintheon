# Sprint Brief: T3 — NarrativeFlow Surface Refactor to Impact Intelligence

## Context

Refactor the NarrativeFlow surface from a general narrative display into an impact-intelligence-focused surface. This is the main user-facing deliverable of S68. Catalyst cards are reorganized by theme impact (highest IPV first), theme headers display IPV + drift + status, and the visual hierarchy is streamlined. Depends on T1 (Theme Tracker API) and T2 (Drift indicators).

## Branch Target

`sprint/S68`

## Scope — Included

- [ ] `frontend/components/narrative/NarrativeCanvas.tsx` (326 lines) — Reorganize from bubble physics to impact-intelligence layout
- [ ] `frontend/components/narrative/Sanctum.tsx` (460 lines) — Add filter controls, wire theme data through
- [ ] `frontend/components/narrative/ThemeHeader.tsx` — Theme section header with IPV + drift + status (T2 provides drift)
- [ ] `frontend/components/narrative/ThemeCatalystGroup.tsx` [NEW] — Grouped catalyst list per theme
- [ ] `frontend/components/narrative/NarrativeFlowFilterBar.tsx` [NEW] — Filter controls (show all / active only / by theme)
- [ ] `frontend/hooks/useThemes.ts` — Consume theme data (created by T1)

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/narrative/NarrativeMap.tsx` — owned by T4
- `frontend/lib/narrative-physics.ts` — keep as-is; canvas refactor may reduce usage but don't delete
- `frontend/lib/narrative-canvas-renderer.ts` — keep as-is for now
- `backend-hono/src/services/` — all backend owned by T1/T2

## Reuse Inventory

- `frontend/components/narrative/NarrativeCanvas.tsx` (326 lines) — main surface being refactored
- `frontend/components/narrative/Sanctum.tsx` (460 lines) — parent container with page switching
- `frontend/components/narrative/SanctumNarratives.tsx` (257 lines) — existing narrative display
- `frontend/components/narrative/CatalystCard.tsx` (94 lines) — individual catalyst card
- `frontend/contexts/NarrativeContext.tsx` (171 lines) — narrative state management
- `frontend/components/narrative/ThemeHeader.tsx` — created by T2
- `frontend/components/narrative/DriftBubble.tsx` — created by T2
- `frontend/hooks/useThemes.ts` — created by T1

## Known Issues to Preserve

- NarrativeCanvas currently uses canvas-based bubble physics — the refactor should preserve the canvas element but reorganize the layout above it
- Sanctum page switching (scrollToPage) must not break
- Follow Solvys UI constraints: no gradients, no emojis, no Kanban borders, no AI sparkles
- Frosted-glass surfaces for cards/panels

## Implementation Steps

1. Create `frontend/components/narrative/ThemeCatalystGroup.tsx`:
   - Accepts theme object and its associated catalysts
   - Renders ThemeHeader (from T2) at top
   - Renders CatalystCards in a vertical list, sorted by severity/impact
   - Wrap in frosted-glass surface

2. Create `frontend/components/narrative/NarrativeFlowFilterBar.tsx`:
   - Filter options: "All Themes", "Active Only", dropdown for specific theme
   - Compact pill-style UI matching Solvys toolbar aesthetic
   - State managed locally, filters passed up to parent

3. Refactor `NarrativeCanvas.tsx`:
   - Instead of pure bubble physics, add a structured layout layer above/beside the canvas
   - Group catalysts by theme, sorted by IPV descending
   - Each theme gets a ThemeHeader + ThemeCatalystGroup
   - Canvas bubbles remain as background visualization but the primary interaction is the structured list
   - Add filter bar at top

4. Update `Sanctum.tsx`:
   - Add NarrativeFlow page integration (if not already a dedicated page)
   - Wire theme data from `useThemes()` hook through to NarrativeCanvas
   - Ensure filter state flows correctly
   - Add smooth transition when switching to/from NarrativeFlow page

5. Update `CatalystCard.tsx` to accept and display drift indicator when available.

## Acceptance Criteria

- [ ] NarrativeFlow shows catalysts grouped by theme, sorted by IPV (highest first)
- [ ] Theme headers display theme name, IPV score, status badge, and drift indicator
- [ ] Catalyst cards within each theme are sorted by impact/severity
- [ ] Filter bar works: "All", "Active Only", "By Theme" filters correctly
- [ ] Sanctum nav transitions smoothly to/from NarrativeFlow
- [ ] Frosted-glass surfaces used throughout (no Kanban borders)
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
[v6.5.0] feat: S68-T3 narrativeflow surface refactor to impact intelligence
```
