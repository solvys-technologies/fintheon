# Sprint Brief: T5 — NarrativeFlow Canvas Polish + Micro-interactions

## Context

Polish pass on the NarrativeFlow canvas experience after all functional work (T1-T4) is complete. Adds hover states, click-to-expand, smooth camera transitions, loading/empty states, and ensures Solvys Gold theming throughout. This is the final quality pass before shipping.

## Branch Target

`sprint/S68`

## Scope — Included

- [ ] `frontend/components/narrative/CatalystCard.tsx` (94 lines) — Hover states, click-to-expand
- [ ] `frontend/components/narrative/NarrativeCanvas.tsx` (326 lines) — Smooth camera transitions
- [ ] `frontend/components/narrative/NarrativeMap.tsx` (773 lines) — Loading/empty states
- [ ] `frontend/lib/narrative-canvas-renderer.ts` (348 lines) — Solvys Gold theming pass
- [ ] `frontend/components/narrative/ThemeHeader.tsx` — Polish hover/active states
- [ ] `frontend/components/narrative/ThemeCatalystGroup.tsx` — Polish interactions

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/` — no backend changes
- `frontend/contexts/NarrativeContext.tsx` — state management, leave alone
- `frontend/lib/narrative-physics.ts` — physics engine, leave alone unless animation performance issue

## Reuse Inventory

- `frontend/components/shared/SolvysLoader.tsx` — existing loader component for loading states
- `frontend/components/shared/FadingRuler.tsx` — existing separator component
- `frontend/components/narrative/CatalystCard.tsx` (94 lines) — needs hover lift + gold border
- `frontend/components/narrative/NarrativeCanvas.tsx` (326 lines) — camera transitions need smoothing
- `frontend/lib/narrative-canvas-renderer.ts` (348 lines) — canvas drawing, needs Solvys Gold colors

## Known Issues to Preserve

- No banned ornaments: no gradients, no emojis, no AI sparkles, no Kanban borders
- Frosted-glass surfaces only (translucent bg + backdrop-blur + thin accent border)
- Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6
- CSS animations only — no heavy JS animation libraries

## Implementation Steps

1. CatalystCard hover states:
   - Add `transform: translateY(-2px)` on hover
   - Add gold accent border on hover: `border-color: var(--fintheon-accent)`
   - Add `cursor: pointer` (verify it's already there)
   - Smooth transition: `transition: transform 0.15s ease, border-color 0.15s ease`

2. Click-to-expand for catalyst details:
   - On click, expand card inline or open a frosted-glass modal
   - Show full description, source, timestamp, tags, drift info
   - Close on outside click or Escape key

3. Smooth camera transitions:
   - Replace instant camera position changes with CSS/JS animated transitions
   - Use `requestAnimationFrame` interpolation for pan/zoom
   - Duration: ~200ms for pan, ~300ms for zoom

4. Loading state:
   - Glassmorphic spinner (use `SolvysLoader`) centered in NarrativeFlow area
   - Show while theme data is loading from T1 API
   - Fade out when data arrives

5. Empty state:
   - When no themes are active, show centered message: "No active themes" with subtext
   - Include a subtle icon or visual element (no emojis)
   - Match Solvys Gold palette

6. Solvys Gold theming pass:
   - Verify all colors use `var(--fintheon-accent)`, `var(--fintheon-bg)`, `var(--fintheon-text)`
   - Replace any hardcoded colors with CSS variables
   - Ensure frosted-glass surfaces on all cards/panels

7. Strip any remaining Kanban-style card borders — use frosted-glass surfaces

## Acceptance Criteria

- [ ] Catalyst cards lift and show gold border on hover
- [ ] Click-to-expand shows full catalyst details in frosted-glass modal/inline
- [ ] Camera pan/zoom transitions are smooth (not instant)
- [ ] Loading state shows glassmorphic spinner while theme data loads
- [ ] Empty state renders when no themes are active
- [ ] All colors use Solvys Gold CSS variables (no hardcoded values)
- [ ] No banned ornaments (no gradients, no emojis, no AI sparkles, no Kanban borders)
- [ ] Frosted-glass surfaces used throughout
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
[v6.5.0] feat: S68-T5 narrativeflow canvas polish and micro-interactions
```
