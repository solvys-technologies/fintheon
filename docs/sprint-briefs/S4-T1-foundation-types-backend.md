# S4-T1: Foundation — Types, Reducer, Grid Math, Backend Endpoint

**Sprint:** S4 (NarrativeFlow Research Canvas Overhaul)
**Track:** T1 — Foundation
**Dependencies:** None (runs first; T2/T3/T4 depend on this)

---

## Objective

Extend the NarrativeFlow type system with research-card fields, add new reducer actions for highlight-branching, create grid layout math utilities, and build a lightweight backend endpoint for AI research bullet generation. Every other track imports from the types and utilities created here.

---

## Files to Read First

- `frontend/lib/narrative-types.ts` — All current types (CatalystCard, Rope, NarrativeAction, etc.)
- `frontend/lib/narrative-store.ts` — Reducer logic, localStorage persistence, useNarrativeStore hook
- `frontend/contexts/NarrativeContext.tsx` — Context provider, derived state helpers
- `frontend/lib/narrative-time.ts` — Week/date utilities (getMonday, getWeekDates, etc.)
- `backend-hono/src/routes/narrative/handlers.ts` — Existing LLM scoring endpoints (pattern to follow)
- `backend-hono/src/routes/narrative/index.ts` — Route registration pattern
- `backend-hono/src/services/ai/model-selector.ts` — selectModel, createModelClient pattern

---

## Files to Modify

### 1. `frontend/lib/narrative-types.ts`

**What:** Add ResearchBullet interface, extend CatalystCard with research fields, add new action types.

Add these NEW types (append after existing types, before NarrativeAction):

```typescript
export interface ResearchBullet {
  id: string;
  boldPhrase: string;
  explanation: string;
  source: 'ai' | 'user' | 'riskflow';
  highlightable: boolean;
}

export interface NarrativeAggregateCard {
  id: string;
  title: string;                    // aggregated title (highest-severity card's title)
  riskCategory: NarrativeCategory;
  timeBucket: string;               // ISO date string of the bucket start
  constituentCardIds: string[];     // IDs of cards aggregated into this
  severity: CatalystSeverity;       // highest severity among constituents
  sentiment: CatalystSentiment;     // dominant sentiment
  cardCount: number;
}
```

Extend **CatalystCard** — add these optional fields to the existing interface:

```typescript
  researchBullets?: ResearchBullet[];
  parentHighlight?: string;        // text that was highlighted to create this card
  parentCardId?: string;           // ID of the card this was branched from
  childCardIds?: string[];         // IDs of cards branched from this card
  drillDepth: number;              // 0 = root, 1 = first branch, 2 = second, etc.
```

**IMPORTANT:** `drillDepth` is required (not optional). Default to `0` in the reducer's ADD_CATALYST handler.

Add these to the **NarrativeAction** union (append before the closing semicolon):

```typescript
  | { type: 'HIGHLIGHT_BRANCH'; parentId: string; highlightText: string; childCard: Omit<CatalystCard, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'ADD_RESEARCH_BULLETS'; cardId: string; bullets: ResearchBullet[] }
  | { type: 'MOVE_CARD_TO_LANE'; cardId: string; targetLaneId: string }
```

Also add to `CatalystSource` type:

```typescript
export type CatalystSource = 'rss' | 'user' | 'agent' | 'riskflow' | 'brief' | 'research';
```

### 2. `frontend/lib/narrative-store.ts`

**What:** Add reducer cases for the 3 new actions.

In the `reduce` function, add these cases:

**HIGHLIGHT_BRANCH:**
- Generate new ID for child card
- Set child's `parentCardId` = action.parentId
- Set child's `parentHighlight` = action.highlightText
- Set child's `drillDepth` = parent.drillDepth + 1
- Set child's `source` = 'research'
- Push child ID into parent's `childCardIds` array
- Add child to `state.catalysts`
- Add a rope from parent → child (type 'reinforcing', weight 1, approved true)

**ADD_RESEARCH_BULLETS:**
- Find card by ID, set its `researchBullets` to action.bullets

**MOVE_CARD_TO_LANE:**
- Find card by ID, replace its `narrativeIds` with `[action.targetLaneId]`

Also update the existing `ADD_CATALYST` case to default `drillDepth` to `0` if not provided:
```typescript
drillDepth: action.catalyst.drillDepth ?? 0,
```

### 3. `frontend/contexts/NarrativeContext.tsx`

**What:** Add derived state helpers for the grid view.

Add these to the context value interface and implementation:

