# Task Brief: T5 — Mobile RiskFlow

**Date:** 2026-04-14
**Scope:** Card feed with infinite scroll, pill filter bar, swipe-to-dismiss, pull-to-refresh, and expanded card detail view.
**Estimated files:** 10

## Project Memory (READ FIRST)

Before doing anything, read the project memory for critical context, patterns, and feedback from prior work:

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Key memories to load:** feedback_unified_feed_no_filters, feedback_catalyst_terminology, feedback_intersection_observer_root, feedback_backend_client_pattern, feedback_never_nuke_scored_items, feedback_dropped_items_must_mark_scored
- **Master plan:** `/Users/tifos/.claude/plans/tidy-foraging-garden.md`

## Context

RiskFlow is the real-time news and market event scoring system. On desktop it's a multi-panel infinite scroll feed with dropdown filters. On mobile, it becomes a vertical card feed with horizontal pill chips for filtering. Nothing Design: flat cards with severity-colored left borders, segmented loading bar for pull-to-refresh, inline expand for detail view. CRITICAL: Never filter by macroLevel by default — show ALL scored items (see memory).

## Files to Read First

- `frontend/components/feed/RiskFlowMain.tsx` — Desktop feed implementation, infinite scroll pattern, filter state
- `frontend/components/feed/RiskFlowDetailCard.tsx` — Card layout, severity display, content rendering
- `frontend/contexts/RiskFlowContext.tsx` — Full context: alerts, filters, polling, loadMore, hasMore, markSeen, clearAll
- `frontend/lib/services/riskflow.ts` — RiskFlowService API methods (list, markSeen, etc.)
- `frontend/lib/severity-config.ts` — SEVERITY_CONFIG with AlertSeverity mapping
- `frontend/types/api.ts` — RiskFlowItem type (id, title, content, severity, source, symbols, ivScore, subScores, econData)
- `mobile/components/shared/SurfaceCard.tsx` — Card wrapper (T4)
- `mobile/components/shared/SegmentedBar.tsx` — Progress bar component (T4)

## What to Build

### 1. `mobile/contexts/RiskFlowContext.tsx`

- **Path:** `mobile/contexts/RiskFlowContext.tsx`
- **Action:** Create
- **Spec:** Slimmed version of frontend's RiskFlowContext. State: `alerts: RiskFlowItem[]`, `isLoading`, `loadingMore`, `hasMore`, `highCount`, `mediumCount`, `lowCount`, `criticalCount`. Methods: `loadMore()` (appends next page), `refresh()` (resets and re-fetches), `markSeen(id)`, `removeAlert(id)`. Uses `useBackend().riskflow.list({ offset, limit: 20 })` for pagination. Initial fetch on mount. NEVER filter by macroLevel by default — fetch ALL scored items. Filter state is UI-only (client-side filter on the loaded alerts array).
- **Max lines:** 120

### 2. `mobile/hooks/useRiskFlowInfiniteScroll.ts`

- **Path:** `mobile/hooks/useRiskFlowInfiniteScroll.ts`
- **Action:** Create
- **Spec:** IntersectionObserver on a sentinel div at the bottom of the feed. When sentinel enters viewport AND `hasMore && !loadingMore`, calls `loadMore()`. CRITICAL: Must set `root` option to the scroll container ref, NOT viewport default (see memory: feedback_intersection_observer_root). Returns `sentinelRef` to attach to the sentinel div and `scrollContainerRef` for the scroll parent.
- **Max lines:** 35

### 3. `mobile/hooks/useRiskFlowFilters.ts`

- **Path:** `mobile/hooks/useRiskFlowFilters.ts`
- **Action:** Create
- **Spec:** UI-only filter state. State: `activeSeverity: 'all' | 'critical' | 'high' | 'medium' | 'low'`, `activeSources: Set<string>` (empty = show all). Methods: `setSeverity(level)`, `toggleSource(source)`, `clearFilters()`. Returns filtered alerts from RiskFlowContext based on active filters. Pure client-side filtering.
- **Max lines:** 40

### 4. `mobile/components/riskflow/RiskFlowPage.tsx`

- **Path:** `mobile/components/riskflow/RiskFlowPage.tsx`
- **Action:** Create
- **Spec:** Full page layout. Top: `RiskFlowFilterBar`. Below: scrollable card feed with `RiskFlowCard` for each filtered alert. Bottom sentinel div for infinite scroll. Pull-to-refresh at top via `PullToRefresh` wrapper. Loading state: `[LOADING FEED...]` centered in Space Mono. Empty state: `[NO ALERTS]` centered, `--text-disabled`. Loading more: `[LOADING...]` at bottom. Uses `useRiskFlowInfiniteScroll` and `useRiskFlowFilters`.
- **Max lines:** 80

### 5. `mobile/components/riskflow/RiskFlowFilterBar.tsx`

- **Path:** `mobile/components/riskflow/RiskFlowFilterBar.tsx`
- **Action:** Create
- **Spec:** Horizontal scrollable row of pill chips. Fixed position below toolbar. Chips: `ALL`, `CRIT`, `HIGH`, `MED`, `LOW`. Each chip: `1px solid var(--border-visible)`, pill radius (999px), Space Mono ALL CAPS 11px, padding 6px 14px, letter-spacing 0.06em. Active chip: `--text-display` text + `--text-display` border (white on dark). Inactive: `--text-secondary` text + `--border-visible` border. Second row (optional, only if sources loaded): source filter chips (smaller, `--text-disabled` when inactive). Tapping a severity chip calls `setSeverity()`. Touch targets >= 44px (use padding/margin).
- **Max lines:** 70

### 6. `mobile/components/riskflow/RiskFlowCard.tsx`

