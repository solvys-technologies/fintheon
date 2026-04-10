# Task Brief: NarrativeFlow Layout Overhaul

**Date:** 2026-04-03
**Scope:** Convert territory nodes from squares to circles, improve zoom granularity, make expanded cards scrollable, add loading sequence, and implement real save/restore of positions.
**Estimated files:** 4

## Context

NarrativeMap renders 1082 catalysts across 10 narrative threads. The zoomed-out "narratives" view uses square territory nodes that are hard to read. The user wants circles instead, more granular zoom transitions, scrollable expanded card lists, a visible loading sequence when the force simulation runs, and persistent layout save that actually survives reloads.

Currently: positions save to localStorage per-node on drag (works), but the initial force layout reruns every mount and scatters cards randomly. The territory squares are styled inline in TerritoryNode.tsx. Zoom has only 2 levels (narratives at <0.35, themes at >=0.35).

## Files to Read First

- `frontend/components/narrative/NarrativeForceCanvas.tsx` — Main canvas, force simulation, position persistence, view switching (759 lines)
- `frontend/components/narrative/TerritoryNode.tsx` — Zoomed-out territory shapes (currently square, 80 lines)
- `frontend/components/narrative/AggregateCardNode.tsx` — Card groups with expand/collapse (305 lines)
- `frontend/components/narrative/NarrativeHubNode.tsx` — Hub nodes in theme view
- `frontend/lib/narrative-territory-layout.ts` — TERRITORY_LAYOUT dimensions, HUB_POSITIONS, getSemanticZoom threshold, NARRATIVE_THREADS colors

## What to Build/Change

### 1. TerritoryNode — Circles, Not Squares

- **Path:** `frontend/components/narrative/TerritoryNode.tsx`
- **Action:** Modify
- **Spec:**
  - Change `borderRadius: 6` to `borderRadius: '50%'`
  - Make width === height (use the larger of the two from TERRITORY_LAYOUT, or accept a `size` prop computed as `Math.max(w, h)`)
  - Center the title text with better contrast — add a subtle dark radial gradient behind the text
  - Increase title font to 32px, add text-shadow for glow effect using the thread color
  - The catalyst count should sit directly below the title, not off to the side
  - The bottom gradient bar should become a circular ring pulse animation on the border
- **Max lines:** 100

### 2. TERRITORY_LAYOUT — Square Dimensions to Circle Radii

- **Path:** `frontend/lib/narrative-territory-layout.ts`
- **Action:** Modify
- **Spec:**
  - Replace `{ x, y, w, h }` with `{ x, y, r }` where `r` is the radius (use `Math.max(w, h) / 2` from current values)
  - Update `HUB_POSITIONS` derivation — center is just `{ x, y }` now (territory center)
  - Add intermediate zoom level: `getSemanticZoom` should return 3 levels:
    - `zoom < 0.15` → `'macro'` (just circles with title + count)
    - `0.15 <= zoom < 0.45` → `'narratives'` (circles with visible card clusters)
    - `zoom >= 0.45` → `'themes'` (full hub + card detail)
  - Export type `SemanticNarrativeView = 'macro' | 'narratives' | 'themes'`
- **Max lines:** 100

### 3. NarrativeForceCanvas — Loading Sequence + Save Button

- **Path:** `frontend/components/narrative/NarrativeForceCanvas.tsx`
- **Action:** Modify
- **Spec:**
  - **Loading sequence:** When force simulation is computing (350 ticks on 1082 nodes takes ~200ms), show a centered loading state: dark overlay with "Resolving narratives..." text and a subtle gold spinner. Use `useState<'loading' | 'settling' | 'ready'>` to track phase. After simulation completes, animate opacity from 0→1 over 400ms.
  - **Save button:** Add a "Save Layout" button next to the existing "Reset Layout" button in the bottom-left panel. On click, serialize ALL current node positions (not just dragged ones) into localStorage under `POSITIONS_KEY`. Show a brief "Saved" toast or flash.
  - **Restore on mount:** When loading, check if saved positions exist. If yes, skip the force simulation entirely — just place nodes at their saved positions. Only run force sim when positions are missing or after "Reset Layout."
  - **Handle the 3 zoom levels:** Add a `'macro'` view builder that creates only territory circle nodes (no cards, no hubs).
  - **Smooth zoom transitions:** When switching semantic view, animate node opacity out (150ms) → rebuild → animate in (300ms). Use the existing `transitioning` state pattern.
- **Max lines:** 300 (it's already 759 — focus changes on the simulation boot, save logic, and macro view only. Don't restructure the entire file.)

### 4. AggregateCardNode — Scrollable Expanded Cards

- **Path:** `frontend/components/narrative/AggregateCardNode.tsx`
- **Action:** Modify
- **Spec:**
  - The expanded card list already has `maxHeight: 400, overflowY: 'auto'` on line 173 — verify this actually works inside ReactFlow (ReactFlow can eat scroll events). If it doesn't, add `onWheel={(e) => e.stopPropagation()}` to the scrollable container to prevent ReactFlow from intercepting the scroll.
  - Add a subtle scrollbar styled with Fintheon theme colors (thin, gold thumb)
  - When expanding, the card list should fade-slide in with a staggered animation (already has `card-enter` keyframes — verify they fire)
- **Max lines:** 300

## Key Rules

- Territory LAYOUT type change (`w,h` → `r`) will break NarrativeForceCanvas `buildNarrativeView` which reads `territory.w` and `territory.h`. Update those references.
- The `buildSimData` function uses `HUB_POSITIONS` for initial card scatter — this shouldn't need changes since hubs are still `{ x, y }`.
- Don't touch NarrativeHubNode.tsx unless the theme view breaks from layout changes.
- Keep the cross-narrative gold rope edges — they connect territory-to-territory and should still work with circles.
- Preserve the `onNodeDragStop` → `saveNodePosition` flow for per-node persistence.

## DO NOT

- Restructure the entire NarrativeForceCanvas file — it's 759 lines and has working logic. Surgical changes only.
- Touch NarrativeMap.tsx, NarrativeContext.tsx, or the NarrativeFloatingToolbar
- Add new dependencies — everything needed is already in the project (ReactFlow, d3-force)
- Break the existing theme view (hubs + cards) — it must still work at high zoom

## Verification

```bash
npx vite build
# Open app → Consilium → Sanctum → NarrativeMap
# Zoom out fully — should see circles, not squares
# Zoom in gradually — should transition through 3 levels smoothly
# Click a card group to expand — card list should scroll if > 400px
# Drag nodes around, click "Save Layout" — reload, positions should restore
# Click "Reset Layout" — force simulation runs fresh
```

## Changelog Entry

```typescript
{
  date: '2026-04-04T00:00:00',
  agent: 'claude-code',
  summary: 'NarrativeFlow overhaul: territory nodes are now circles (not squares), 3-tier zoom (macro/narratives/themes), loading sequence during force simulation, Save Layout button with full position persistence, scrollable expanded card lists',
  files: [
    'frontend/components/narrative/TerritoryNode.tsx',
    'frontend/components/narrative/NarrativeForceCanvas.tsx',
    'frontend/components/narrative/AggregateCardNode.tsx',
    'frontend/lib/narrative-territory-layout.ts',
  ]
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
