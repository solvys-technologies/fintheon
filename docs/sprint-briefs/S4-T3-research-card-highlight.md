# S4-T3: Research Card + Highlight System

**Sprint:** S4 (NarrativeFlow Research Canvas Overhaul)
**Track:** T3 — Research Card + Highlight
**Dependencies:** T1 complete (types: ResearchBullet, CatalystCard extensions, actions)

---

## Objective

Build the ChatMind-style research card component and the highlight-to-branch interaction system. The research card displays AI-generated bullet insights with bold phrases, supports text highlighting for branching into child cards, and has a "Drill deeper..." input for follow-up research within the same card. The highlight provider manages highlight mode state and text selection events.

---

## Files to Read First

- `frontend/lib/narrative-types.ts` — After T1: ResearchBullet, CatalystCard (with researchBullets, parentHighlight, parentCardId, childCardIds, drillDepth)
- `frontend/lib/narrative-store.ts` — After T1: HIGHLIGHT_BRANCH, ADD_RESEARCH_BULLETS reducer actions
- `frontend/contexts/NarrativeContext.tsx` — After T1: cardChildren, cardParent helpers
- `frontend/components/narrative/CatalystCard.tsx` — Current card design (reference for styling patterns, SENTIMENT_COLORS, SEVERITY_LABELS, etc.)
- `frontend/components/narrative/GhostCard.tsx` — Ghost card pattern (dashed border for future events)

---

## Files to Create

### 1. `frontend/components/narrative/NarrativeResearchCard.tsx` (~280 lines)

The ChatMind-inspired research card. This replaces CatalystCard in the grid view during unification.

**Visual design:**
```
┌──────────────────────────────────────────┐
│  TARIFF TRADE WAR ESCALATION         [↗] │
├──────────────────────────────────────────┤
│  Geopolitical  │  IV: 7.2  │ 🔴 bearish  │
│ ─────────────────────────────────────── │
│                                          │
│  • **China retaliates with 34%**: full   │
│    reciprocal tariffs effective Apr 10   │
│                                          │
│  • **Supply chain repricing underway**:  │
│    shipping rates up 18% in 48 hours     │
│                                          │
│  • **Semiconductor exposure critical**:  │
│    NVDA/AMD down 4-6% on tariff news     │
│                                          │
│  › Drill deeper...                   [↑] │
└──────────────────────────────────────────┘
```

**Props:**
```typescript
interface NarrativeResearchCardProps {
  catalyst: CatalystCard;
  compact?: boolean;
  selected?: boolean;
  highlightMode?: boolean;           // from NarrativeHighlightProvider
  onSelect: (id: string) => void;
  onExpand?: (id: string) => void;
  onHighlightBranch?: (cardId: string, highlightedText: string) => void;
  onDrillDeeper?: (cardId: string, query: string) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}
```

**Rendering sections:**

1. **Title bar** — ALL-CAPS, muted text color `var(--fintheon-muted)`, expand button (↗) top-right
   - If `catalyst.parentHighlight` exists, show it as a small italic subtitle above the title: `"branched from: {parentHighlight}"`

2. **Metadata strip** — horizontal row below title:
   - Risk category badge (from `catalyst.category`, use `RISK_LANE_LABELS` from grid-layout)
   - IV score if available (from card tags or severity mapped to 0-10)
   - Sentiment indicator: colored dot + text (bullish green / bearish red)

3. **Research bullets** — if `catalyst.researchBullets` exists and has items:
   - Map each `ResearchBullet` to: `• **{boldPhrase}**: {explanation}`
   - Bold phrase uses `font-weight: 600`, explanation is normal weight
   - Each bullet is a `<p>` element (not canvas text — must be DOM for text selection)
   - When `highlightMode` is true, bullets get `user-select: text` and amber selection color via CSS `::selection { background: color-mix(in srgb, var(--fintheon-accent) 40%, transparent) }`

4. **Drill deeper input** — at the bottom:
   - Shows `› Drill deeper...` as muted placeholder text
   - On click, expands into a text input
   - On Enter, calls `onDrillDeeper(catalyst.id, inputValue)`
   - Input collapses back to placeholder after submission
   - Loading state: show 3 skeleton bars while waiting for AI response

