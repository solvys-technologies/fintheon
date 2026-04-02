# S9-T5 Track 3: Hierarchical Zoom System

**Sprint:** S9-T5 Sanctum Map Intelligence Overhaul
**Track:** T3 — Hierarchical Zoom System
**Depends on:** T1 (Ropes Fix) must be complete first
**Estimated files:** 3 new, 2 modified

---

## Objective

Replace the current 4-tier zoom (fullCard → miniCard → bubble → dot) with a 5-tier hierarchical system that collapses catalyst cards into meaningful temporal+narrative clusters, then narrative threads, then NarrativeCategory groups with market regime badges. Users should be able to understand the map at ANY zoom level.

---

## Files to Read First

1. `frontend/components/narrative/NarrativeForceCanvas.tsx` — current zoom state machine (lines 91-96 `getCanvasZoomLevel`, lines 340-410 `buildNodesForZoom`, lines 640-649 viewport change handler)
2. `frontend/lib/narrative-types.ts` — `NarrativeCategory`, `CatalystCard`, `CatalystSentiment` types
3. `frontend/lib/narrative-force-layout.ts` — `CATEGORY_COLORS`, `FORCE_CONFIG`, `HUB_POSITIONS`
4. `frontend/components/narrative/NarrativeForceCanvas.tsx` — existing node types: `EventCardNode`, `MiniEventCardNode`, `NarrativeHubNode`, `NarrativeSummaryCard`, `DotNode` (lines 258-264)
5. `frontend/data/narrative-seed-events.json` — seed data structure (has `narrative`, `narrativeThreads`, `category`, `date`, `sentiment`)

---

## Hierarchy Design

### 5-Tier Zoom Levels (zoomed IN → zoomed OUT)

| Tier | Zoom Range | What Renders | Node Type |
|------|-----------|--------------|-----------|
| **fullCard** | >= 0.7 | Individual catalyst cards with full detail | `eventCard` (existing) |
| **miniCard** | 0.4 - 0.7 | Compact cards with title + sentiment dot | `miniCard` (existing) |
| **temporalCluster** | 0.2 - 0.4 | Same-narrative + same-week cards collapsed into cluster | `temporalCluster` (NEW) |
| **narrativeThread** | 0.1 - 0.2 | Entire narrative threads as single nodes | `narrativeHub` (existing, enhanced) |
| **categoryOverview** | < 0.1 | NarrativeCategory groups with regime badge | `categoryCluster` (NEW) |

### Zoom Level Function (replaces current `getCanvasZoomLevel`)

```typescript
type CanvasZoomLevel = 'fullCard' | 'miniCard' | 'temporalCluster' | 'narrativeThread' | 'categoryOverview';

function getCanvasZoomLevel(zoom: number): CanvasZoomLevel {
  if (zoom >= 0.7) return 'fullCard';
  if (zoom >= 0.4) return 'miniCard';
  if (zoom >= 0.2) return 'temporalCluster';
  if (zoom >= 0.1) return 'narrativeThread';
  return 'categoryOverview';
}
```

---

## New File 1: `frontend/lib/narrative-hierarchy.ts`

Computes the hierarchical groupings at render time from existing card fields.

```typescript
import type { CatalystCard, NarrativeCategory, CatalystSentiment } from './narrative-types';

export type MarketRegime = 'risk-on' | 'risk-off' | 'rotation' | 'neutral';

export interface TemporalCluster {
  id: string;                    // e.g., 'tc-rate-cut-cycle-2024-W32'
  narrativeSlug: string;
  weekKey: string;               // e.g., '2024-W32'
  label: string;                 // e.g., 'Rate Cut Cycle — Aug W1'
  cards: CatalystCard[];
  dominantSentiment: CatalystSentiment;
  maxSeverity: 'high' | 'medium' | 'low';
  center: { x: number; y: number };  // average position of contained cards
}

export interface CategoryGroup {
  id: string;                    // e.g., 'cg-monetary'
  category: NarrativeCategory;
  regime: MarketRegime;
  threads: string[];             // narrative slugs in this category
  cardCount: number;
  center: { x: number; y: number };
}

export function getWeekKey(dateStr: string): string { ... }
export function getWeekLabel(weekKey: string): string { ... }
export function computeTemporalClusters(cards: CatalystCard[], positions: Map<string, {x:number,y:number}>): TemporalCluster[] { ... }
export function computeCategoryGroups(cards: CatalystCard[], clusters: TemporalCluster[], positions: Map<string, {x:number,y:number}>): CategoryGroup[] { ... }
export function computeRegime(cards: CatalystCard[]): MarketRegime { ... }
```