```typescript
// In NarrativeContextValue interface:
catalystsForLane: (laneId: string) => CatalystCard[];
cardChildren: (cardId: string) => CatalystCard[];
cardParent: (cardId: string) => CatalystCard | undefined;

// Implementation (useMemo):
const catalystsForLane = useMemo(
  () => (laneId: string) => state.catalysts.filter(c => c.narrativeIds.includes(laneId)),
  [state.catalysts]
);

const cardChildren = useMemo(
  () => (cardId: string) => state.catalysts.filter(c => c.parentCardId === cardId),
  [state.catalysts]
);

const cardParent = useMemo(
  () => (cardId: string) => {
    const card = state.catalysts.find(c => c.id === cardId);
    return card?.parentCardId ? state.catalysts.find(c => c.id === card.parentCardId) : undefined;
  },
  [state.catalysts]
);
```

Add all three to the `value` useMemo and the context value object.

---

## Files to Create

### 4. `frontend/lib/narrative-grid-layout.ts` (~120 lines)

Grid positioning math for the 2D time × risk category layout.

```typescript
// [claude-code 2026-03-27] Grid layout math for NarrativeFlow 2D canvas — time columns × risk rows

import type { ZoomLevel, NarrativeCategory } from './narrative-types';
import { getMonday, getWeekDates, shiftWeek } from './narrative-time';

// Risk category lane order (Y-axis, top to bottom)
export const RISK_LANES: NarrativeCategory[] = [
  'geopolitical',
  'monetary',
  'macroeconomic',
  'earnings',
  'market-structure',
  'supply-chain',
  'black-swan',
];

export const RISK_LANE_LABELS: Record<NarrativeCategory, string> = {
  'geopolitical': 'Geopolitical',
  'monetary': 'Monetary Policy',
  'macroeconomic': 'Macro / Econ',
  'earnings': 'Earnings',
  'market-structure': 'Market Structure',
  'supply-chain': 'Supply Chain',
  'black-swan': 'Black Swan',
};

// Grid dimensions
export const LANE_HEADER_WIDTH = 160;  // px, left sidebar
export const WEEK_COL_WIDTH = 140;     // px per day column at week zoom
export const MONTH_COL_WIDTH = 200;    // px per week column at month zoom
export const LANE_ROW_HEIGHT = 120;    // px per risk category row
export const LANE_ROW_GAP = 4;         // px between rows

export interface GridColumn {
  key: string;          // unique key (ISO date or week label)
  label: string;        // display label ("Mon 3/24" or "Week of Mar 24")
  startDate: Date;
  endDate: Date;
  width: number;        // px
}

// Generate columns for the current zoom level
export function getGridColumns(zoomLevel: ZoomLevel, anchorDate: Date): GridColumn[] { ... }

// Get the column key a card belongs to based on its date
export function getColumnKeyForDate(date: string, columns: GridColumn[]): string | null { ... }

// Get the lane index for a risk category
export function getLaneIndex(category: NarrativeCategory): number { ... }
```

**Implementation notes:**
- `getGridColumns('week', anchor)` → 5 day columns (Mon-Fri) for current week + 2 weeks before/after = ~15 columns
- `getGridColumns('month', anchor)` → 4-5 week columns for current month + adjacent months
- `getGridColumns('quarter', anchor)` → 3 month columns
- `getGridColumns('year', anchor)` → 4 quarter columns
- Quarter and year columns exist for read-only aggregate views

### 5. `frontend/lib/narrative-research.ts` (~80 lines)

Frontend API wrapper for the research-drill endpoint.

```typescript
// [claude-code 2026-03-27] AI research call wrapper — lightweight drill-deeper for NarrativeFlow

import type { ResearchBullet } from './narrative-types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface ResearchDrillRequest {
  highlightedText: string;
  parentTitle: string;
  parentDescription: string;
  riskCategory: string;
  sentiment: string;
}

export interface ResearchDrillResponse {
  bullets: ResearchBullet[];
  provider: string;
}

export async function drillResearch(req: ResearchDrillRequest): Promise<ResearchDrillResponse> {
  const res = await fetch(`${API_BASE}/api/narrative/research-drill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Research drill failed: ${res.status}`);
  return res.json();
}

export async function drillDeeperInCard(
  query: string,
  cardTitle: string,
  cardDescription: string,
  riskCategory: string,
  sentiment: string,
): Promise<ResearchBullet[]> {
  const { bullets } = await drillResearch({
    highlightedText: query,
    parentTitle: cardTitle,
    parentDescription: cardDescription,
    riskCategory,
    sentiment,
  });
  return bullets;
}
```

### 6. `backend-hono/src/routes/narrative/handlers.ts`

**What:** Add a new `researchDrill` handler function to the EXISTING file. Do NOT replace the existing handlers — append after `scoreBrief`.

