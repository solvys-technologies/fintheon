# S4-T4: Connections + AI Wiring

**Sprint:** S4 (NarrativeFlow Research Canvas Overhaul)
**Track:** T4 — Connections + AI Wiring
**Dependencies:** T1 complete (types, narrative-research.ts, reducer actions)

---

## Objective

Build the SVG connection overlay that renders parent→child arrows (from highlight-branching) and extends the existing RopeRenderer for cross-lane labeled connections. Wire the "drill deeper" and highlight-branch interactions to the AI research endpoint. This track handles all the "glue" between cards and AI.

---

## Files to Read First

- `frontend/lib/narrative-types.ts` — After T1: CatalystCard (parentCardId, childCardIds, drillDepth), ResearchBullet, HIGHLIGHT_BRANCH action
- `frontend/lib/narrative-research.ts` — After T1: drillResearch(), drillDeeperInCard() API wrappers
- `frontend/lib/narrative-catenary.ts` — Existing catenary curve math (computeCatenary, getCardAnchor)
- `frontend/components/narrative/RopeRenderer.tsx` — Existing SVG rope rendering (catenary paths, sentiment coloring, hover)
- `frontend/lib/narrative-highlight.ts` — After T3: createBranchCard(), inferCrossLaneCategory() (read-only reference)
- `frontend/contexts/NarrativeContext.tsx` — After T1: cardChildren, cardParent, ropesForCatalyst helpers
- `frontend/lib/narrative-grid-layout.ts` — After T1: RISK_LANES, RISK_LANE_LABELS for lane identification

---

## Files to Create

### 1. `frontend/components/narrative/NarrativeConnectionOverlay.tsx` (~250 lines)

SVG overlay for parent→child branch arrows, positioned absolutely over the grid.

**Purpose:** When a user highlights text in a card and branches, a curved arrow connects the parent card to the child card. This overlay renders all such arrows, plus any cross-lane connections.

**Props:**
```typescript
interface NarrativeConnectionOverlayProps {
  catalysts: CatalystCard[];
  ropes: Rope[];
  cardRefsMap: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  highlightMode: boolean;
}
```

**Rendering:**

1. **Parent→Child arrows** (from highlight branching):
   - For each catalyst that has `parentCardId`, draw an arrow from parent → child
   - Arrow style: curved SVG path (use `computeCatenary` from `narrative-catenary.ts`)
   - Color: `var(--fintheon-accent)` (gold/amber) — distinct from rope colors
   - Arrow has a small arrowhead at the child end (SVG `<marker>` with `<polygon>`)
   - **Text label on arrow:** show the `parentHighlight` text (truncated to 30 chars) as a small `<text>` element at the curve midpoint
   - Label background: tiny rounded rect behind text for readability
   - On hover: arrow thickens (strokeWidth 1→2), label fully visible
   - Arrow opacity: 0.7 default, 1.0 on hover

2. **Cross-lane rope connections** (extending existing rope system):
   - For ropes where the two endpoints are in different risk lanes:
     - Draw with thicker stroke (2px vs 1px)
     - Use a different dash pattern (longer dashes)
     - Color by polarity: reinforcing = `var(--fintheon-bullish)`, contradicting = `var(--fintheon-bearish)`
   - For ropes within the same lane: render as existing (thin, standard dash)

3. **Highlight mode visual feedback:**
   - When `highlightMode` is true, add a subtle pulsing glow to all parent→child arrows
   - Animate with CSS `@keyframes` (pulse opacity 0.5→1.0 over 1.5s)

**Position calculation:**
- Read card positions from `cardRefsMap` refs using `getBoundingClientRect()`
- Subtract container's bounding rect to get relative positions
- Use `getCardAnchor()` from `narrative-catenary.ts` for edge attachment points
- Re-render on container scroll and resize (use ResizeObserver + scroll event listener)

**SVG structure:**
```jsx
<svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
  <defs>
    <marker id="branch-arrow" ...>
      <polygon points="0 0, 8 4, 0 8" fill="var(--fintheon-accent)" />
    </marker>
  </defs>

  {/* Cross-lane ropes first (behind branch arrows) */}
  {crossLaneRopes.map(rope => (
    <g key={rope.id} className="pointer-events-auto">
      <path d={catenary.d} ... />
    </g>
  ))}

  {/* Branch arrows on top */}
  {branchConnections.map(({ parent, child, highlight }) => (
    <g key={`${parent.id}-${child.id}`} className="pointer-events-auto">
      <path d={catenary.d} markerEnd="url(#branch-arrow)" ... />
      <rect ... /> {/* label background */}
      <text ...>{highlight.slice(0, 30)}</text>
    </g>
  ))}
</svg>
```

