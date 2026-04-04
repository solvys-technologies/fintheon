# Task Brief: NarrativeFlow Visual Redesign — "The Feels"
**Date:** 2026-04-04
**Scope:** Redesign NarrativeFlow cards (25-item split), layout (concentric rings), bubbles (frosted glass), and ropes (gradient energy lines)
**Estimated files:** 8

## Context
NarrativeFlow expanded cards can contain 100+ headlines and aren't readable. The zoomed-out bubble view looks gamified (radial glow halos, pulsing animations). Ropes are generic green beziers. The reset function scatters cards without structure. This task makes the entire feature elegant, legible, and visually premium.

## Files to Read First
- `frontend/lib/narrative-types.ts` — Type definitions for CatalystCard, NarrativeAggregateCard, NarrativeLane, Rope
- `frontend/lib/narrative-aggregator.ts` — Current aggregation logic (groups by narrative+time, no item limit)
- `frontend/components/narrative/AggregateCardNode.tsx` — Aggregate card renderer (scrollable list, severity colors, IV scores)
- `frontend/components/narrative/NarrativeForceCanvas.tsx` — Main React Flow canvas (917 lines — buildThemeView, buildNarrativeView, reset logic, force sim)
- `frontend/lib/narrative-force-layout.ts` — Force config, category centers, re-exports from territory-layout
- `frontend/components/narrative/NarrativeHubNode.tsx` — Narrative hub circles (radial gradient, text-shadow glow)
- `frontend/components/narrative/TerritoryNode.tsx` — Territory circles (radial gradient, no glow animation)
- `frontend/components/narrative/NarrativeRopes.tsx` — SVG rope layer (green beziers, hover tooltip, frustum culling)
- `frontend/lib/narrative-canvas-renderer.ts` — Canvas 2D drawing (drawNarrativeCard, drawRope with radial gradient + shadow)
- `frontend/styles/custom.css` — Rope keyframes (rope-shimmer, rope-pulse, rope-breathe)
- `frontend/lib/narrative-territory-layout.ts` — THREAD_MAP, NARRATIVE_THREADS, SEVERITY_COLORS, getSemanticZoom

## What to Build/Change

### 1. Card Splitting — 25-Item Cap
- **Path:** `frontend/lib/narrative-types.ts`
- **Action:** Modify
- **Spec:** Add optional fields to `NarrativeAggregateCard`: `siblingIndex?: number`, `siblingCount?: number`, `siblingGroupId?: string`

- **Path:** `frontend/lib/narrative-aggregator.ts`
- **Action:** Modify
- **Spec:** Add `splitOversizedAggregates(aggregates)` function after `maxSeverity`. For each aggregate with `constituentCardIds.length > 25`: slice into chunks of 25, create new aggregate per chunk with `id: originalId + '-p' + i`, `title: originalTitle + ' ' + (i+1) + '/' + pageCount`, sibling fields populated. Call it at the end of `aggregateCards()` before the return on line 98.

- **Path:** `frontend/components/narrative/AggregateCardNode.tsx`
- **Action:** Modify
- **Spec:** Add `siblingIndex?: number` and `siblingCount?: number` to `AggregateCardNodeData`. In the header (after the "{cards.length} items" span around line 119), conditionally render a page badge when `siblingCount > 1`: small mono text showing "Page {siblingIndex+1}/{siblingCount}" styled like the date range span.

- **Path:** `frontend/components/narrative/NarrativeForceCanvas.tsx`
- **Action:** Modify
- **Spec:** When building theme view nodes from aggregates that have `siblingGroupId`, add inter-sibling edges with `strength: 0.9` and distance `80`. Offset sibling node initial positions by `siblingIndex * 80` on the Y axis from the group centroid.

### 2. Concentric Ring Layout (Reset/Snap)
- **Path:** `frontend/lib/narrative-force-layout.ts`
- **Action:** Modify
- **Spec:** Add exported function `computeConcentricPositions(hubCenter: {x,y}, cards: {id: string, severity: 'high'|'medium'|'low', siblingIndex?: number, siblingCount?: number}[]): Map<string, {x: number, y: number}>`. Algorithm: partition cards into 3 severity buckets. Ring radii: high=120, medium=220, low=320. Within each ring, evenly space cards angularly. Apply golden angle offset per ring (`ringIndex * 0.618 * Math.PI`) to prevent radial alignment. For sibling groups, treat as one slot and stack vertically with 60px offset.

- **Path:** `frontend/components/narrative/NarrativeForceCanvas.tsx`
- **Action:** Modify
- **Spec:** Replace the reset layout handler. Instead of clearing positions and re-running force sim: (1) clear saved positions, (2) for each narrative hub, gather its cards, call `computeConcentricPositions`, (3) write computed positions to localStorage via the existing save mechanism, (4) rebuild view with these as pinned positions (fx/fy), (5) call fitView(). The force sim should NOT run after reset — concentric layout IS the reset.

### 3. Frosted Glass Bubbles
- **Path:** `frontend/components/narrative/NarrativeHubNode.tsx`
- **Action:** Modify
- **Spec:** Replace `background: radial-gradient(...)` with `background: rgba(10, 10, 0, 0.65)`, add `backdropFilter: 'blur(16px)'`, `WebkitBackdropFilter: 'blur(16px)'`, `border: 1.5px solid ${color}20`. Remove `textShadow` from the title span. Add hover glow: use `useState<boolean>` for `isHovered`, onMouseEnter/Leave handlers on the outer div, conditionally set `boxShadow: isHovered ? '0 0 24px ' + color + '40' : 'none'` with `transition: 'box-shadow 0.3s ease'`.

