# Task Brief: RiskFlow — Fix Infinite Scroll + Chronological Sort + Full DB Access
**Date:** 2026-04-03
**Scope:** Fix infinite scroll, switch to chronological sort, and ensure ALL scored items from DB are accessible via pagination
**Estimated files:** 4

## Context
RiskFlow currently shows only ~29 items because the in-memory `feedCache` is poorly seeded. There are **801 items in `scored_riskflow_items`** (162 from last 48h) but only 50 are loaded on cold start. Infinite scroll is broken because the `IntersectionObserver` has no `root` option — it observes against the viewport, but the sentinel is inside a scrollable `overflow-y-auto` container, so it never fires. Additionally, items are sorted by `macroLevel DESC` first, then by date — user wants purely chronological (`publishedAt DESC`).

## Files to Read First
- `frontend/components/feed/RiskFlowMain.tsx` — Infinite scroll observer + sentinel (lines 29-43, 81, 169)
- `frontend/contexts/RiskFlowContext.tsx` — `pollBackendFeed` (line 180), `loadMore` (line 229), `hasMore` state
- `backend-hono/src/services/riskflow/feed-service.ts` — `warmCacheFromDB` (line 138), `sortFeedItems` (line 79), `getFeed` (line 615), `MAX_FEED_ITEMS` (line 36)
- `backend-hono/src/services/supabase-service.ts` — `readScoredItems` (line 150) — DB query with `macro_level DESC` order

## What to Build/Change

### 1. `frontend/components/feed/RiskFlowMain.tsx` — Fix IntersectionObserver
- **Action:** Modify
- **Problem:** Line 33-39: `new IntersectionObserver(callback, { rootMargin: '200px' })` has no `root` option. The outer div (line 81) has `overflow-y-auto`, creating a scroll container. The sentinel (line 169) is inside this container. The observer uses viewport as root by default, so the sentinel is always "in view" from the viewport's perspective — it just isn't scrolled to within the container.
- **Fix:** Add a ref to the scroll container and pass it as `root`:
  ```tsx
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // ...
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
        void loadMore();
      }
    },
    { root: scrollContainerRef.current, rootMargin: '200px' },
  );
  ```
  Then on line 81: `<div ref={scrollContainerRef} className="h-full overflow-y-auto ...">` 

### 2. `backend-hono/src/services/riskflow/feed-service.ts` — Chronological sort + bigger cold start
- **Action:** Modify
- **Line 79-86 (`sortFeedItems`):** Change sort to pure chronological:
  ```ts
  function sortFeedItems(items: FeedItem[]): FeedItem[] {
    return [...items].sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }
  ```
- **Line 140 (`warmCacheFromDB`):** Increase cold start from 50 to 200:
  ```ts
  const scored = await readScoredItems({ limit: 200 });
  ```
- **Lines 636-644 (`getFeed` sort):** Change to pure chronological:
  ```ts
  items.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  ```

### 3. `backend-hono/src/services/supabase-service.ts` — Chronological DB query
- **Action:** Modify
- **Lines 158-163 (`readScoredItems`):** Change primary sort from `macro_level DESC` to `created_at DESC`:
  ```ts
  let query = sb
    .from('scored_riskflow_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 100);
  ```

### 4. `frontend/components/feed/RiskFlowMain.tsx` — Priority dropdown (separate fix, same file)
- **Action:** Modify (while you're in the file)
- **Line 12:** Expand type: `type PriorityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';`
- **Lines 66-67:** Add counts:
  ```ts
  const critCount = alerts.filter((a) => a.severity === 'critical').length;
  const highCount = alerts.filter((a) => a.severity === 'high').length;
  const medCount = alerts.filter((a) => a.severity === 'medium').length;
  const lowCount = alerts.filter((a) => a.severity === 'low').length;
  ```
- **Lines 73-74:** Add filter branches:
  ```ts
  if (priorityFilter === 'critical') base = base.filter((a) => a.severity === 'critical');
  else if (priorityFilter === 'high') base = base.filter((a) => a.severity === 'high');
  else if (priorityFilter === 'medium') base = base.filter((a) => a.severity === 'medium');
  else if (priorityFilter === 'low') base = base.filter((a) => a.severity === 'low');
  ```
- **Lines 127-130:** Add options:
  ```html
  <option value="all">Priority: All ({alerts.length})</option>
  <option value="critical">Critical ({critCount})</option>
  <option value="high">High ({highCount})</option>
  <option value="medium">Medium ({medCount})</option>
  <option value="low">Low ({lowCount})</option>
  ```

## Key Rules
- The in-memory `feedCache` is the single source for `getFeed()`. If the cache only has 50 items, infinite scroll will always cap at 50. The cold start MUST seed enough items.
- `loadMore` on the frontend sends `offset: backendAlerts.length` — the backend paginates from `feedCache`. This works IF the cache is big enough.
- The dashboard (`MainDashboard.tsx`) renders RiskFlow items inline via `tapeAlerts` (NOT via `RiskFlowMain`). This brief does NOT touch the dashboard — only the standalone RiskFlow tab.
- `MAX_FEED_ITEMS = 500` is the hard cap. Don't increase this.
- Keep `minMacroLevel: 0` in frontend calls — user wants ALL items regardless of level.

## DO NOT
- Touch `MainDashboard.tsx` or any dashboard rendering
- Change the polling interval or polling logic
- Modify the central scorer or enrichment pipeline
- Remove the `macroLevel` field from items — it's used for severity mapping
- Touch `RiskFlowContext.tsx` merge logic (Notion + Backend merge)

## Verification
```bash
cd backend-hono && bun run build
cd ../frontend && npx tsc --noEmit && npx vite build
```
Then:
1. Restart backend: `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist && launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`
2. Open RiskFlow tab — should see items sorted newest-first (chronological)
3. Scroll to bottom — infinite scroll should trigger and load more items
4. Priority dropdown should show All, Critical, High, Medium, Low with counts
5. Verify `curl "http://localhost:8080/api/riskflow/feed?limit=5"` returns items in chronological order

## Changelog Entry
```typescript
{
  date: '2026-04-03T00:00:00',
  agent: 'claude-code',
  summary: 'Fix RiskFlow infinite scroll (IntersectionObserver root), switch to chronological sort, increase cold start to 200 items, add missing Critical/Low priority filters',
  files: [
    'frontend/components/feed/RiskFlowMain.tsx',
    'backend-hono/src/services/riskflow/feed-service.ts',
    'backend-hono/src/services/supabase-service.ts'
  ]
}
```