```typescript
/**
 * POST /api/narrative/research-drill
 * Generate 5 deeper research bullets for a highlighted phrase
 */
export async function researchDrill(c: Context) {
  try {
    const { highlightedText, parentTitle, parentDescription, riskCategory, sentiment } =
      await c.req.json<{
        highlightedText: string;
        parentTitle: string;
        parentDescription: string;
        riskCategory: string;
        sentiment: string;
      }>();

    if (!highlightedText) return c.json({ error: 'highlightedText required' }, 400);

    const prompt = RESEARCH_DRILL_PROMPT
      + `\nHighlighted phrase: "${highlightedText}"`
      + `\nParent card: ${parentTitle}`
      + `\nContext: ${parentDescription}`
      + `\nRisk category: ${riskCategory}`
      + `\nMarket sentiment: ${sentiment}`;

    const { parsed, provider } = await callLlm(prompt);

    let bullets: Array<{ boldPhrase: string; explanation: string }>;
    if (parsed) {
      bullets = parsed.map((raw: any) => ({
        boldPhrase: String(raw.boldPhrase ?? raw.key ?? '').slice(0, 80),
        explanation: String(raw.explanation ?? raw.detail ?? '').slice(0, 300),
      }));
    } else {
      bullets = [{ boldPhrase: highlightedText, explanation: 'AI analysis unavailable — try again.' }];
    }

    const formatted = bullets.map((b, i) => ({
      id: `drill-${Date.now()}-${i}`,
      boldPhrase: b.boldPhrase,
      explanation: b.explanation,
      source: 'ai' as const,
      highlightable: true,
    }));

    return c.json({ bullets: formatted, provider });
  } catch (err) {
    console.error('[Narrative] researchDrill error:', err);
    return c.json({ error: 'Failed to generate research' }, 500);
  }
}
```

Also add the prompt constant near the other prompts:

```typescript
const RESEARCH_DRILL_PROMPT = `You are a market research analyst for Priced In Capital. Given a highlighted phrase from a market narrative card, generate exactly 5 deeper research bullets.

Each bullet should reveal a specific, data-driven insight about the highlighted topic. Include numbers, percentages, dates, or specific entities where possible.

Return a JSON array of 5 objects, each with:
- boldPhrase: A bold key insight (max 80 chars, e.g. "Supply chain repricing underway")
- explanation: Detailed explanation with specific facts (max 300 chars)

Return ONLY a JSON array, no markdown, no explanation.
`;
```

### 7. `backend-hono/src/routes/narrative/index.ts`

**What:** Register the new endpoint. Add one line:

```typescript
app.post('/research-drill', researchDrill)
```

And update the import:
```typescript
import { scoreRiskflow, scoreBrief, researchDrill } from './handlers.js'
```

---

## Key Rules / Corrections

- `drillDepth` on CatalystCard is **required** (not optional) — default `0` in reducer
- `NarrativeAggregateCard` is a NEW type, separate from `CatalystCard` — used by T2's aggregator
- The `callLlm` helper already exists in handlers.ts — reuse it, don't recreate
- `stripMarkdownFences` already exists — reuse it
- The backend uses ESM (`.js` extensions in imports) — maintain this pattern
- Do NOT modify any Sanctum or RiskFlow files
- All new files get `// [claude-code 2026-03-27] description` header comment

---

## DO NOT

- Touch any file in `frontend/components/narrative/` — that's T2/T3/T4 scope
- Modify `NarrativeFlow.tsx` or `NarrativeToolbar.tsx` — T2 owns those
- Modify `RopeRenderer.tsx` — T4 owns that
- Create any React components — this track is types + utils + backend only
- Modify MiroFish service or RiskFlow service files

---

## Verification

```bash
# Type check
cd frontend && npx tsc --noEmit

# Build frontend
cd frontend && bun run build

# Backend type check (if applicable)
cd backend-hono && npx tsc --noEmit

# Test the new endpoint
cd backend-hono && bun run dev &
curl -X POST http://localhost:8080/api/narrative/research-drill \
  -H 'Content-Type: application/json' \
  -d '{"highlightedText":"tariff retaliation","parentTitle":"Trade War Escalation","parentDescription":"China responds to US tariffs","riskCategory":"geopolitical","sentiment":"bearish"}'

# Verify new types compile
grep -n 'ResearchBullet' frontend/lib/narrative-types.ts
grep -n 'HIGHLIGHT_BRANCH' frontend/lib/narrative-store.ts
grep -n 'catalystsForLane' frontend/contexts/NarrativeContext.tsx
grep -n 'researchDrill' backend-hono/src/routes/narrative/index.ts
```

---

## Changelog Entry

```typescript
{ date: '2026-03-27T00:00:00', agent: 'claude-code', summary: 'S4-T1: Extended narrative types with ResearchBullet, CatalystCard research fields, new reducer actions (HIGHLIGHT_BRANCH, ADD_RESEARCH_BULLETS, MOVE_CARD_TO_LANE), grid layout math, and POST /api/narrative/research-drill endpoint', files: ['frontend/lib/narrative-types.ts', 'frontend/lib/narrative-store.ts', 'frontend/contexts/NarrativeContext.tsx', 'frontend/lib/narrative-grid-layout.ts', 'frontend/lib/narrative-research.ts', 'backend-hono/src/routes/narrative/handlers.ts', 'backend-hono/src/routes/narrative/index.ts'] }
```
