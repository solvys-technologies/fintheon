# S2-T7: Refinement Engine — Own Sidebar Tab

**Sprint:** S2 — RiskFlow Regime-Aware Scoring Engine
**Track:** T7 (Wave 4 — after T5 and T6 complete)
**Depends on:** T1 (types), T2 (regime endpoints), T3 (commentator endpoints), T4 (calibration/annotation endpoints), T5 (re-score endpoint), T6 (refinement toggle in Developer Settings)

---

## Objective

Build the Refinement Engine as its own sidebar tab — a full scoring calibration workbench where TP can: view the current RiskFlow feed with live scores, comment on individual items, tag flawed scoring via dropdown, adjust event weights inline, override the active regime, refresh/re-score all visible items in real time, and manage the commentator registry. The tab is conditionally visible based on a toggle in Developer Settings (T6 sets `localStorage: fintheon-refinement-enabled`).

---

## Files to Read First

- `frontend/components/layout/NavSidebar.tsx` — NavTab type, sidebar structure, notification bell location (lines 206-244)
- `frontend/components/layout/MainLayout.tsx` — how views are rendered based on activeTab, how NavSidebar is wired
- `frontend/lib/layoutOrderStorage.ts` — NavTabId type, DEFAULT_SIDEBAR_ORDER
- `frontend/components/RiskFlowPanel.tsx` — existing RiskFlow card rendering pattern (reference for item display)
- `frontend/components/riskflow/shared.tsx` — shared components (SourceIcon, CyclicalBadge, etc.) — may exist from previous sprint
- `frontend/components/riskflow/WideAlertRow.tsx` — wide card component — may exist from previous sprint
- `frontend/contexts/RiskFlowContext.tsx` — how alerts are fetched and managed
- `frontend/types/regime.ts` — MARKET_REGIMES, REGIME_LABELS (T1)
- `backend-hono/src/types/calibration.ts` — FlawTag, RefinementAnnotation (T1)
- `frontend/lib/services.ts` — API call patterns

---

## Files to Create

### 1. `frontend/components/refinement/RefinementEngine.tsx` (NEW, ~280 lines)

The main view component. Layout:

```
┌──────────────────────────────────────────────────────────────────┐
│ REFINEMENT ENGINE                              [Re-Score All ↻] │
├──────────────────────────┬───────────────────────────────────────┤
│                          │                                       │
│  REGIME & CONTROLS       │  RISKFLOW FEED (ANNOTATABLE)          │
│  (left panel, 320px)     │  (right panel, flex-1)                │
│                          │                                       │
│  ┌────────────────────┐  │  ┌─────────────────────────────────┐  │
│  │ Active Regime      │  │  │ [Item card with annotation UI] │  │
│  │ [BEAR_TREND ▼]     │  │  │ ├─ headline + severity + time  │  │
│  │ Confidence: 80%    │  │  │ ├─ IV: 5.2 [████░░░░░░]        │  │
│  │ [Override]         │  │  │ ├─ SubScores: E:5 T:0 D:1.5    │  │
│  └────────────────────┘  │  │ ├─ Points: ±45 /MNQ            │  │
│                          │  │ ├─ Speaker: Powell (Tier 1)     │  │
│  ┌────────────────────┐  │  │ ├─ Regime mult: 1.5x           │  │
│  │ Quick Weight Edit  │  │  │ ├─ [Comment...] [Flaw: ▼]      │  │
│  │ CPI   [███████░] 7.5│  │ │ └─ [Save Annotation]          │  │
│  │ NFP   [███████░] 7.5│  │ └─────────────────────────────────┘  │
│  │ FOMC  [████████] 8.5│  │                                       │
│  │ ...                 │  │  ┌─────────────────────────────────┐  │
│  │ [Save Weights]     │  │  │ [Next item...]                  │  │
│  └────────────────────┘  │  └─────────────────────────────────┘  │
│                          │                                       │
│  ┌────────────────────┐  │                                       │
│  │ Commentator Mgmt   │  │                                       │
│  │ [Add Official]     │  │                                       │
│  │ Powell - Tier 1    │  │                                       │
│  │ Bessent - Tier 1   │  │                                       │
│  │ ...                │  │                                       │
│  └────────────────────┘  │                                       │
│                          │                                       │
└──────────────────────────┴───────────────────────────────────────┘
```

