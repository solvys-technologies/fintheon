# S5-T3: Card Redesign + Rich Modal + RiskFlow Auto-Seed

**Sprint:** S5 — NarrativeFlow Intelligence Map
**Track:** T3 (Frontend — Cards, Modal, Data)
**Depends On:** T1 types (CatalystCard.source, CatalystCard.marketImpact)
**Parallel With:** T2, T4, T5

---

## Context

The NarrativeFlow board needs: (1) a rich add/edit modal with all trading-relevant fields, (2) mini card redesign for dense information display, (3) auto-seeding from both a historical fixture and live RiskFlow items as editable copies.

Key decisions:
- **Import model:** Hybrid — RiskFlow items become editable copies linked to original
- **Card density:** Mini card — title, severity, sentiment, source icon, time-ago (~80-100px)
- **Validation:** Category is required (prevents invisible cards)
- **Seed fixture:** 53 historical events from Jul 2024 - Aug 2025 at `frontend/data/narrative-seed-events.json`

---

## Files to Read First

- `frontend/components/narrative/NarrativeGridView.tsx` — current card rendering
- `frontend/components/narrative/NarrativeLaneRow.tsx` — how cards slot into lanes
- `frontend/components/narrative/GhostCard.tsx` — existing card component
- `frontend/components/narrative/CatalystTemplateMenu.tsx` — current add catalyst dropdown
- `frontend/components/narrative/NarrativeManageModal.tsx` — current manage modal (being replaced)
- `frontend/lib/narrative-types.ts` — CatalystCard type
- `frontend/lib/narrative-store.ts` — dispatch actions for catalysts
- `frontend/data/narrative-seed-events.json` — 53 seed events to load
- `frontend/contexts/RiskFlowContext.tsx` — useRiskFlow() for live import

---

## Task 1: Rich Add/Edit Modal

**File:** `frontend/components/narrative/CatalystModal.tsx` (create, max 280 lines)

Replaces the basic NarrativeManageModal. Opens when user clicks a card or "Add catalyst".

**Fields:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| Title | text input | Yes | "" |
| Description | textarea | No | "" |
| Category | select dropdown | **Yes** (blocks save) | — |
| Direction Bias | radio group | No | "neutral" |
| Severity | radio group | No | "medium" |
| Instruments | tag input | No | [] |
| Date | date picker | Yes | today |
| End Date | date picker | No | null |
| Status | select | No | "active" |
| Tags | tag input | No | [] |

**Category options:** geopolitical, monetary, macroeconomic, earnings, market-structure, supply-chain, black-swan

**Direction options:** bullish, bearish, neutral

**Severity options:** low, medium, high

**Status options:** active, monitoring, resolved

**Behavior:**
- Opens in a centered modal (not inline)
- If editing existing card: pre-populate all fields
- If imported card (`source === 'riskflow-import'`): show "Imported from RiskFlow" badge, all fields editable
- Save dispatches `ADD_CATALYST` or `UPDATE_CATALYST` to store
- Category validation: show red border + "Category required" if empty on save attempt
- Tags: comma-separated input that converts to pills, each tag shows in gold monospace
- Close on Escape key or clicking backdrop

**Visual style (Solvys Gold):**
- Dark modal bg `var(--fintheon-bg)` with `border-[var(--fintheon-accent)]/20`
- Gold accent on focused inputs
- No gradients, no colored emojis
- Font: monospace for values, system for labels

---

## Task 2: Mini Card Component

**File:** `frontend/components/narrative/NarrativeMiniCard.tsx` (create, max 120 lines)

Replaces GhostCard for the new map view. Compact, information-dense.

**Layout (80px tall, 160px wide):**
```
┌──────────────────────────┐
│ ● Title text truncat...  │  ← severity dot + title (10px font)
│ ▲ BEARISH  /NQ  3h ago   │  ← direction + instrument + recency
│ [geopolitical] [tariffs]  │  ← category badge + first tag
│ ⚡ 6.2                    │  ← IV score (if available)
└──────────────────────────┘
```

**Props:**
```typescript
interface NarrativeMiniCardProps {
  card: CatalystCard;
  isSelected: boolean;
  isImported: boolean; // shows subtle "LIVE" indicator
  onClick: () => void;
  onDrillDown?: () => void;
}
```

**Visual:**
- Left border colored by severity (low=muted, medium=amber, high=red)
- Sentiment arrow: ▲ green for bullish, ▼ red for bearish, — for neutral
- If `source === 'riskflow-import'`: tiny gold dot in top-right corner
- If aggregated (at higher zoom): show card count badge `×3` in bottom-right
- Hover: slight lift (translateY -1px) + border glow

---

## Task 3: Auto-Seed Pipeline

**File:** `frontend/lib/narrative-seed-loader.ts` (create, max 100 lines)