- **Path:** `frontend/components/narrative/TerritoryNode.tsx`
- **Action:** Modify
- **Spec:** Replace outer div background `radial-gradient(...)` with `background: rgba(10, 10, 0, 0.45)`, add `backdropFilter: 'blur(12px)'`, `WebkitBackdropFilter: 'blur(12px)'`, change border to `1px solid ${color}15`. Remove inner div's `background: radial-gradient(...)` — just keep padding and text styling.

- **Path:** `frontend/lib/narrative-canvas-renderer.ts`
- **Action:** Modify
- **Spec:** In `drawNarrativeCard()`: replace the radial gradient fill with flat `ctx.fillStyle = hexToRgba(colors.surface, 0.75)`. Remove default shadow (set `ctx.shadowBlur = 0`). Only apply shadow when `isHovered`: `ctx.shadowColor = hexToRgba(color, 0.25)`, `ctx.shadowBlur = 24`. Reset shadow after draw.

### 4. Gradient Energy Ropes
- **Path:** `frontend/components/narrative/NarrativeRopes.tsx`
- **Action:** Modify
- **Spec:** Import `THREAD_MAP` from `../../lib/narrative-territory-layout`. Add `<defs>` block inside `<svg>` with one `<linearGradient>` per visible rope: id=`rope-grad-${conn.id}`, `gradientUnits="userSpaceOnUse"`, x1/y1 = source right edge, x2/y2 = target left edge, stop 0% = `THREAD_MAP[conn.fromNarrative]?.color ?? '#D4AF37'`, stop 100% = `THREAD_MAP[conn.toNarrative]?.color ?? '#D4AF37'`. Replace `stroke={ROPE_GREEN}` with `stroke={url(#rope-grad-${conn.id})}`. Change strokeWidth to `1 + conn.strength * 3` (hover: add 1.5). Add `strokeDasharray="8 16"` and className `rope-energy-line`. Update tooltip colors from green to `var(--fintheon-accent)`.

- **Path:** `frontend/styles/custom.css`
- **Action:** Modify
- **Spec:** Replace the rope-shimmer, rope-pulse, rope-breathe keyframes with: `@keyframes rope-energy-flow { 0% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: -48 } }`. Add `.rope-energy-line { stroke-dasharray: 8 16; animation: rope-energy-flow 2s linear infinite }`. Add nth-child stagger: 3n=2.2s, 3n+1=1.8s, 3n+2=2.5s duration variants.

- **Path:** `frontend/lib/narrative-canvas-renderer.ts`
- **Action:** Modify (same file as WS3)
- **Spec:** In `drawRope()`: replace single stroke color with `ctx.createLinearGradient(fromX, fromY, toX, toY)` with stops at `hexToRgba(fromColor, 0.5)` and `hexToRgba(toColor, 0.5)`. Width: `1 + weight * 3`. Add animated dash: `ctx.setLineDash([8, 16])`, `ctx.lineDashOffset = -(performance.now() * 0.024) % 48`. The caller needs to pass `fromColor` and `toColor` (resolve from lane/thread color).

## Key Rules
- Solvys Gold palette only: BG #050402, Accent #D4AF37/#c79f4a, Text #f0ead6
- No gradients on backgrounds — flat fill + backdrop-filter blur = frosted glass
- No new npm dependencies
- Preserve drag-and-drop + layout persistence (localStorage key `fintheon-narrative-positions` + Supabase `app_state`)
- Must not break the 3 semantic zoom levels (macro/narratives/themes in `getSemanticZoom`)
- Canvas 2D can't do backdrop-filter — fake frost with flat semi-transparent fill is correct
- Existing `RopeConnection` interface has `fromNarrative` and `toNarrative` fields — use them for gradient color lookup
- `NarrativeForceCanvas.tsx` is already 917 lines (over 300 limit) — do NOT significantly grow it. Extract helpers to `narrative-force-layout.ts`.

## DO NOT
- Add framer-motion, GSAP, or any animation library
- Touch backend routes or Supabase schema
- Change the aggregation grouping logic (narrative+time bucket) — only add the 25-item split post-processing
- Add colored emojis or gradients to card backgrounds
- Modify NarrativeCanvas.tsx (the legacy Canvas bubble view) — focus on the React Flow canvas
- Touch files outside the 8 listed scope files

## Verification
```bash
npx tsc --noEmit
bun run build
```
Manual verification:
1. Open NarrativeFlow at themes zoom level
2. Find a narrative with 50+ items — should show as 2+ sibling cards with "1/3, 2/3..." badges
3. Click reset — cards snap into concentric rings around their narrative hub (high severity inner, low outer)
4. Zoom out to narratives view — hub nodes should be flat frosted glass, no glow at rest
5. Hover a hub node — subtle gold glow blooms around it
6. Check ropes — should gradient from source color to target color with flowing electricity animation
7. Drag a card, refresh page — position persists
8. Zoom to macro view — territory circles are flat frosted, no radial glow halos

## Changelog Entry
```typescript
{
  date: '2026-04-04T12:00:00',
  agent: 'claude-code',
  summary: 'NarrativeFlow visual redesign: 25-item card splitting with sibling pages, concentric ring reset layout, frosted glass bubble styling with hover glow, gradient energy rope connections',
  files: [
    'frontend/lib/narrative-types.ts',
    'frontend/lib/narrative-aggregator.ts',
    'frontend/components/narrative/AggregateCardNode.tsx',
    'frontend/components/narrative/NarrativeForceCanvas.tsx',
    'frontend/lib/narrative-force-layout.ts',
    'frontend/components/narrative/NarrativeHubNode.tsx',
    'frontend/components/narrative/TerritoryNode.tsx',
    'frontend/components/narrative/NarrativeRopes.tsx',
    'frontend/lib/narrative-canvas-renderer.ts',
    'frontend/styles/custom.css',
  ],
}
```

## Post-Push Memory Update
After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:
1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