### Key Logic

**`getWeekKey(dateStr)`**: Convert date to ISO week key.
```typescript
export function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
```

**`getWeekLabel(weekKey)`**: Human-readable label.
```typescript
export function getWeekLabel(weekKey: string): string {
  const [year, week] = weekKey.split('-W');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Approximate month from week number
  const monthIndex = Math.min(11, Math.floor((parseInt(week) - 1) / 4.33));
  const weekInMonth = Math.ceil((parseInt(week) - monthIndex * 4.33));
  return `${monthNames[monthIndex]} W${weekInMonth}`;
}
```

**`computeTemporalClusters(cards, positions)`**:
```typescript
export function computeTemporalClusters(
  cards: CatalystCard[],
  positions: Map<string, { x: number; y: number }>
): TemporalCluster[] {
  // Group cards by (narrative, weekKey)
  const groups = new Map<string, CatalystCard[]>();
  for (const card of cards) {
    const narrative = card.narrative ?? card.narrativeThreads?.[0] ?? 'unassigned';
    const weekKey = getWeekKey(card.date);
    const key = `${narrative}::${weekKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }

  const clusters: TemporalCluster[] = [];
  for (const [key, groupCards] of groups) {
    const [narrativeSlug, weekKey] = key.split('::');
    // Compute center as average of card positions
    let cx = 0, cy = 0, count = 0;
    for (const c of groupCards) {
      const pos = positions.get(c.id);
      if (pos) { cx += pos.x; cy += pos.y; count++; }
    }
    if (count > 0) { cx /= count; cy /= count; }

    // Dominant sentiment: majority wins
    const bullish = groupCards.filter(c => c.sentiment === 'bullish').length;
    const dominantSentiment: CatalystSentiment = bullish > groupCards.length / 2 ? 'bullish' : 'bearish';

    // Max severity
    const maxSeverity = groupCards.some(c => c.severity === 'high') ? 'high'
      : groupCards.some(c => c.severity === 'medium') ? 'medium' : 'low';

    // Thread title for label
    const threadTitle = narrativeSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    clusters.push({
      id: `tc-${narrativeSlug}-${weekKey}`,
      narrativeSlug,
      weekKey,
      label: `${threadTitle} — ${getWeekLabel(weekKey)} (${groupCards.length})`,
      cards: groupCards,
      dominantSentiment,
      maxSeverity,
      center: { x: cx, y: cy },
    });
  }
  return clusters;
}
```

**`computeRegime(cards)`**:
```typescript
export function computeRegime(cards: CatalystCard[]): MarketRegime {
  if (cards.length === 0) return 'neutral';
  const bullish = cards.filter(c => c.sentiment === 'bullish').length;
  const ratio = bullish / cards.length;
  if (ratio >= 0.6) return 'risk-on';
  if (ratio <= 0.4) return 'risk-off';
  return 'rotation';
}
```

**`computeCategoryGroups(cards, clusters, positions)`**:
```typescript
export function computeCategoryGroups(
  cards: CatalystCard[],
  clusters: TemporalCluster[],
  positions: Map<string, { x: number; y: number }>
): CategoryGroup[] {
  const catMap = new Map<NarrativeCategory, CatalystCard[]>();
  for (const card of cards) {
    const cat = card.category ?? 'macroeconomic';
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push(card);
  }

  const groups: CategoryGroup[] = [];
  for (const [category, catCards] of catMap) {
    const threads = [...new Set(catCards.map(c => c.narrative ?? c.narrativeThreads?.[0]).filter(Boolean))] as string[];
    // Center = average of all card positions in this category
    let cx = 0, cy = 0, count = 0;
    for (const c of catCards) {
      const pos = positions.get(c.id);
      if (pos) { cx += pos.x; cy += pos.y; count++; }
    }
    if (count > 0) { cx /= count; cy /= count; }

    groups.push({
      id: `cg-${category}`,
      category,
      regime: computeRegime(catCards),
      threads,
      cardCount: catCards.length,
      center: { x: cx, y: cy },
    });
  }
  return groups;
}
```

---

## New File 2: `frontend/components/narrative/TemporalClusterNode.tsx`

React Flow custom node for temporal clusters (zoom level 0.2-0.4).

### Visual Design

```
┌──────────────────────────────────┐
│ ● Rate Cut Cycle — Aug W1 (4)   │  ← thread color dot + label
│ ▲▲▼▲                            │  ← sentiment indicators for each card
│ HIGH | 4 events                  │  ← max severity + count
└──────────────────────────────────┘
```

- Width: 220px
- Background: `var(--fintheon-surface)` with thread-colored left border (3px)
- Title: cluster label in `text-xs font-mono`
- Sentiment row: small arrows (▲ green for bullish, ▼ red for bearish) for each card
- Bottom row: severity badge + event count
- Opacity transitions smoothly during zoom

### Component (~100 lines)

```typescript
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TemporalCluster } from '../../lib/narrative-hierarchy';

