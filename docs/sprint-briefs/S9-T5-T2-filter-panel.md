# S9-T5 Track 2: Sanctum Filter & Legend Panel

**Sprint:** S9-T5 Sanctum Map Intelligence Overhaul
**Track:** T2 — Filter & Legend Panel
**Depends on:** T1 (Ropes Fix) must be complete first
**Estimated files:** 1 new, 4 modified

---

## Objective

Add a FILTERS button to the ConsiliumHub tab bar (between DEBATE and PROPOSALS) that opens a dropdown panel with:
1. Rope legend / color key
2. Importance sorting (severity, date, health score)
3. Narrative thread toggles with color dots
4. Category toggles with color
5. Sentiment filter (moved from floating toolbar)

---

## Files to Read First

1. `frontend/components/consilium/ConsiliumHub.tsx` — tab bar with DEBATE/PROPOSALS buttons, `ActivePanel` state pattern
2. `frontend/components/narrative/NarrativeMap.tsx` — current filter state (visibleLaneIds, activeTags, filterSentiment)
3. `frontend/components/narrative/NarrativeFloatingToolbar.tsx` — existing filter toggle button to remove
4. `frontend/components/narrative/NarrativeForceCanvas.tsx` — how filters are consumed (lines 519-530)
5. `frontend/lib/narrative-types.ts` — NarrativeCategory, CatalystSentiment, NarrativeFlowState types
6. `frontend/lib/narrative-force-layout.ts` — CATEGORY_COLORS mapping
7. `frontend/lib/narrative-rope-engine.ts` — rope types (hub-to-catalyst, cross-catalyst, crossNarrative flag)

---

## Architecture

### State Flow

The filter panel lives in `ConsiliumHub.tsx` but its state affects the `NarrativeMap` component. The approach:

1. **Lift filter state to ConsiliumHub** via a callback pattern:
   - ConsiliumHub passes `onFilterChange` callback to the Sanctum content area
   - NarrativeMap receives filter config and applies it to the canvas

2. **OR** (simpler): Add filter state to the NarrativeContext/store, which is already accessible everywhere:
   - Add `categoryFilter: Set<NarrativeCategory>` to `NarrativeFlowState`
   - Add `severitySort: 'high-first' | 'recent-first' | 'health' | null` to `NarrativeFlowState`
   - The filter panel reads/writes through `useNarrative()` context
   - The canvas already reads from `state` so it automatically reacts

**Use approach 2** — add to the narrative store. This is cleaner and consistent with how `filterSentiment` already works.

### Panel Design

The panel should:
- Be a positioned dropdown (not a slide-out panel like DEBATE/PROPOSALS)
- Use `position: absolute` or `fixed` anchored below the FILTERS button
- Have a max-height with overflow-y scroll
- Close when clicking outside (useClickOutside pattern)
- Match the Fintheon dark theme: bg `#050402`, border `#c79f4a20`, text `#f0ead6`

---

## New File: `frontend/components/narrative/SanctumFilterPanel.tsx`

### Component Interface

```typescript
interface SanctumFilterPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}
```

### Panel Sections

**Section 1: Rope Legend**
```
ROPE TYPES
─────────────────────────
[thin line, thread color]   Hub → Catalyst (structural)
[medium line, thread color] Same-narrative connection
[medium line, gold]         Cross-narrative connection
                            Thickness = tag overlap strength
```

Use small SVG lines (40px wide) with the actual stroke styles from buildEdges:
- Hub-to-catalyst: 1px, thread-colored, opacity 0.12
- Same-narrative: 1-2.5px, thread-colored, opacity 0.15-0.4
- Cross-narrative: 1-2.5px, gold (#c79f4a), opacity 0.12-0.3

**Section 2: Importance Sort**
```
SORT BY
─────────────────────────
( ) Severity (High → Low)
( ) Date (Newest first)
( ) Health Score
( ) None (default)
```

Radio button group. When a sort is selected, the force layout should reorder nodes (or at minimum, the z-index).

**NOTE**: The force simulation positions nodes via physics — you can't directly "sort" them spatially. Instead, sort affects the **force strength**: high-severity cards get stronger charge (appear more central/prominent). Implement by adjusting the charge strength in the force simulation based on sort mode:
- Severity sort: high = -400 charge, medium = -280, low = -180
- Date sort: most recent cards get stronger charge
- Health sort: cards in healthier lanes get stronger charge

**Section 3: Narrative Toggles**
```
NARRATIVES
─────────────────────────
[x] [amber dot]  Middle East Conflict
[x] [purple dot] Liquidity & Credit
[x] [blue dot]   AI Singularity
[x] [pink dot]   Carry Trade
[x] [red dot]    Trade War
[x] [teal dot]   US-China Relations
[x] [green dot]  Rate Cut Cycle
[x] [orange dot] Trump Presidency
[x] [amber dot]  Price Stability
[x] [lavender]   Maximum Employment
```

Use the NARRATIVE_THREADS array from NarrativeForceCanvas.tsx (lines 48-61) for slugs + colors. Each checkbox toggles the narrative in `visibleLaneIds`.

Add "Select All" / "Clear All" links at the top of this section.

**Section 4: Category Toggles**
```
CATEGORIES
─────────────────────────
[x] [amber]  Geopolitical
[x] [purple] Monetary
[x] [blue]   Macroeconomic
[x] [pink]   Market Structure
[x] [green]  Earnings
[x] [teal]   Supply Chain
[x] [red]    Black Swan
```

Use CATEGORY_COLORS from `frontend/lib/narrative-force-layout.ts`. Add a new `categoryFilter` field to state.

**Section 5: Sentiment**
```
SENTIMENT
─────────────────────────
[All] [Bullish] [Bearish]
```

Move the sentiment toggle from the floating toolbar to here. Use a 3-button segmented control. Dispatches `SET_FILTER` action.

---

## Files to Modify

### 1. `frontend/components/consilium/ConsiliumHub.tsx`

Add FILTERS button between DEBATE and PROPOSALS in the tab bar.

Find the section with the DEBATE and PROPOSALS buttons (around lines 283-307). Add a FILTERS button:

```typescript
// Add state
const [filtersOpen, setFiltersOpen] = useState(false);
const filtersRef = useRef<HTMLButtonElement>(null);

// Add button between DEBATE and PROPOSALS
<button
  ref={filtersRef}
  onClick={() => setFiltersOpen(prev => !prev)}
  className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono tracking-widest transition-colors ${
    filtersOpen ? 'text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/40' : 'text-[var(--fintheon-text-muted)] border border-transparent hover:text-[var(--fintheon-text)]'
  }`}
