# S5-T1: Foundation — Types, Tree Layout Engine, CSS Transform Zoom

**Sprint:** S5 — NarrativeFlow Intelligence Map
**Track:** T1 (Foundation — runs first)
**Depends On:** Nothing
**Parallel With:** Nothing — T2-T5 depend on T1's types

---

## Context

NarrativeFlow is being redesigned from a flat grid (X=time, Y=risk rows) into a structured tree-map with CSS transform zoom. This track provides the foundation types, the new layout engine, and the zoom/pan system that all other tracks build on.

Key decisions (from TP):
- **Layout:** Structured tree-map — risk categories as header nodes at top, time periods branch below, cards slot into category+time intersections
- **Zoom:** CSS transform scale (like Google Maps). Mouse wheel zooms. At thresholds, semantic zoom kicks in (cards aggregate at far zoom, detail at close zoom)
- **Pan:** Click-drag to pan the canvas

---

## Files to Read First

- `frontend/lib/narrative-grid-layout.ts` — current grid column generation (being replaced)
- `frontend/lib/narrative-aggregator.ts` — current aggregation logic (keep, adapt)
- `frontend/lib/narrative-types.ts` — current types (extend)
- `frontend/lib/narrative-store.ts` — current store with zoom/week state
- `frontend/lib/narrative-time.ts` — time helpers (keep)
- `frontend/components/narrative/NarrativeGridView.tsx` — current grid (being replaced)

---

## Task 1: Extend Types

**File:** `frontend/lib/narrative-types.ts` (modify)

Add these types/fields:

```typescript
// Add to CatalystCard interface
export interface CatalystCard {
  // ... existing fields ...
  source?: 'user' | 'riskflow-import';  // distinguishes manual vs imported
  riskflowItemId?: string;              // link back to scored_riskflow_items
  marketImpact?: {
    nq: { points: number; percent: number } | null;
    es: { points: number; percent: number } | null;
    ym: { points: number; percent: number } | null;
    asOf: string; // ISO date of the close
  };
}

// New: Tree-map layout types
export interface TreeNode {
  id: string;
  label: string;
  type: 'root' | 'category' | 'time-bucket' | 'card';
  children: TreeNode[];
  category?: NarrativeCategory;
  timeBucket?: string; // column key
  depth: number;
}

// New: Canvas viewport state
export interface CanvasViewport {
  x: number;        // pan offset X
  y: number;        // pan offset Y
  scale: number;    // CSS transform scale (0.1 - 3.0)
  zoomLevel: ZoomLevel; // semantic zoom level derived from scale thresholds
}

// Zoom scale thresholds for semantic zoom
export const ZOOM_THRESHOLDS: Record<ZoomLevel, [number, number]> = {
  'week': [1.5, 3.0],     // close zoom = individual cards
  'month': [0.8, 1.5],    // medium = week aggregates
  'quarter': [0.4, 0.8],  // far = month aggregates
  'year': [0.1, 0.4],     // very far = quarter aggregates
};
```

---

## Task 2: Tree Layout Engine

**File:** `frontend/lib/narrative-tree-layout.ts` (create, max 250 lines)

This replaces `narrative-grid-layout.ts` for the new tree-map paradigm. The grid layout file stays for backward compat but the new NarrativeMapView will use the tree layout.

```typescript
export interface TreeLayoutNode {
  id: string;
  x: number;       // pixel position
  y: number;
  width: number;
  height: number;
  type: 'category-header' | 'time-column' | 'card-slot';
  category?: NarrativeCategory;
  timeBucket?: string;
  label: string;
}

/**
 * Generate tree layout positions for the structured mind-map.
 *
 * Structure:
 *   [ROOT: "Narrative Map"]
 *       ├── [Geopolitical]
 *       │     ├── [Q1 2025] → cards...
 *       │     ├── [Q2 2025] → cards...
 *       │     └── [Mar 2025] → cards... (at month zoom)
 *       ├── [Monetary Policy]
 *       │     ├── ...
 *       └── [Black Swan]
 *             └── ...
 *
 * At week zoom: time buckets are individual weeks
 * At month zoom: time buckets are months
 * At quarter zoom: time buckets are quarters
 * At year zoom: time buckets are quarters of the year
 */
export function generateTreeLayout(
  categories: NarrativeCategory[],
  zoomLevel: ZoomLevel,
  anchorDate: Date,
  dateFilter?: { start: string; end: string },
): TreeLayoutNode[]
```