// NARRATIVE_THREADS color lookup (import from NarrativeForceCanvas or narrative-force-layout)
const THREAD_COLORS: Record<string, string> = { /* ... */ };

interface TemporalClusterNodeData extends TemporalCluster {
  settled: boolean;
}

export const TemporalClusterNode = memo(({ data }: NodeProps<TemporalClusterNodeData>) => {
  const threadColor = THREAD_COLORS[data.narrativeSlug] ?? '#6B7280';
  const severityColor = data.maxSeverity === 'high' ? 'var(--fintheon-severe)'
    : data.maxSeverity === 'medium' ? 'var(--fintheon-accent)' : 'var(--fintheon-text-muted)';

  return (
    <div
      className="rounded-lg px-3 py-2 border transition-opacity duration-300"
      style={{
        width: 220,
        backgroundColor: 'var(--fintheon-surface)',
        borderColor: `${threadColor}30`,
        borderLeftColor: threadColor,
        borderLeftWidth: 3,
        opacity: data.settled ? 1 : 0,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />

      {/* Label */}
      <div className="text-[10px] font-mono text-[var(--fintheon-text)] truncate" title={data.label}>
        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: threadColor }} />
        {data.label}
      </div>

      {/* Sentiment indicators */}
      <div className="flex gap-0.5 mt-1">
        {data.cards.slice(0, 12).map((card, i) => (
          <span
            key={i}
            className="text-[8px]"
            style={{ color: card.sentiment === 'bullish' ? '#34D399' : '#EF4444' }}
          >
            {card.sentiment === 'bullish' ? '▲' : '▼'}
          </span>
        ))}
        {data.cards.length > 12 && <span className="text-[8px] text-[var(--fintheon-text-muted)]">+{data.cards.length - 12}</span>}
      </div>

      {/* Severity + count */}
      <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-[var(--fintheon-text-muted)]">
        <span style={{ color: severityColor }}>{data.maxSeverity.toUpperCase()}</span>
        <span>{data.cards.length} events</span>
      </div>
    </div>
  );
});
TemporalClusterNode.displayName = 'TemporalClusterNode';
```

---

## New File 3: `frontend/components/narrative/CategoryClusterNode.tsx`

React Flow custom node for category overview (zoom level < 0.1).

### Visual Design

```
┌────────────────────────────────────┐
│          MONETARY POLICY           │  ← category name
│        ┌─────────────────┐         │
│        │   RISK-OFF  ▼   │         │  ← regime badge
│        └─────────────────┘         │
│   3 threads · 18 events           │  ← summary stats
└────────────────────────────────────┘
```

- Width: 280px
- Background: category color at 8% opacity
- Border: category color at 30% opacity
- Regime badge: colored pill (risk-on=green, risk-off=red, rotation=amber, neutral=gray)
- Text: category name in `text-sm font-mono tracking-widest`, uppercase
- Stats: thread count + event count

### Component (~90 lines)

```typescript
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CategoryGroup, MarketRegime } from '../../lib/narrative-hierarchy';
import { CATEGORY_COLORS } from '../../lib/narrative-force-layout';