>
  <SlidersHorizontal size={14} />
  FILTERS
</button>

// Render filter panel (only when Sanctum tab is active)
{filtersOpen && activeTab === 'sanctum' && (
  <SanctumFilterPanel
    open={filtersOpen}
    onClose={() => setFiltersOpen(false)}
    anchorRef={filtersRef}
  />
)}
```

Import `SlidersHorizontal` from `lucide-react` and `SanctumFilterPanel` from `../narrative/SanctumFilterPanel`.

### 2. `frontend/lib/narrative-types.ts`

Add new filter state fields to `NarrativeFlowState`:

```typescript
categoryFilter: Set<NarrativeCategory>; // empty set = show all
severitySort: 'severity' | 'date' | 'health' | null;
```

Add new actions to `NarrativeAction`:

```typescript
| { type: 'SET_CATEGORY_FILTER'; categories: Set<NarrativeCategory> }
| { type: 'SET_SEVERITY_SORT'; sort: 'severity' | 'date' | 'health' | null }
| { type: 'TOGGLE_CATEGORY'; category: NarrativeCategory }
```

Update `defaultState()` in narrative-store.ts to include:
```typescript
categoryFilter: new Set(),
severitySort: null,
```

**NOTE**: `Set` doesn't serialize to JSON. For localStorage persistence, convert Set to/from Array in `saveNarrativeState`/`loadNarrativeState`.

### 3. `frontend/lib/narrative-store.ts`

Add reducer cases for the new actions:

```typescript
case 'SET_CATEGORY_FILTER':
  return { ...state, categoryFilter: action.categories };
case 'SET_SEVERITY_SORT':
  return { ...state, severitySort: action.sort };
case 'TOGGLE_CATEGORY': {
  const next = new Set(state.categoryFilter);
  next.has(action.category) ? next.delete(action.category) : next.add(action.category);
  return { ...state, categoryFilter: next };
}
```

Handle Set serialization in save/load:
```typescript
// In saveNarrativeState:
const serializable = {
  ...state,
  categoryFilter: [...state.categoryFilter],
};
localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));

// In loadNarrativeState:
parsed.categoryFilter = new Set(parsed.categoryFilter ?? []);
```

### 4. `frontend/components/narrative/NarrativeForceCanvas.tsx`

Update `filteredCatalysts` (around line 519) to also respect category filter:

```typescript
const filteredCatalysts = useMemo(() => {
  let cards = state.catalysts.filter(c => {
    // Existing lane filter
    if (visibleLaneIds.size > 0) {
      const thread = c.narrative ?? c.narrativeThreads?.[0];
      if (thread && !visibleLaneIds.has(thread)) return false;
    }
    // NEW: category filter
    if (state.categoryFilter.size > 0 && c.category && !state.categoryFilter.has(c.category)) {
      return false;
    }
    return true;
  });
  // Existing tag filter
  if (activeTags.size > 0) {
    cards = cards.filter(c => c.tags?.some(t => activeTags.has(t)) ?? false);
  }
  return cards;
}, [state.catalysts, state.categoryFilter, visibleLaneIds, activeTags]);
```

---

## Verification

1. Navigate to Consilium → Sanctum tab
2. FILTERS button visible between DEBATE and PROPOSALS
3. Click FILTERS → dropdown panel appears below the button
4. **Rope legend** shows 3 rope types with correct visual examples
5. **Importance sort** radio buttons change force layout emphasis
6. **Narrative toggles** show/hide narrative thread cards on the map
7. **Category toggles** show/hide cards by NarrativeCategory
8. **Sentiment filter** works (bullish/bearish/all)
9. Click outside panel → panel closes
10. `npx tsc --noEmit` passes
11. `bun run build` passes

---

## Changelog Entry

```typescript
{ date: '2026-03-29T__:__:__', agent: 'claude-code', summary: 'feat(sanctum): FILTERS dropdown panel with rope legend, importance sort, narrative/category toggles, and sentiment filter', files: ['frontend/components/narrative/SanctumFilterPanel.tsx', 'frontend/components/consilium/ConsiliumHub.tsx', 'frontend/lib/narrative-types.ts', 'frontend/lib/narrative-store.ts', 'frontend/components/narrative/NarrativeForceCanvas.tsx'] }
```

---

## DO NOT

- Do NOT touch the rope engine (`narrative-rope-engine.ts`) — that's T1's scope
- Do NOT modify the zoom tier system — that's T3's scope
- Do NOT touch Apparatus files — that's T4's scope
- Do NOT create a full slide-out panel — use a dropdown/popover
- Do NOT remove the floating toolbar — just move the sentiment filter toggle from it to the new panel