Layout constants:
- Category headers: 200px wide, 60px tall, spaced 40px apart vertically
- Time columns: 180px wide per bucket, branch right from category header
- Card slots: 160px wide, 80px tall within each time bucket
- Horizontal gap between time columns: 20px
- Vertical gap between categories: 80px (breathing room)

The `dateFilter` param allows filtering to a specific range (e.g., "2025-01-01" to "2025-03-31") so the tree only shows relevant time buckets.

---

## Task 3: Canvas Zoom/Pan Engine

**File:** `frontend/hooks/useCanvasViewport.ts` (create, max 150 lines)

React hook that manages the viewport state for the pannable/zoomable canvas.

```typescript
export function useCanvasViewport(): {
  viewport: CanvasViewport;
  containerRef: React.RefObject<HTMLDivElement>;
  canvasStyle: React.CSSProperties; // transform + transform-origin
  handlers: {
    onWheel: (e: WheelEvent) => void;
    onPointerDown: (e: PointerEvent) => void;
    onPointerMove: (e: PointerEvent) => void;
    onPointerUp: (e: PointerEvent) => void;
  };
  zoomTo: (scale: number) => void;
  panTo: (x: number, y: number) => void;
  fitToView: () => void;
}
```

Behavior:
- **Mouse wheel:** Zoom in/out centered on cursor position. Scale range: 0.15 - 3.0. Smooth with `requestAnimationFrame`.
- **Click-drag:** Pan the canvas. Uses pointer events for cross-device compat.
- **Semantic zoom thresholds:** When scale crosses a threshold, dispatch `SET_ZOOM` to the narrative store so aggregation updates.
- **fitToView:** Calculate bounding box of all tree nodes and zoom/pan to fit them in the viewport.
- **canvasStyle:** Returns `{ transform: \`translate(\${x}px, \${y}px) scale(\${scale})\`, transformOrigin: '0 0' }`

Performance:
- Use `will-change: transform` on the canvas container
- Debounce semantic zoom dispatch (200ms) to avoid rapid re-aggregation
- Track `isPanning` state to prevent click events during drag

---

## Task 4: Update Narrative Store

**File:** `frontend/lib/narrative-store.ts` (modify)

Add viewport state and actions:

```typescript
// Add to state
viewport: CanvasViewport;
dateFilter: { start: string; end: string } | null;

// Add actions
| { type: 'SET_VIEWPORT'; viewport: Partial<CanvasViewport> }
| { type: 'SET_DATE_FILTER'; filter: { start: string; end: string } | null }

// Reducer cases
case 'SET_VIEWPORT':
  return { ...state, viewport: { ...state.viewport, ...action.viewport } };
case 'SET_DATE_FILTER':
  return { ...state, dateFilter: action.filter };
```

Default viewport: `{ x: 0, y: 0, scale: 1.0, zoomLevel: 'month' }`

---

## Verification

```bash
# Type-check
npx tsc --noEmit 2>&1 | grep "narrative-" | head -10

# Build
npx vite build 2>&1 | tail -5

# Verify new files exist
ls -la frontend/lib/narrative-tree-layout.ts frontend/hooks/useCanvasViewport.ts

# Verify types added
grep -n "marketImpact\|TreeNode\|CanvasViewport\|ZOOM_THRESHOLDS" frontend/lib/narrative-types.ts
```

---

## Changelog Entry

```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S5-T1: Foundation — extended catalyst types with marketImpact + source. New tree layout engine for structured mind-map. CSS transform zoom/pan hook with semantic zoom thresholds. Store extended with viewport + dateFilter state.', files: ['frontend/lib/narrative-types.ts', 'frontend/lib/narrative-tree-layout.ts', 'frontend/hooks/useCanvasViewport.ts', 'frontend/lib/narrative-store.ts'] }
```

---

## DO NOT

- Do NOT modify any existing component files (NarrativeGridView, Sanctum, etc.) — other tracks handle those
- Do NOT delete `narrative-grid-layout.ts` — it's still used until T3 replaces the view
- Do NOT implement card rendering — T3 handles cards
- Do NOT implement motion/animation — T5 handles that
- Do NOT add API calls or backend changes — T4 handles the market impact pipeline
