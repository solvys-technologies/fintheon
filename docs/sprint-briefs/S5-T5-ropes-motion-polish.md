# S5-T5: Rope Engine + Tag-Based Connections + Living Motion + Anti-Default Polish

**Sprint:** S5 — NarrativeFlow Intelligence Map
**Track:** T5 (Frontend — Connections, Motion, Design)
**Depends On:** T1 (tree layout, types), T3 (mini card component)
**Runs After:** T1 + T3 complete (or during unification)

---

## Context

This track brings the NarrativeFlow map to life. Three concerns:

1. **Rope engine** — Auto-connect cards that share tags. Ropes (SVG paths) render between connected cards.
2. **Living motion** — Staggered card entrances, spring physics on zoom transitions, severity glow pulses, smooth pan/zoom.
3. **Anti-default polish** — Kill generic card grids. Apply Solvys Gold editorial design. Every element placed with purpose.

Key decisions from TP:
- **Ropes auto-populate** based on shared tags between cards
- **Tags visible** in the footer of each card's pop-out detail panel
- **Motion: Living** — rich choreography, not subtle. Cards stagger in, zoom has spring physics, new items slide into position.

---

## Files to Read First

- `frontend/components/narrative/NarrativeMiniCard.tsx` — T3's card component (render target for connections)
- `frontend/lib/narrative-types.ts` — CatalystCard with tags field
- `frontend/lib/narrative-tree-layout.ts` — T1's tree layout engine (for node positions)
- `frontend/hooks/useCanvasViewport.ts` — T1's zoom/pan hook
- `frontend/lib/narrative-store.ts` — store with catalysts array
- `frontend/components/narrative/NarrativeGridView.tsx` — existing grid (reference for card rendering loop)

---

## Task 1: Rope Engine — Tag-Based Connections

**File:** `frontend/lib/narrative-rope-engine.ts` (create, max 120 lines)

Computes connections between cards based on shared tags.

```typescript
export interface RopeConnection {
  id: string;           // `rope-${fromId}-${toId}`
  fromId: string;       // card ID
  toId: string;         // card ID
  sharedTags: string[]; // the tags they share
  strength: number;     // 0-1 based on tag overlap ratio
}

/**
 * Compute rope connections between all cards.
 * Two cards are connected if they share >= 1 tag.
 * Strength = sharedTags.length / Math.min(card1.tags.length, card2.tags.length)
 *
 * Limits:
 * - Max 100 connections total (prune weakest)
 * - Min strength threshold: 0.2 (at least 20% tag overlap)
 * - Don't connect cards in the same category+time bucket (too close visually)
 */
export function computeRopeConnections(
  cards: CatalystCard[],
  maxConnections?: number,
): RopeConnection[]
```

---

## Task 2: Rope Renderer

**File:** `frontend/components/narrative/NarrativeRopes.tsx` (create, max 150 lines)

SVG overlay that renders curved paths between connected cards.

```typescript
interface NarrativeRopesProps {
  connections: RopeConnection[];
  cardPositions: Map<string, { x: number; y: number; width: number; height: number }>;
  viewport: CanvasViewport;
  hoveredCardId: string | null;
}
```

**Rendering:**
- SVG positioned absolutely over the canvas, pointer-events: none
- Each rope is a cubic bezier (`<path d="M... C...">`)
- Path exits from right edge of source card, enters left edge of target
- Control points create a natural curve (not straight lines)
- **Color:** Gold (`#c79f4a`) at 20% opacity by default
- **Hover:** When a card is hovered, its ropes brighten to 80% opacity and thicken (2px → 3px)
- **Strength mapping:** `strength` maps to opacity (0.2 = 10%, 1.0 = 40% default)
- **Tags on hover:** When a rope is hovered (pointer events on rope paths only), show a tiny tooltip with shared tags

**Performance:**
- Only render ropes for cards currently visible in viewport (frustum culling)
- Use `useMemo` to avoid recomputing paths on every render
- `will-change: opacity` on rope elements

---

## Task 3: Living Motion System

**File:** `frontend/lib/narrative-motion.ts` (create, max 100 lines)

CSS animation utilities for the NarrativeFlow. No external animation library — pure CSS + requestAnimationFrame.

