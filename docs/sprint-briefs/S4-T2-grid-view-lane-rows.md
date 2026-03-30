# S4-T2: Grid View + Lane Rows + Semantic Zoom

**Sprint:** S4 (NarrativeFlow Research Canvas Overhaul)
**Track:** T2 — Grid View + Lane Rows
**Dependencies:** T1 complete (types, grid math, context helpers)

---

## Objective

Build the 2D grid layout that replaces NarrativeCanvas and NarrativeWeekView. Cards sit at the intersection of time columns (X) and risk category rows (Y). Week zoom shows individual cards in day columns. Month zoom shows semantically aggregated narrative summary cards in week columns. Quarter/Year zooms show read-only macro theme cards. Wire the grid into NarrativeFlow.tsx as the primary view.

---

## Files to Read First

- `frontend/lib/narrative-types.ts` — After T1: CatalystCard (with new research fields), NarrativeAggregateCard, NarrativeCategory
- `frontend/lib/narrative-grid-layout.ts` — After T1: RISK_LANES, RISK_LANE_LABELS, getGridColumns, LANE_HEADER_WIDTH, LANE_ROW_HEIGHT, etc.
- `frontend/lib/narrative-time.ts` — getMonday, getWeekDates, shiftWeek, formatWeekLabel, formatDayLabel
- `frontend/contexts/NarrativeContext.tsx` — After T1: catalystsForLane, cardChildren, activeLanes
- `frontend/components/narrative/NarrativeFlow.tsx` — Current orchestrator (you'll rewire this)
- `frontend/components/narrative/NarrativeToolbar.tsx` — Current toolbar (you'll update zoom controls)
- `frontend/components/narrative/NarrativeWeekView.tsx` — Reference for DOM grid approach (don't copy, just study)
- `frontend/components/narrative/CatalystCard.tsx` — Current card component (use as placeholder card until T3's NarrativeResearchCard is wired during unification)
- `frontend/components/narrative/NarrativeLane.tsx` — Existing lane component (reference for lane rendering)
- `frontend/components/narrative/NarrativeLaneHeader.tsx` — Existing lane header (reuse directly)

---

## Files to Create

### 1. `frontend/components/narrative/NarrativeGridView.tsx` (~280 lines)

The main 2D grid container. Replaces NarrativeCanvas and NarrativeWeekView.

**Structure:**
```
┌──────────────────────────────────────────────────────────────────┐
│ [Lane Headers]  │  [Time Columns - scrollable horizontally]      │
│                 │                                                 │
│ Geopolitical    │  Mon 3/24  │  Tue 3/25  │  Wed 3/26  │  ...  │
│ ─────────────── │ ────────── │ ────────── │ ────────── │        │
│ Monetary        │  [cards]   │            │  [cards]   │        │
│ ─────────────── │            │            │            │        │
│ Macro / Econ    │            │  [cards]   │            │        │
│ ─────────────── │            │            │            │        │
│ ...             │            │            │            │        │
└──────────────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface NarrativeGridViewProps {
  visibleLaneIds: Set<string>;
  activeTags: Set<string>;
}
```

**Behavior:**
- Uses `useNarrative()` for state, dispatch, catalystsForLane, activeLanes
- Calls `getGridColumns(state.zoomLevel, new Date(state.currentWeekStart))` for column layout
- Fixed left sidebar (lane headers, `LANE_HEADER_WIDTH` px)
- Scrollable grid area (horizontal scroll for time, vertical for overflow)
- Current day column highlighted with subtle accent background
- At week/month zoom: cards are interactive (click to select, drag to reposition)
- At quarter/year zoom: cards are read-only (no drag, no edit, muted styling)

**Rendering per cell (lane × column):**
- Filter catalysts: `catalystsForLane(lane.id)` → filter by column date range
- At **week zoom**: render individual CatalystCard components (use existing `CatalystCard` as placeholder — T3's `NarrativeResearchCard` replaces it during unification)
- At **month zoom**: render `NarrativeAggregateCard` from `aggregateCards()`
- At **quarter/year zoom**: render aggregated cards with read-only styling

**Scroll behavior:**
- Center current day/week on mount
- Arrow keys or swipe to scroll time axis
- Ref-forward the scrollable container for NarrativeConnectionOverlay (T4 will overlay SVG here)

**Key refs to expose:**
```typescript
// Card position refs — T4 needs these for drawing arrows
const cardRefsMap = useRef<Record<string, HTMLDivElement | null>>({});
// Grid container ref — T4 needs for SVG overlay positioning
const gridContainerRef = useRef<HTMLDivElement>(null);
```

### 2. `frontend/components/narrative/NarrativeLaneRow.tsx` (~130 lines)

A single risk-category row in the grid.

**Props:**
```typescript
interface NarrativeLaneRowProps {
  category: NarrativeCategory;
  columns: GridColumn[];
  catalysts: CatalystCard[];
  aggregates?: NarrativeAggregateCard[];
  zoomLevel: ZoomLevel;
  selectedCardId: string | null;
  onSelectCard: (id: string) => void;
  onDragCard?: (cardId: string, targetDate: string) => void;
  cardRefsMap: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}
```

**Behavior:**
- Renders as a flex row: cells aligned with column widths
- Each cell: position cards that fall within that column's date range
- Multiple cards per cell stack vertically (flexbox column, gap 4px)
- Lane label on the left via NarrativeLaneHeader (reuse existing component)
- Empty cells show a subtle dashed outline on hover (drop target indicator)
- At week/month zoom: drag-and-drop cards between cells
- Row background: alternating subtle shade for visual separation

**Severity glow on lane row:**
- If any HIGH severity card exists in this lane: left border = `var(--fintheon-bearish)` (red)
- If only MEDIUM: left border = `var(--fintheon-accent)` (amber/gold)
- Otherwise: no special border

### 3. `frontend/lib/narrative-aggregator.ts` (~100 lines)

Semantic zoom aggregation logic. Merges individual cards into summary cards at coarser zoom levels.

```typescript
// [claude-code 2026-03-27] Semantic zoom aggregation — merges cards into narrative summaries at month/quarter/year zoom

import type {
  CatalystCard, NarrativeAggregateCard, NarrativeCategory,
  CatalystSeverity, CatalystSentiment, ZoomLevel,
} from './narrative-types';
import type { GridColumn } from './narrative-grid-layout';

/**
 * Aggregate cards into summary cards per lane × time bucket.
 *
 * Semantic zoom model:
 * - Week: "Liberation Day" (individual card)
 * - Month: "Trade Tensions Flare" (aggregates Liberation Day + China retaliates + EU responds)
 * - Quarter: "Trump Trade War" (aggregates all trade-tension month cards)
 * - Year: "2026 Geopolitical Realignment" (aggregates quarter themes)
 *
 * Aggregation rules:
 * 1. Group cards by riskCategory + column key
 * 2. Title = highest-severity card's title (user can edit later)
 * 3. Severity = max severity in group
 * 4. Sentiment = dominant sentiment (majority wins, tie → bearish)
 */
export function aggregateCards(
  catalysts: CatalystCard[],
  columns: GridColumn[],
  riskCategory: NarrativeCategory,
  zoomLevel: ZoomLevel,
): NarrativeAggregateCard[] { ... }

// Determine dominant sentiment
function dominantSentiment(cards: CatalystCard[]): CatalystSentiment { ... }

// Determine max severity
function maxSeverity(cards: CatalystCard[]): CatalystSeverity { ... }
```

**Key rule:** Only aggregate root cards (`drillDepth === 0`). Child cards (from highlight-branching) are never aggregated — they only appear when their parent is expanded.

---

## Files to Modify

### 4. `frontend/components/narrative/NarrativeFlow.tsx`

**What:** Replace the Canvas/WeekView conditional with NarrativeGridView. Remove Canvas imports. Keep Sanctum split panel.

**Changes:**
1. Remove import of `NarrativeCanvas`
2. Remove import of `NarrativeWeekView`
3. Add import of `NarrativeGridView`
4. Replace the `isCanvasView ? <NarrativeCanvas /> : <NarrativeWeekView />` conditional with just `<NarrativeGridView visibleLaneIds={visibleLaneIds} activeTags={activeTags} />`
5. Remove `const isCanvasView = state.zoomLevel !== 'week';` (no longer needed)
6. Keep the `NarrativeDropdown` visible at all times (remove the `isCanvasView &&` guard)
7. Keep Sanctum split panel, all modals, toolbar, and scrubber exactly as-is

**Result:** NarrativeFlow always renders the grid. The grid internally handles zoom levels.

### 5. `frontend/components/narrative/NarrativeToolbar.tsx`

**What:** Update zoom controls to reflect the new semantic zoom model.

**Changes:**
1. The zoom buttons currently show "Week / Month / Quarter / Year" as equal toggles
2. Update labels: "Week" and "Month" stay as-is. "Quarter" and "Year" get a small lock icon or "read-only" indicator
3. Add a visual separator between editable (week/month) and read-only (quarter/year) zoom levels
4. **Leave a gap/space** in the toolbar for a "Highlight" button — T4 will add it during unification. Do NOT add it yourself — just ensure there's room.

---

## Key Rules / Corrections

- **Use existing `CatalystCard` component** as the card renderer for now. During unification, T3's `NarrativeResearchCard` replaces it.
- **Expose `cardRefsMap` and `gridContainerRef`** from NarrativeGridView — T4 needs them for the SVG connection overlay.
- **Only aggregate root cards** (`drillDepth === 0`). Child cards are hidden at aggregated zoom levels.
- **Current day highlight:** the column containing today's date gets `backgroundColor: 'color-mix(in srgb, var(--fintheon-accent) 5%, transparent)'`
- **No file over 300 lines.** NarrativeGridView should delegate row rendering to NarrativeLaneRow.
- Theme: Solvys Stone (dark). Use `var(--fintheon-*)` CSS variables throughout. No warm ivory, no serif fonts.
- All new files get `// [claude-code 2026-03-27] description` header comments.

---

## DO NOT

- Create or modify `NarrativeResearchCard.tsx` — that's T3 scope
- Create or modify `NarrativeHighlightProvider.tsx` — that's T3 scope
- Create or modify `NarrativeConnectionOverlay.tsx` — that's T4 scope
- Modify `RopeRenderer.tsx` — that's T4 scope
- Modify `narrative-types.ts`, `narrative-store.ts`, or `NarrativeContext.tsx` — T1 owns those
- Delete old files (NarrativeCanvas.tsx, NarrativeWeekView.tsx, etc.) — just stop importing them. Cleanup in a follow-up.
- Modify any Sanctum or backend files

---

## Verification

```bash
# Type check
cd frontend && npx tsc --noEmit

# Build
cd frontend && bun run build

# Visual check (start dev server)
cd frontend && bun run dev
# Navigate to NarrativeFlow tab
# Verify: grid renders with risk category rows and time columns
# Verify: cards appear in correct cells
# Verify: week zoom shows day columns
# Verify: month zoom shows week columns with aggregated cards
# Verify: zoom toggle works
# Verify: horizontal scroll works
# Verify: current day/week is highlighted

# File size check
wc -l frontend/components/narrative/NarrativeGridView.tsx    # must be < 300
wc -l frontend/components/narrative/NarrativeLaneRow.tsx      # must be < 300
wc -l frontend/lib/narrative-aggregator.ts                     # must be < 300
```

---

## Changelog Entry

```typescript
{ date: '2026-03-27T00:00:00', agent: 'claude-code', summary: 'S4-T2: Built NarrativeGridView (2D time×risk grid), NarrativeLaneRow, semantic zoom aggregator. Replaced Canvas/WeekView toggle in NarrativeFlow with unified grid view. Updated toolbar zoom controls.', files: ['frontend/components/narrative/NarrativeGridView.tsx', 'frontend/components/narrative/NarrativeLaneRow.tsx', 'frontend/lib/narrative-aggregator.ts', 'frontend/components/narrative/NarrativeFlow.tsx', 'frontend/components/narrative/NarrativeToolbar.tsx'] }
```