**Key behaviors:**
- Fetches RiskFlow feed items on mount (same endpoint as main RiskFlow: `GET /api/riskflow/feed`)
- "Re-Score All" button: calls `POST /api/riskflow/rescore`, then re-fetches feed to show updated scores
- Left panel: regime control + weight sliders (compact version of what's in Developer Settings) + commentator management
- Right panel: scrollable list of feed items, each with annotation UI

**State:**
```typescript
const [items, setItems] = useState<FeedItem[]>([]);
const [regime, setRegime] = useState<RegimeState | null>(null);
const [weights, setWeights] = useState<CalibrationEntry[]>([]);
const [registry, setRegistry] = useState<CommentatorEntry[]>([]);
const [isRescoring, setIsRescoring] = useState(false);
```

### 2. `frontend/components/refinement/AnnotatableItem.tsx` (NEW, ~200 lines)

A RiskFlow item card with annotation controls. Displays:

- All standard item info (headline, severity, source, time, points)
- IV score with 10-segment bar
- SubScores breakdown (eventWeight, timing, deviation, momentum, vixMultiplier)
- **NEW:** Regime multiplier applied (from subScores.regimeMultiplier)
- **NEW:** Speaker + tier (from subScores.speaker, subScores.commentatorMultiplier)
- **NEW:** Comment textarea (2 lines, expandable)
- **NEW:** Flaw tag dropdown: overscored | underscored | wrong_type | wrong_sentiment | missing_context | commentator_misweight | regime_mismatch
- **NEW:** Suggested score input (0-10, 0.5 step)
- **NEW:** "Save Annotation" button → calls `POST /api/calibration/annotate`
- Show existing annotations if any (fetch on expand from `GET /api/calibration/annotations/:itemId`)

Props:
```typescript
interface AnnotatableItemProps {
  item: FeedItem;
  onAnnotationSaved?: () => void;
}
```

### 3. `frontend/components/refinement/RegimeControl.tsx` (NEW, ~100 lines)

Compact regime display + override:
- Current regime badge (colored by regime type)
- Dropdown to override regime (all 8 options)
- "Override" button → calls `POST /api/regime/set` with `detectedBy: 'manual'`
- Shows confidence % and detection source
- After override, shows "Regime changed — Re-Score All to apply" hint

### 4. `frontend/components/refinement/QuickWeightEditor.tsx` (NEW, ~120 lines)

Compact weight slider panel:
- Shows top ~10 most common event types with sliders (0-10, 0.5 step)
- "Show All" expander reveals full list
- Each slider shows current value
- "Save" button → calls `PUT /api/calibration/weight/:eventType` for changed weights
- After saving, shows "Weights saved — Re-Score All to apply" hint

### 5. `frontend/components/refinement/CommentatorManager.tsx` (NEW, ~200 lines)

**Drag-and-drop ranked commentator list.** Top = most important. New entries land at the bottom until dragged up.

**Layout:**
```
┌─────────────────────────────────────────┐
│ COMMENTATOR RANKING        [Seed Defaults] │
│ ─────────────────────────────────────── │
│ ⠿ 1. Powell — Fed Chair (T1, 1.5x)    │
│ ⠿ 2. Trump — President (T1, 1.5x)     │
│ ⠿ 3. Bessent — Treasury Sec (T1, 1.5x)│
│ ⠿ 4. Waller — Fed Gov (T2, 1.2x)      │
│ ⠿ 5. Barr — Fed VCS (T2, 1.2x)        │
│ ⠿ ... (drag to reorder)                │
│                                         │
│ [+ Add Official]                        │
│ Name: [________] Aliases: [________]   │
│ Tier: [1▼] Role: [________]            │
│ Institution: [________]                 │
│ [Add to Bottom]                         │
└─────────────────────────────────────────┘
```

**Drag-and-drop behavior:**
- Use native HTML5 drag events (`onDragStart`, `onDragOver`, `onDrop`) — same pattern as `NavSidebar.tsx` lines 84-108
- Each row has a `⠿` grip handle (GripVertical icon from lucide)
- Dragging reorders the local state immediately (optimistic)
- On drop, call `PUT /api/commentator/reorder` with `{ orderedIds: string[] }` — the full ordered ID array
- Rank number displayed next to each entry

**Per-entry row:**
- Rank number (from position in list)
- Name (bold)
- Role + Institution (muted text)
- Tier badge (T1/T2/T3 with multiplier)
- [Edit] button — inline edit name/aliases/tier/role
- [Remove] button — soft delete

**Add form:**
- Collapsible "Add Official" section at the bottom
- Fields: name, aliases (comma-separated), tier dropdown (1/2/3), role, institution
- "Add to Bottom" button → calls `POST /api/commentator` (backend auto-assigns max rank + 1)
- After add, new entry appears at bottom of the list

**Seed button:**
- "Seed Defaults" button → calls `POST /api/commentator/seed` (idempotent — only seeds if registry is empty)
- Seeds 18 default commentators: Powell, Trump, Bessent, Waller, Barr, Bostic, Musalem, Witkoff, Warsh, Lutnick, Timiraos, Goolsbee, Kashkari, Daly, Williams, Barkin, Bowman, Lagarde
- Pre-ranked in order of market importance

**API endpoints used:**
- `GET /api/commentator/registry` — fetch ranked list
- `POST /api/commentator` — add new (lands at bottom)
- `PUT /api/commentator/reorder` — batch reorder from drag `{ orderedIds: string[] }`
- `PUT /api/commentator/:id` — update individual entry
- `DELETE /api/commentator/:id` — soft delete
- `POST /api/commentator/seed` — seed defaults (idempotent)

---

## Files to Modify

### 1. `frontend/components/layout/NavSidebar.tsx`

Add Refinement Engine icon to sidebar, positioned ABOVE the notification bell:

```typescript
// Import
import { Wrench } from 'lucide-react'; // or Sliders, Gauge, SlidersHorizontal

// Add prop
interface NavSidebarProps {
  // ...existing
  onRefinementClick?: () => void;
  refinementEnabled?: boolean;  // read from localStorage
}

// Before the notification bell block (before line 207), add:
{refinementEnabled && (
  <button
    onClick={onRefinementClick}
    className="w-full flex items-center gap-2.5 rounded-md py-1.5 px-2 text-sm transition-colors hover:bg-zinc-800/50 text-zinc-400 hover:text-[var(--fintheon-accent)]"
  >
    <Wrench className="w-4 h-4 shrink-0" />
    {!collapsed && <span className="text-xs">Refinement</span>}
  </button>
)}
```

### 2. `frontend/components/layout/MainLayout.tsx`

Wire the Refinement Engine view:

```typescript
// Import
import { RefinementEngine } from '../refinement/RefinementEngine';

// Add state
const [showRefinement, setShowRefinement] = useState(false);
const refinementEnabled = typeof window !== 'undefined' &&
  localStorage.getItem('fintheon-refinement-enabled') === 'true';

// In the main content area, add conditional rendering:
{showRefinement ? (
  <RefinementEngine />
) : (
  // ...existing view routing
)}

// Pass to NavSidebar:
<NavSidebar
  // ...existing props
  onRefinementClick={() => setShowRefinement(!showRefinement)}
  refinementEnabled={refinementEnabled}
/>
```

### 3. `frontend/lib/layoutOrderStorage.ts`

No NavTabId change needed — Refinement is NOT a draggable nav item. It's a fixed button in the bottom section of the sidebar (like Settings and Notifications). It doesn't participate in layout ordering.

---

## Key Rules / Corrections

- **Refinement Engine is NOT a NavTab** — it's a fixed sidebar button, not a draggable nav item. Don't add it to NavTabId or DEFAULT_SIDEBAR_ORDER.
- **Conditionally visible** — only shows when `localStorage.getItem('fintheon-refinement-enabled') === 'true'` (set by T6 toggle in Developer Settings).
- **Re-Score All is the key interaction** — after changing weights, regime, or commentator tiers, the user hits Re-Score All and sees the feed update with new scores immediately.
- **Annotations are persistent** — saved to Supabase via T4's endpoints. They survive page reloads.
- **No gradients, no colored emojis** — per global rules.
- **Solvys Gold palette** — BG #050402, Accent #c79f4a, Text #f0ead6.
- **Each component file under 300 lines** — split as specified above.
- **Import shared components** — if `frontend/components/riskflow/shared.tsx` exists (from previous sprint), import SourceIcon, CyclicalBadge, etc. from there. If not, import from wherever they're defined (check RiskFlowPanel.tsx).
- **The left panel scrolls independently** from the right panel. Both use overflow-y-auto.

---

## Verification

```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. Build passes
bun run build

# 3. Manual testing in browser:
# - Enable Refinement Engine in Developer Settings (enter password, toggle ON)
# - Sidebar should show Wrench icon above notification bell
# - Click Wrench → Refinement Engine view loads
# - Left panel: regime control, weight sliders, commentator list
# - Right panel: feed items with annotation controls
# - Change a weight → Save → "Re-Score All" → scores update in right panel
# - Override regime → "Re-Score All" → scores change according to regime multipliers
# - Add annotation to an item → Save → reload → annotation persists
# - Add a commentator → appears in list
# - Toggle Refinement Engine OFF in Developer Settings → sidebar icon disappears
```

---

## Changelog Entry
```typescript
{ date: '2026-03-26T...', agent: 'claude-code', summary: 'S2-T7: Refinement Engine — own sidebar tab with annotatable feed, inline weight editor, regime control, commentator manager, re-score trigger', files: ['frontend/components/refinement/RefinementEngine.tsx', 'frontend/components/refinement/AnnotatableItem.tsx', 'frontend/components/refinement/RegimeControl.tsx', 'frontend/components/refinement/QuickWeightEditor.tsx', 'frontend/components/refinement/CommentatorManager.tsx', 'frontend/components/layout/NavSidebar.tsx', 'frontend/components/layout/MainLayout.tsx'] }
```

---

## DO NOT

- Do NOT modify backend scoring logic (T5 scope)
- Do NOT modify backend API endpoints (T2/T3/T4/T5 scope)
- Do NOT modify SettingsPanel.tsx (T6 scope)
- Do NOT add Refinement to NavTabId or DEFAULT_SIDEBAR_ORDER — it's a fixed button, not a tab
- Do NOT create new backend routes — only consume existing endpoints
- Do NOT add gradients or colored emojis
- Do NOT make the left panel wider than 320px — it shouldn't crowd the feed