5. **Card chrome:**
   - Width: `280px` (or `compact ? 200px : 280px`)
   - Rounded corners (radius 12px)
   - Background: `color-mix(in srgb, var(--fintheon-surface) 90%, transparent)` with backdrop blur
   - Border: severity-based left border (3px):
     - `high` → `var(--fintheon-bearish)` (red)
     - `medium` → `var(--fintheon-accent)` (gold/amber)
     - `low` → `var(--fintheon-border)` (subtle)
   - If `catalyst.source === 'agent'` (MiroFish-generated): gold pulsing border animation
   - If `catalyst.isGhost`: dashed border, reduced opacity (0.7)
   - Selected state: full border glow matching sentiment color
   - Hover: subtle scale (1.01) + border brightens

**Highlight interaction within the card:**
- When `highlightMode` is true and user selects text within a bullet:
  - On `mouseup`, check `window.getSelection()` for selected text
  - If selection is non-empty and within this card's DOM:
    - Call `onHighlightBranch(catalyst.id, selectedText)`
    - Flash the selected text with amber highlight animation
    - Clear the selection after a short delay (300ms)

**No-bullets fallback:**
- If `catalyst.researchBullets` is empty/undefined, render the card body as:
  - `catalyst.description` text (if exists)
  - Otherwise just title + metadata (compact mode)
  - Still show "Drill deeper..." input

### 2. `frontend/components/narrative/NarrativeHighlightProvider.tsx` (~90 lines)

React context provider for highlight mode state.

```typescript
// [claude-code 2026-03-27] Highlight mode context — manages text selection → branch interaction

import React, { createContext, useContext, useState, useCallback } from 'react';

interface HighlightContextValue {
  highlightMode: boolean;
  setHighlightMode: (on: boolean) => void;
  toggleHighlightMode: () => void;
  activeHighlight: { cardId: string; text: string } | null;
  setActiveHighlight: (h: { cardId: string; text: string } | null) => void;
  clearHighlight: () => void;
}

const HighlightCtx = createContext<HighlightContextValue | null>(null);

export function NarrativeHighlightProvider({ children }: { children: React.ReactNode }) {
  const [highlightMode, setHighlightMode] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<{ cardId: string; text: string } | null>(null);

  const toggleHighlightMode = useCallback(() => {
    setHighlightMode(prev => {
      if (prev) setActiveHighlight(null); // clear on deactivate
      return !prev;
    });
  }, []);

  const clearHighlight = useCallback(() => setActiveHighlight(null), []);

  return (
    <HighlightCtx.Provider value={{
      highlightMode, setHighlightMode, toggleHighlightMode,
      activeHighlight, setActiveHighlight, clearHighlight,
    }}>
      {children}
    </HighlightCtx.Provider>
  );
}

export function useHighlight(): HighlightContextValue {
  const ctx = useContext(HighlightCtx);
  if (!ctx) throw new Error('useHighlight must be used within NarrativeHighlightProvider');
  return ctx;
}
```

### 3. `frontend/lib/narrative-highlight.ts` (~80 lines)

Text selection → branch logic. Pure utility functions (no React).

```typescript
// [claude-code 2026-03-27] Highlight → branch utility — text selection to child card creation

import type { CatalystCard, NarrativeCategory, CatalystSentiment } from './narrative-types';

/**
 * Given a parent card and highlighted text, create a child card spec.
 * Returns Omit<CatalystCard, 'id' | 'createdAt' | 'updatedAt'> for the reducer.
 */
export function createBranchCard(
  parent: CatalystCard,
  highlightedText: string,
  targetCategory?: NarrativeCategory,
): Omit<CatalystCard, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: highlightedText.slice(0, 60).toUpperCase(),
    description: `Branched from "${parent.title}" — exploring: ${highlightedText}`,
    date: parent.date,   // same date as parent by default
    sentiment: parent.sentiment,
    severity: parent.severity === 'high' ? 'medium' : 'low', // child defaults to lower severity
    source: 'research',
    narrativeIds: targetCategory
      ? []  // will be assigned to target lane during MOVE_CARD_TO_LANE
      : parent.narrativeIds,  // same lane as parent by default
    isGhost: false,
    templateType: null,
    position: null,
    tags: ['branch', `from:${parent.id.slice(0, 8)}`],
    category: targetCategory ?? parent.category,
    researchBullets: [],       // empty until AI fills them
    parentHighlight: highlightedText,
    parentCardId: parent.id,
    childCardIds: [],
    drillDepth: parent.drillDepth + 1,
  };
}

/**
 * Infer if highlighted text implies a different risk category than the parent.
 * Returns the suggested category, or null if it should stay in the same lane.
 *
 * Simple keyword heuristic — can be upgraded to LLM inference later.
 */
export function inferCrossLaneCategory(
  highlightedText: string,
  parentCategory: NarrativeCategory,
): NarrativeCategory | null {
  const text = highlightedText.toLowerCase();

  const categoryKeywords: Record<NarrativeCategory, string[]> = {
    'geopolitical': ['tariff', 'sanction', 'war', 'nato', 'china', 'russia', 'trade war', 'retaliation'],
    'monetary': ['fed', 'rate cut', 'rate hike', 'fomc', 'ecb', 'boj', 'quantitative', 'tightening', 'easing', 'powell'],
    'macroeconomic': ['cpi', 'gdp', 'payrolls', 'unemployment', 'inflation', 'pce', 'retail sales', 'ism'],
    'earnings': ['earnings', 'revenue', 'guidance', 'eps', 'q1', 'q2', 'q3', 'q4', 'beat', 'miss'],
    'market-structure': ['gamma', 'options', 'vix', 'liquidity', 'opex', 'dealer', 'positioning', 'short squeeze'],
    'supply-chain': ['shipping', 'supply chain', 'semiconductor', 'chip', 'logistics', 'port'],
    'black-swan': ['pandemic', 'earthquake', 'cyber', 'default', 'collapse', 'black swan', 'crisis'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (category === parentCategory) continue; // skip parent's own category
    if (keywords.some(kw => text.includes(kw))) {
      return category as NarrativeCategory;
    }
  }

  return null; // stay in same lane
}
```

