# S8-T3: Rope Engine [DEDICATED — MISSION CRITICAL]

**Sprint**: S8 — The Mega Sprint
**Track**: T3 (after T1)
**Branch**: `v.8.28.1`

## Context
Zero ropes render on the Observatory map despite 612 events all having tags. T1 fixes the root cause (visibleLaneIds namespace mismatch), but this track owns the full rope system: hub-to-catalyst structural ropes, cross-catalyst tag-based ropes, category-colored rendering, breathing animation, and Apparatus constellation ropes. Ropes are the connective tissue — without them the map is just floating islands.

## Files to Read First
- `frontend/lib/narrative-rope-engine.ts` (73 lines) — `computeRopeConnections()`, strength scoring, filtering
- `frontend/components/narrative/NarrativeForceCanvas.tsx` (251-276) — edge creation from rope connections, edge styles
- `frontend/lib/narrative-force-layout.ts` — `CATEGORY_COLORS`, `ZOOM_THRESHOLDS`
- `frontend/lib/narrative-types.ts` — `Rope`, `CatalystCard` types
- `frontend/lib/severity-config.ts` — `SEVERITY_CONFIG` with theme-sensitive CSS vars
- `frontend/contexts/ThemeContext.tsx` — theme system, `applyThemeToDOM()`
- `frontend/components/apparatus/ApparatusPage.tsx` — constellation view
- `frontend/components/narrative/NarrativeForceCanvas.tsx` (169-183) — `NARRATIVE_THREADS` with colors

## Files to Modify
- `frontend/lib/narrative-rope-engine.ts` — Add hub-to-catalyst connection computation, update output format
- `frontend/components/narrative/NarrativeForceCanvas.tsx` — Rewrite edge rendering: category colors, bezier curves, breathing animation, hover tooltips
- `frontend/components/apparatus/ApparatusPage.tsx` — Add rope connections between commandments

## Implementation

### 1. Verify T1 Fix
After T1 completes, verify:
- Console shows `[NarrativeFlow] Rope engine: X connections computed, Y valid` with X > 0 and Y > 0
- If still 0, trace: are cards reaching `layoutNodes()`? Do they have tags? Is the filter passing them through?

### 2. Hub-to-Catalyst Ropes (NEW connection type)
Every catalyst card should link to its narrative hub node:
- In `layoutNodes()` (or wherever T2 builds the force layout), after creating hub + catalyst nodes:
- For each catalyst, create an edge from `catalyst.id` → `hub-{catalyst.narrative}`
- These are STRUCTURAL ropes — always visible regardless of tag overlap
- Style: thinner (1px), lower opacity (0.15), subtle — they're scaffolding, not the main connections
- Color: narrative thread color from `NARRATIVE_THREADS[].color`
- No labels on hub-to-catalyst ropes
- Edge type: `smoothstep` for organic feel

### 3. Cross-Catalyst Ropes (FIX existing)
The existing `computeRopeConnections()` should work once cards actually reach it (T1 fix). Improvements:
- Increase `maxConnections` from 100 to 200 (612 events = more connections needed)
- Reduce `MIN_STRENGTH` from 0.2 to 0.15 to show more connections
- Color: use the narrative thread color of the SOURCE card's narrative (not flat gold)
- For cross-narrative connections: use a blended/neutral gold (#c79f4a at 0.3 opacity)
- Edge type: `bezier` (not `default` which renders straight lines in some cases)

### 4. Card Border Coloring
Card borders should be severity-colored using theme-sensitive CSS vars from `SEVERITY_CONFIG`:
- Critical/High: `var(--fintheon-severe)` (red)
- Medium: `var(--fintheon-neutral-severe)` (amber)
- Low: `var(--fintheon-neutral)` (gray)
This is already partially in place — verify `EventCardNode` in NarrativeForceCanvas uses `SEVERITY_CONFIG` for its border, not `CATEGORY_COLORS`.

### 5. Rope Visual Design
Replace current edge styles (flat gold, straight lines) with:

```typescript
const edges: Edge[] = validRopes.map(c => ({
  id: c.id,
  source: c.fromId,
  target: c.toId,
  type: 'smoothstep', // organic curves, not straight
  animated: false, // CSS handles animation, not React Flow
  style: {
    stroke: getThreadColor(c), // narrative thread color, NOT flat gold
    strokeWidth: 0.5 + c.strength * 2, // thin=0.5px, strong=2.5px
    opacity: 0.15 + c.strength * 0.25, // subtle at rest
  },
  // No arrow markers — ropes are bidirectional connections
  label: undefined, // labels shown on hover only
}));
```

### 6. Breathing Animation (CSS)
Add to `frontend/index.css`:
```css
@keyframes rope-breathe {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.28; }
}
```
Apply via React Flow edge className. Desynchronize per-rope using animation-delay based on edge index.

### 7. Hover Tooltip
On edge hover:
- Show shared tags as tooltip: `"cpi, inflation, rate-cut"`
- Increase opacity to 0.5 + strength color intensity
- Use React Flow's `onEdgeMouseEnter` / `onEdgeMouseLeave` callbacks
- Tooltip positioned near edge midpoint

### 8. Apparatus Ropes
In `ApparatusPage.tsx`:
- Add rope connections between related commandments in the constellation view
- Same visual treatment: bezier curves, category-colored, breathing animation
- Connect commandments that share thematic elements (e.g., risk management commandments cluster together)

## Key Rules
- Ropes must be visible at EVERY zoom level (adjust opacity/thickness for zoom)
- At `dot` zoom level, ropes become thin hairlines (0.5px, 0.1 opacity)
- At `fullCard` zoom level, ropes are their thickest and most vibrant
- NO straight lines — always `smoothstep` or `bezier`
- Gold (#c79f4a) is reserved for cross-narrative connections only

## Verification
1. `bun run build` — clean
2. NarrativeFlow: visible colored ropes between cards
3. Hover a rope → shared tags tooltip appears
4. Ropes breathe (opacity pulse visible on close inspection)
5. Hub-to-catalyst ropes visible (thinner, subtle scaffolding)
6. Card borders are severity-colored (red for critical, amber for medium, gray for low)
7. Zoom out → ropes thin but remain visible
8. Apparatus constellation → ropes between commandments
9. Ropes use narrative thread colors (purple for monetary, amber for geopolitical, etc.)

## Changelog Entry
```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S8-T3: Rope engine overhaul — hub-to-catalyst ropes, category-colored cross-catalyst ropes, severity card borders, breathing animation, hover tooltips, Apparatus ropes', files: ['frontend/lib/narrative-rope-engine.ts', 'frontend/components/narrative/NarrativeForceCanvas.tsx', 'frontend/components/apparatus/ApparatusPage.tsx', 'frontend/index.css'] }
```

## DO NOT
- Do NOT modify the force-directed layout positioning (T2 owns that)
- Do NOT change card visual design beyond borders (T4 owns card redesign)
- Do NOT touch Aquarium/Sanctum content (T4 owns that)
- Do NOT modify the toolbar or chat input (T2 owns that)