- **Path:** `mobile/components/riskflow/RiskFlowCard.tsx`
- **Action:** Create
- **Spec:** Individual alert card. SurfaceCard with `accentBorder="left"` — border color = severity color from SEVERITY_CONFIG (import from `@frontend/lib/severity-config`). Layout: Title in Space Grotesk 14px `--text-primary` (max 2 lines, truncate). Below title row: source icon/label in Space Mono 11px `--text-secondary` ALL CAPS, bullet, timestamp (relative: "2m", "1h", "3d"). Right side: severity chip badge (Space Mono 10px ALL CAPS, `1px solid` severity color, pill radius). Tap: toggles inline expansion showing `RiskFlowCardExpanded` content below. Swipe left: triggers `removeAlert(id)` with fade-out 200ms. Card enter animation: opacity fade 200ms ease-out.
- **Max lines:** 90

### 7. `mobile/components/riskflow/RiskFlowCardExpanded.tsx`

- **Path:** `mobile/components/riskflow/RiskFlowCardExpanded.tsx`
- **Action:** Create
- **Spec:** Expanded content shown inline below the card when tapped. Framer Motion height animation (200ms ease-out). Content: summary/content text in Space Grotesk 13px `--text-primary`. If agent notes exist: `AGENT NOTES` label (Space Mono ALL CAPS `--text-secondary`) + notes text. Sub-scores as stat rows: label left (Space Mono ALL CAPS `--text-secondary` 11px), value right (`--text-primary`, color = severity). If symbols present: symbol chips row. If external URL: `[OPEN SOURCE]` link in `--interactive`. Divider (`1px solid --border`) between card and expanded content.
- **Max lines:** 80

### 8. `mobile/components/shared/PullToRefresh.tsx`

- **Path:** `mobile/components/shared/PullToRefresh.tsx`
- **Action:** Create
- **Spec:** Pull-to-refresh gesture wrapper. On pull down past 80px threshold: triggers `onRefresh()` callback. Visual: segmented loading bar (SegmentedBar, compact size) fills mechanically across top as user pulls. When released past threshold: bar fills to 100% and shows `[REFRESHING...]` in Space Mono `--text-secondary`. When refresh completes: bar fades out 200ms. Uses touch events for pull detection. Only activates when scroll position is at top.
- **Max lines:** 80

### 9. `mobile/components/shared/SwipeAction.tsx`

- **Path:** `mobile/components/shared/SwipeAction.tsx`
- **Action:** Create
- **Spec:** Wraps a child element with swipe-to-action behavior. Props: `onSwipeLeft?: () => void`, `threshold?: number` (default 100px). When user swipes left past threshold: reveals a `--error` background behind the card, then triggers callback and fades out the card (opacity 0, 200ms). Uses Framer Motion `drag="x"` with `dragConstraints={{ left: -200, right: 0 }}`. If released before threshold, springs back.
- **Max lines:** 50

### 10. `mobile/components/shared/SeverityBadge.tsx`

- **Path:** `mobile/components/shared/SeverityBadge.tsx`
- **Action:** Create
- **Spec:** Severity indicator chip. Props: `severity: 'critical' | 'high' | 'medium' | 'low'`. Renders: SEVERITY_CONFIG[severity].label text (CRIT/HIGH/MED/LOW) in Space Mono ALL CAPS 10px, pill border in severity color, transparent bg. Uses CSS vars from severity-config for colors. Compact: padding 2px 8px.
- **Max lines:** 25

## Key Rules

- NEVER filter by macroLevel by default — show ALL scored items (memory: feedback_unified_feed_no_filters)
- Cards = NarrativeFlow, Rows = RiskFlow (memory: feedback_catalyst_terminology)
- IntersectionObserver must set `root` to scroll container ref (memory: feedback_intersection_observer_root)
- Severity colors come from CSS vars tied to theme — import SEVERITY_CONFIG from frontend
- Loading states: `[LOADING...]` bracket text, NOT skeletons
- No spring/bounce on swipe — use ease-out. Exception: SwipeAction snap-back can use a subtle spring since it's physics-based drag.

## DO NOT

- Filter by macroLevel by default
- Use skeleton loading animations
- Add shadow or blur to cards
- Create new backend endpoints — use existing RiskFlowService
- Touch `frontend/` or `backend-hono/` files
- Delete or nuke scored items from the database

## Verification

```bash
cd mobile && bun run build
cd mobile && bun run dev
# RiskFlow tab: shows card feed loading from backend
# Scroll down: more cards load via infinite scroll
# Pull down at top: segmented bar fills, feed refreshes
# Tap severity chip: filters cards client-side
# Tap card: expands inline with details
# Swipe card left: card dismissed with fade
```

## Changelog Entry

```typescript
{
  date: '2026-04-14T00:00:00',
  agent: 'claude-code',
  summary: 'T5: Mobile RiskFlow with Nothing-style card feed, pill filter bar, infinite scroll, pull-to-refresh with segmented bar, swipe-to-dismiss, inline card expansion',
  files: ['mobile/contexts/RiskFlowContext.tsx', 'mobile/components/riskflow/RiskFlowPage.tsx', 'mobile/components/riskflow/RiskFlowFilterBar.tsx', 'mobile/components/riskflow/RiskFlowCard.tsx', 'mobile/components/riskflow/RiskFlowCardExpanded.tsx', 'mobile/components/shared/PullToRefresh.tsx', 'mobile/components/shared/SwipeAction.tsx', 'mobile/components/shared/SeverityBadge.tsx', 'mobile/hooks/useRiskFlowInfiniteScroll.ts', 'mobile/hooks/useRiskFlowFilters.ts']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