### 2. `frontend/lib/narrative-ai-wiring.ts` (~120 lines)

Orchestration layer that connects UI events to AI calls and state updates.

```typescript
// [claude-code 2026-03-27] AI wiring — connects highlight/drill events to research endpoint and state

import type { CatalystCard, ResearchBullet, NarrativeAction } from './narrative-types';
import { drillDeeperInCard } from './narrative-research';
import { createBranchCard, inferCrossLaneCategory } from './narrative-highlight';

/**
 * Handle "Drill deeper" input within a card.
 * Calls the research-drill API and dispatches ADD_RESEARCH_BULLETS.
 */
export async function handleDrillDeeper(
  cardId: string,
  query: string,
  card: CatalystCard,
  dispatch: (action: NarrativeAction) => void,
): Promise<void> {
  const bullets = await drillDeeperInCard(
    query,
    card.title,
    card.description,
    card.category ?? 'macroeconomic',
    card.sentiment,
  );
  dispatch({ type: 'ADD_RESEARCH_BULLETS', cardId, bullets });
}

/**
 * Handle highlight → branch.
 * Creates a child card, dispatches HIGHLIGHT_BRANCH, then auto-generates research bullets for the child.
 */
export async function handleHighlightBranch(
  parentCard: CatalystCard,
  highlightedText: string,
  dispatch: (action: NarrativeAction) => void,
): Promise<string> {
  // Infer if the highlight implies a different risk lane
  const crossLaneCategory = inferCrossLaneCategory(
    highlightedText,
    parentCard.category ?? 'macroeconomic',
  );

  // Create the branch card spec
  const childSpec = createBranchCard(parentCard, highlightedText, crossLaneCategory ?? undefined);

  // Dispatch to create the child card + rope
  dispatch({
    type: 'HIGHLIGHT_BRANCH',
    parentId: parentCard.id,
    highlightText: highlightedText,
    childCard: childSpec,
  });

  // The child card ID is generated by the reducer — find it by parentHighlight match
  // (This is slightly imprecise; in production you'd return the ID from the reducer)
  // For now, trigger AI generation after a tick to let state settle
  setTimeout(async () => {
    try {
      const bullets = await drillDeeperInCard(
        highlightedText,
        parentCard.title,
        parentCard.description,
        (crossLaneCategory ?? parentCard.category ?? 'macroeconomic'),
        parentCard.sentiment,
      );
      // We need the child's ID — find the most recently added card with this parentHighlight
      // The consumer of this function should handle dispatching ADD_RESEARCH_BULLETS
      // by finding the child card in state after the HIGHLIGHT_BRANCH settles
    } catch (err) {
      console.error('[NarrativeAI] Auto-research for branch failed:', err);
    }
  }, 100);

  return highlightedText; // return for UI feedback
}

/**
 * Auto-research a newly branched card.
 * Call this after HIGHLIGHT_BRANCH has settled and you have the child card ID.
 */
export async function autoResearchBranch(
  childCard: CatalystCard,
  parentCard: CatalystCard,
  dispatch: (action: NarrativeAction) => void,
): Promise<void> {
  if (!childCard.parentHighlight) return;

  const bullets = await drillDeeperInCard(
    childCard.parentHighlight,
    parentCard.title,
    parentCard.description,
    childCard.category ?? parentCard.category ?? 'macroeconomic',
    parentCard.sentiment,
  );

  dispatch({ type: 'ADD_RESEARCH_BULLETS', cardId: childCard.id, bullets });
}
```

---

## Files to Modify

### 3. `frontend/components/narrative/RopeRenderer.tsx`

**What:** Extend to support labeled connections and cross-lane visual distinction.

**Changes:**
1. Add an optional `label?: string` to the rendered rope path data
2. For ropes connecting cards in different risk lanes (check card categories):
   - Use thicker stroke: `strokeWidth={2}` instead of `1`
   - Add text label at midpoint showing relationship context