Loads the seed fixture + imports live RiskFlow items as editable copies.

```typescript
import seedEvents from '../data/narrative-seed-events.json';

/**
 * Load historical seed events into the narrative store.
 * Only runs once on first boot (checks localStorage flag).
 */
export function loadSeedEvents(): CatalystCard[] {
  const loaded = localStorage.getItem('fintheon:narrative-seeded');
  if (loaded) return [];

  const cards: CatalystCard[] = seedEvents.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date,
    category: e.category as NarrativeCategory,
    severity: e.severity as CatalystSeverity,
    sentiment: e.sentiment as CatalystSentiment,
    instruments: e.instruments,
    tags: e.tags,
    drillDepth: 0,
    source: 'user', // seed events are "owned" by user
    directionBias: e.direction,
    status: 'resolved', // historical events are resolved
    dateRange: { start: e.date, end: null },
  }));

  localStorage.setItem('fintheon:narrative-seeded', 'true');
  return cards;
}

/**
 * Import live RiskFlow items as editable copies.
 * Only imports items not already in the store (by riskflowItemId).
 */
export function importRiskFlowItems(
  alerts: RiskFlowAlert[],
  existingIds: Set<string>,
): CatalystCard[] {
  return alerts
    .filter(a => !existingIds.has(a.id))
    .slice(0, 30)
    .map(a => ({
      id: `rf-${a.id}`,
      title: a.headline,
      description: a.summary ?? '',
      date: a.publishedAt.slice(0, 10),
      category: mapRiskType(a.riskType) ?? 'macroeconomic',
      severity: mapSeverity(a.severity),
      sentiment: mapDirection(a.direction),
      instruments: a.symbols ?? [],
      tags: a.tags ?? [],
      drillDepth: 0,
      source: 'riskflow-import' as const,
      riskflowItemId: a.id,
      directionBias: a.direction === 'Bullish' ? 'bullish' : a.direction === 'Bearish' ? 'bearish' : 'neutral',
      status: 'active',
      dateRange: { start: a.publishedAt.slice(0, 10), end: null },
    }));
}
```

**Wire into NarrativeFlow.tsx:**
- On mount, call `loadSeedEvents()` and dispatch `BULK_ADD_CATALYSTS` if results non-empty
- After RiskFlow context loads, call `importRiskFlowItems()` with top 30 HIGH/CRITICAL items
- Add `BULK_ADD_CATALYSTS` action to the narrative store reducer

---

## Task 4: Update Store for Bulk Operations

**File:** `frontend/lib/narrative-store.ts` (modify)

Add actions:

```typescript
| { type: 'BULK_ADD_CATALYSTS'; catalysts: CatalystCard[] }
| { type: 'UPDATE_CATALYST'; id: string; updates: Partial<CatalystCard> }
```

Reducer:
```typescript
case 'BULK_ADD_CATALYSTS': {
  const existingIds = new Set(state.catalysts.map(c => c.id));
  const newOnes = action.catalysts.filter(c => !existingIds.has(c.id));
  return { ...state, catalysts: [...state.catalysts, ...newOnes] };
}
case 'UPDATE_CATALYST': {
  return {
    ...state,
    catalysts: state.catalysts.map(c =>
      c.id === action.id ? { ...c, ...action.updates } : c
    ),
  };
}
```

---

## Verification

```bash
# Type-check
npx tsc --noEmit 2>&1 | grep "frontend/" | head -10

# Build
npx vite build 2>&1 | tail -5

# Verify seed fixture loads
node -e "const d = require('./frontend/data/narrative-seed-events.json'); console.log(d.length + ' events')"

# Verify new files
ls -la frontend/components/narrative/CatalystModal.tsx frontend/components/narrative/NarrativeMiniCard.tsx frontend/lib/narrative-seed-loader.ts
```

---

## Changelog Entry

```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S5-T3: Rich CatalystModal with full trading fields (direction, instruments, severity, date range, status, tags). NarrativeMiniCard for dense display. Auto-seed pipeline loads 53 historical events + imports live RiskFlow items as editable copies. Store extended with BULK_ADD_CATALYSTS + UPDATE_CATALYST.', files: ['frontend/components/narrative/CatalystModal.tsx', 'frontend/components/narrative/NarrativeMiniCard.tsx', 'frontend/lib/narrative-seed-loader.ts', 'frontend/lib/narrative-store.ts'] }
```

---

## DO NOT

- Do NOT modify Sanctum components — T2 handles that
- Do NOT implement the tree-map view component — T1 handles layout, unification wires the view
- Do NOT implement market impact fetching — T4 handles the backend pipeline
- Do NOT implement rope/connection rendering — T5 handles that
- Do NOT implement animations — T5 handles motion
- Do NOT delete NarrativeManageModal — keep for backward compat until unification