---

## Key Rules / Corrections

- **Card width is 280px** (not full-viewport like ChatMind). Cards must fit in grid cells.
- **`compact` mode** (200px width) is used when grid cells are narrow (month zoom with many cards).
- **Bullets format:** `• **{boldPhrase}**: {explanation}` — use semantic HTML, not canvas.
- **`::selection` CSS** on bullets: `background: color-mix(in srgb, var(--fintheon-accent) 40%, transparent)` for amber highlight.
- **Text selection only works when `highlightMode` is true.** Normal card interaction (click to select, drag) takes priority otherwise. Use `user-select: none` by default, `user-select: text` when highlight mode is active.
- **Theme:** Solvys Stone (dark). Card background is dark surface with backdrop blur. NOT warm ivory.
- **No serif fonts.** Use the existing Fintheon font stack (system/Inter).
- **Loading skeleton for drill-deeper:** 3 animated bars (pulse opacity) while waiting for AI response.
- **Expand button (↗)** just calls `onExpand(catalyst.id)` — the modal implementation is left to unification (can reuse existing modal pattern).
- All new files get `// [claude-code 2026-03-27] description` header comments.
- No file over 300 lines.

---

## DO NOT

- Create or modify NarrativeGridView.tsx — that's T2 scope
- Create or modify NarrativeConnectionOverlay.tsx — that's T4 scope
- Modify NarrativeFlow.tsx or NarrativeToolbar.tsx — T2 owns those
- Modify narrative-types.ts, narrative-store.ts, or NarrativeContext.tsx — T1 owns those
- Call the research-drill API from within the card component — the card emits events (`onDrillDeeper`, `onHighlightBranch`), the parent wires the API calls. This keeps the card pure/presentational.
- Modify any Sanctum, RiskFlow, or backend files

---

## Verification

```bash
# Type check
cd frontend && npx tsc --noEmit

# Build
cd frontend && bun run build

# Unit verification (manual):
# 1. Import NarrativeResearchCard in a test harness or storybook-style page
# 2. Pass a CatalystCard with researchBullets populated
# 3. Verify bullets render as "• **bold**: explanation"
# 4. Verify highlight mode enables text selection
# 5. Verify onHighlightBranch fires with selected text
# 6. Verify drill-deeper input shows loading skeleton on submit

# File size check
wc -l frontend/components/narrative/NarrativeResearchCard.tsx      # must be < 300
wc -l frontend/components/narrative/NarrativeHighlightProvider.tsx  # must be < 300
wc -l frontend/lib/narrative-highlight.ts                           # must be < 300
```

---

## Changelog Entry

```typescript
{ date: '2026-03-27T00:00:00', agent: 'claude-code', summary: 'S4-T3: Built NarrativeResearchCard (ChatMind-style card with bullets, metadata strip, drill-deeper input, highlight support), NarrativeHighlightProvider (highlight mode context), and narrative-highlight.ts (text selection → branch card creation with cross-lane inference)', files: ['frontend/components/narrative/NarrativeResearchCard.tsx', 'frontend/components/narrative/NarrativeHighlightProvider.tsx', 'frontend/lib/narrative-highlight.ts'] }
```