const CATEGORY_LABELS: Record<string, string> = {
  geopolitical: 'GEOPOLITICAL',
  monetary: 'MONETARY POLICY',
  macroeconomic: 'MACROECONOMIC',
  'market-structure': 'MARKET STRUCTURE',
  earnings: 'EARNINGS',
  'supply-chain': 'SUPPLY CHAIN',
  'black-swan': 'BLACK SWAN',
};

const REGIME_STYLES: Record<MarketRegime, { bg: string; text: string; label: string }> = {
  'risk-on':  { bg: '#34D39920', text: '#34D399', label: 'RISK-ON ▲' },
  'risk-off': { bg: '#EF444420', text: '#EF4444', label: 'RISK-OFF ▼' },
  rotation:   { bg: '#F59E0B20', text: '#F59E0B', label: 'ROTATION ↔' },
  neutral:    { bg: '#6B728020', text: '#6B7280', label: 'NEUTRAL —' },
};

interface CategoryClusterNodeData extends CategoryGroup {
  settled: boolean;
}

export const CategoryClusterNode = memo(({ data }: NodeProps<CategoryClusterNodeData>) => {
  const catColor = CATEGORY_COLORS[data.category] ?? '#6B7280';
  const regime = REGIME_STYLES[data.regime];

  return (
    <div
      className="rounded-xl px-5 py-4 border text-center transition-opacity duration-500"
      style={{
        width: 280,
        backgroundColor: `${catColor}14`,
        borderColor: `${catColor}4D`,
        opacity: data.settled ? 1 : 0,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />

      <div className="text-sm font-mono tracking-widest" style={{ color: catColor }}>
        {CATEGORY_LABELS[data.category] ?? data.category.toUpperCase()}
      </div>

      <div
        className="inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-mono tracking-wider"
        style={{ backgroundColor: regime.bg, color: regime.text }}
      >
        {regime.label}
      </div>

      <div className="mt-2 text-[10px] font-mono text-[var(--fintheon-text-muted)]">
        {data.threads.length} threads · {data.cardCount} events
      </div>
    </div>
  );
});
CategoryClusterNode.displayName = 'CategoryClusterNode';
```

---

## Files to Modify

### 1. `frontend/components/narrative/NarrativeForceCanvas.tsx`

**A. Update zoom level type and function** (around line 91):

Replace the existing `CanvasZoomLevel` type and `getCanvasZoomLevel` function with the 5-tier version above.

**B. Register new node types** (around line 258):

```typescript
import { TemporalClusterNode } from './TemporalClusterNode';
import { CategoryClusterNode } from './CategoryClusterNode';

const nodeTypes = {
  eventCard: EventCardNode,
  miniCard: MiniEventCardNode,
  narrativeHub: NarrativeHubNode,
  narrativeSummary: NarrativeSummaryCard,
  narrativeDot: DotNode,
  temporalCluster: TemporalClusterNode,   // NEW
  categoryCluster: CategoryClusterNode,    // NEW
};
```

**C. Update `buildNodesForZoom` function** (around line 340):

Add two new cases for the new zoom levels:

```typescript
// After the existing 'bubble' and 'dot' cases...

if (zoomLevel === 'temporalCluster') {
  // Hub nodes (same as miniCard view)
  for (const thread of NARRATIVE_THREADS) {
    const pos = positions.get(`hub-${thread.slug}`) ?? HUB_POSITIONS[thread.slug] ?? { x: 0, y: 0 };
    nodes.push({
      id: `hub-${thread.slug}`,
      type: 'narrativeHub',
      position: pos,
      data: { slug: thread.slug, title: thread.title, color: thread.color, count: cardsByThread.get(thread.slug)?.length ?? 0, settled },
      draggable: true,
    });
  }

  // Temporal cluster nodes (instead of individual cards)
  const clusters = computeTemporalClusters(catalysts, positions);
  for (const cluster of clusters) {
    nodes.push({
      id: cluster.id,
      type: 'temporalCluster',
      position: cluster.center,
      data: { ...cluster, settled },
      draggable: true,
    });
  }
  return nodes;
}

if (zoomLevel === 'categoryOverview') {
  const clusters = computeTemporalClusters(catalysts, positions);
  const groups = computeCategoryGroups(catalysts, clusters, positions);
  for (const group of groups) {
    nodes.push({
      id: group.id,
      type: 'categoryCluster',
      position: group.center,
      data: { ...group, settled },
      draggable: true,
    });
  }
  return nodes;
}
```

**D. Update `buildEdges` function** (line 413):

Add handling for the new zoom levels:

```typescript
function buildEdges(catalysts: CatalystCard[], zoomLevel: CanvasZoomLevel, nodeIds: Set<string>): Edge[] {
  if (zoomLevel === 'dot' || zoomLevel === 'categoryOverview') return [];

  // ... existing code for bubble, fullCard, miniCard ...

  if (zoomLevel === 'temporalCluster') {
    // Hub-to-cluster ropes (connect each cluster to its narrative hub)
    const clusters = computeTemporalClusters(catalysts, new Map()); // positions not needed for ID computation
    for (const cluster of clusters) {
      const hubId = `hub-${cluster.narrativeSlug}`;
      if (nodeIds.has(cluster.id) && nodeIds.has(hubId)) {
        edges.push({
          id: `edge-${cluster.id}-${hubId}`,
          source: cluster.id,
          target: hubId,
          type: 'smoothstep',
          style: { stroke: THREAD_COLOR_MAP[cluster.narrativeSlug] ?? '#6B7280', strokeWidth: 1.5, opacity: 0.2 },
        });
      }
    }
    return edges;
  }

  // ... rest of existing fullCard/miniCard edge logic ...
}
```

### 2. `frontend/lib/narrative-force-layout.ts`

Export `CATEGORY_COLORS` if not already exported (needed by CategoryClusterNode).

---

## Verification

1. Open Sanctum map at default zoom (100%) — should see full catalyst cards (unchanged)
2. Zoom out to ~50% — should see compact mini cards (unchanged)
3. Zoom out to ~30% — should see **temporal cluster nodes** replacing individual cards. Each cluster shows narrative + week label, sentiment arrows, severity badge
4. Zoom out to ~15% — should see **narrative thread nodes** (existing hub enhancement)
5. Zoom out to ~8% — should see **category cluster nodes** with regime badges (RISK-ON/OFF/ROTATION)
6. Zoom transitions should be smooth — no flickering or missing nodes
7. Dragging works at each zoom level
8. `npx tsc --noEmit` passes
9. `bun run build` passes

---

## Changelog Entry

```typescript
{ date: '2026-03-29T__:__:__', agent: 'claude-code', summary: 'feat(sanctum): 5-tier hierarchical zoom — temporal clusters, category groups with regime badges, replaces dot/bubble tiers', files: ['frontend/lib/narrative-hierarchy.ts', 'frontend/components/narrative/TemporalClusterNode.tsx', 'frontend/components/narrative/CategoryClusterNode.tsx', 'frontend/components/narrative/NarrativeForceCanvas.tsx'] }
```

---

## DO NOT

- Do NOT touch the rope engine or seed loader — that's T1's scope
- Do NOT touch ConsiliumHub.tsx or create filter UI — that's T2's scope
- Do NOT touch Apparatus files — that's T4's scope
- Do NOT remove the existing `NarrativeSummaryCard` or `DotNode` — keep them as fallbacks, just adjust which zoom ranges use them
- Do NOT exceed 300 lines per file