3. Add a small `<text>` element at catenary midpoint for labeled ropes
4. Ropes connected to cards with `drillDepth > 0` are rendered with reduced opacity (0.5) so they don't overwhelm the branch arrows

**Keep everything else exactly as-is.** The existing catenary math, hover tooltips, sentiment coloring, replay mode, and conflict badges all stay unchanged.

---

## Key Rules / Corrections

- **Branch arrows are distinct from ropes.** Arrows (parent→child from highlight branching) use `var(--fintheon-accent)` gold color with arrowheads. Ropes (manually created or auto-suggested connections) use existing sentiment colors. Don't mix them.
- **SVG overlay is `pointer-events: none` by default**, with `pointer-events: auto` on individual interactive elements (hover targets).
- **Position recalculation** must happen on scroll and resize. Use `ResizeObserver` on the container and `scroll` event listener. Debounce the recalc to 16ms (one animation frame).
- **`computeCatenary` from `narrative-catenary.ts`** takes `(from, to, sag)` and returns `{ d, length, midpoint, controlPoints }`. The `d` is an SVG path string. The `midpoint` is where to place labels.
- **Text labels on arrows** must have a background rect for readability on dark backgrounds. Use `var(--fintheon-bg)` with 80% opacity.
- **Branch arrows only render between cards that both have valid refs** in `cardRefsMap`. If a card isn't visible (scrolled out of view), its arrows aren't rendered.
- Theme: Solvys Stone (dark). Arrow labels are `var(--fintheon-muted)` text, `var(--fintheon-bg)` background.
- All new files get `// [claude-code 2026-03-27] description` header comments.
- No file over 300 lines.

---

## DO NOT

- Create or modify NarrativeGridView.tsx — that's T2 scope
- Create or modify NarrativeResearchCard.tsx — that's T3 scope
- Create or modify NarrativeHighlightProvider.tsx — that's T3 scope
- Modify NarrativeFlow.tsx or NarrativeToolbar.tsx — T2 owns those (highlight button is added during unification)
- Modify narrative-types.ts, narrative-store.ts, or NarrativeContext.tsx — T1 owns those
- Modify any Sanctum, RiskFlow, MiroFish, or other backend files
- Replace or rewrite existing RopeRenderer logic — only extend it

---

## Unification Responsibilities

During unification, the orchestrator will:
1. Import `NarrativeConnectionOverlay` into `NarrativeGridView.tsx` and render it as a sibling `<svg>` inside the grid container
2. Pass `cardRefsMap` and `gridContainerRef` from T2's grid to this overlay
3. Add "Highlight" toggle button to `NarrativeToolbar.tsx` (T2's version)
4. Wrap the grid section in `NarrativeHighlightProvider` (T3) in `NarrativeFlow.tsx`
5. Wire `handleDrillDeeper` and `handleHighlightBranch` from `narrative-ai-wiring.ts` to T3's card `onDrillDeeper` and `onHighlightBranch` callbacks

---

## Verification

```bash
# Type check
cd frontend && npx tsc --noEmit

# Build
cd frontend && bun run build

# Visual verification (after unification):
# 1. Create two cards in the same lane → verify no branch arrows (they're not branches)
# 2. Add a card with parentCardId set → verify branch arrow renders from parent to child
# 3. Hover over branch arrow → verify thickens and label appears
# 4. Create cards in different lanes with a rope → verify cross-lane rope is thicker
# 5. Verify SVG overlay doesn't block card interactions (pointer-events-none)

# File size check
wc -l frontend/components/narrative/NarrativeConnectionOverlay.tsx  # must be < 300
wc -l frontend/lib/narrative-ai-wiring.ts                           # must be < 300
```

---

## Changelog Entry

```typescript
{ date: '2026-03-27T00:00:00', agent: 'claude-code', summary: 'S4-T4: Built NarrativeConnectionOverlay (SVG branch arrows with labels + cross-lane ropes), narrative-ai-wiring.ts (drill-deeper + highlight-branch → AI endpoint orchestration). Extended RopeRenderer with cross-lane visual distinction and labeled connections.', files: ['frontend/components/narrative/NarrativeConnectionOverlay.tsx', 'frontend/lib/narrative-ai-wiring.ts', 'frontend/components/narrative/RopeRenderer.tsx'] }
```