```typescript
/** Staggered entrance: cards appear with delay based on index */
export function staggerDelay(index: number, baseMs?: number): string
// Returns CSS: `animation-delay: ${index * 50 + baseMs}ms`

/** Spring physics easing for zoom transitions */
export const SPRING_EASE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

/** Severity glow keyframes — pulsing border glow for high-severity cards */
export const SEVERITY_GLOW_KEYFRAMES = `
@keyframes severity-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  50% { box-shadow: 0 0 12px 2px rgba(239, 68, 68, 0.3); }
}
`;

/** Card entrance animation class */
export const CARD_ENTER_CLASS = 'animate-card-enter';
// Keyframes: translateY(8px) opacity(0) → translateY(0) opacity(1), 300ms SPRING_EASE

/** Zoom transition — applies to canvas container */
export const ZOOM_TRANSITION = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
```

**Add to global CSS** (`frontend/index.css` or equivalent):

```css
@keyframes card-enter {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.animate-card-enter {
  animation: card-enter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes severity-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  50% { box-shadow: 0 0 12px 2px rgba(239, 68, 68, 0.3); }
}
.animate-severity-pulse {
  animation: severity-pulse 3s ease-in-out infinite;
}

@keyframes rope-draw {
  from { stroke-dashoffset: 1000; }
  to { stroke-dashoffset: 0; }
}
.animate-rope-draw {
  stroke-dasharray: 1000;
  animation: rope-draw 1.5s ease-out forwards;
}
```

---

## Task 4: Anti-Default Polish Pass

Apply across all NarrativeFlow components that exist after T1-T3:

**Kill list (from The Anti-Default Doctrine):**

1. **No uniform card sizing** — High-severity cards are 10% larger (scale 1.05). Low-severity are slightly muted (opacity 0.85).

2. **Category header nodes** — Not just text labels. Each category header is a styled node:
   - Left border colored by category (using ivHeatColor for the category's current heat score)
   - Monospace uppercase label
   - Subtle count badge showing how many cards in that category
   - Gold accent dot if any card in the category is HIGH severity

3. **Empty state** — When no cards exist in a category+time bucket, don't show nothing. Show a subtle dashed outline cell with "—" that invites interaction. NOT "No data found."

4. **Typography hierarchy** — Card titles at 10px semibold, descriptions at 9px regular, metadata at 8px mono. Hierarchy reads without color.

5. **Gold is earned** — `#c79f4a` appears only on:
   - Active card selection border
   - Category header accents
   - Rope connections
   - Import badge on RiskFlow-sourced cards

   Nowhere else. No gold backgrounds, no gold text on body copy.

6. **Severity-driven visual weight:**
   - HIGH: animate-severity-pulse, thicker left border (3px), slightly larger card
   - MEDIUM: standard rendering
   - LOW: reduced opacity (0.85), thinner border (1px)

---

## Verification

```bash
# Type-check
npx tsc --noEmit 2>&1 | grep "frontend/" | head -10

# Build
npx vite build 2>&1 | tail -5

# Verify new files
ls -la frontend/lib/narrative-rope-engine.ts frontend/components/narrative/NarrativeRopes.tsx frontend/lib/narrative-motion.ts

# Verify animations in CSS
grep -n "card-enter\|severity-pulse\|rope-draw" frontend/index.css

# Anti-default check: no #3B82F6 (default blue) in new files
grep -rn "#3B82F6\|bg-blue-500" frontend/components/narrative/Narrative{MiniCard,Ropes,MapView}.tsx || echo "Clean — no default blue"
```

---

## Changelog Entry

```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S5-T5: Rope engine auto-connects cards by shared tags with SVG bezier paths. Living motion system — staggered entrances, spring zoom, severity pulse. Anti-default polish: severity-driven card weight, gold-earned color discipline, editorial typography hierarchy.', files: ['frontend/lib/narrative-rope-engine.ts', 'frontend/components/narrative/NarrativeRopes.tsx', 'frontend/lib/narrative-motion.ts', 'frontend/index.css'] }
```

---

## DO NOT

- Do NOT modify backend files — T4 handles the pipeline
- Do NOT modify Sanctum components — T2 handles that
- Do NOT implement the CatalystModal or seed loader — T3 handles those
- Do NOT implement the tree layout engine — T1 handles that
- Do NOT use framer-motion or any external animation library — pure CSS + RAF
- Do NOT use gradients or colored emojis (PIC rule)
- Do NOT use #3B82F6 blue or any Tailwind default accent colors
