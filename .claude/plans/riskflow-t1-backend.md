# RiskFlow Fix — Track 1: Backend Level Filter + Warm Cache

## Context
You are Track 1 of 3 parallel tracks fixing the Pulse RiskFlow system.
This track fixes the backend: lower the minimum feed level from 3 (High+) to 2 (Medium+), expand
the twitter-cli warm cache from 10 Critical/High items to 30 Medium+ items, and ensure the
feed-service default is also level 2.

Tracks 2 and 3 run in parallel on the frontend. Your changes are pure backend — no frontend files.

## Codebase Conventions
- Comment at top of modified files: `// [claude-code 2026-03-10] Description`
- Add changelog entry to `frontend/src/lib/changelog.ts` (or `frontend/lib/changelog.ts`)
- No gradients, no colored emojis in any UI
- Run `cd backend-hono && npx tsc --noEmit` to verify TypeScript after changes

---

## Files to Modify

### 1. `backend-hono/src/routes/riskflow/handlers.ts`

**Find `handlePreload`** (around line 174) — change `minMacroLevel: 3` to `minMacroLevel: 2`:

```ts
// BEFORE:
const feed = await feedService.getFeed(userId, {
  limit: 15,
  minMacroLevel: 3,
});

// AFTER:
const feed = await feedService.getFeed(userId, {
  limit: 15,
  minMacroLevel: 2,   // Show medium (2) through critical (4)
});
```

**Also check `handleGetFeed`** — if there's a hardcoded default `minMacroLevel: 3` when the query param is absent, change it to `2`.

Look for any other `minMacroLevel: 3` in this file and change them all to `2`.

Add comment at top of file: `// [claude-code 2026-03-10] Lower default minMacroLevel from 3 to 2 (show medium through critical)`

---

### 2. `backend-hono/src/services/twitter-cli/econ-triggered-poller.ts`

**Find the warm cache init function** (`initFetchHighPriorityPosts` or similar, around lines 214-259):

Change the tier filter from `'high'` to `'medium'` and slice from `10` to `30`:

```ts
// BEFORE:
console.log('[EconTwitterPoller] Init fetch: pulling last 10 Critical/High posts from FJ + InsiderWire...');
// ...
const highPlus = filterByTier(allTweets, 'high');
// ...
.slice(0, 10)

// AFTER:
console.log('[EconTwitterPoller] Init fetch: pulling last 30 Medium+ posts from FJ + InsiderWire...');
// ...
const mediumPlus = filterByTier(allTweets, 'medium');
// ...
.slice(0, 30)
```

Rename variable `highPlus` → `mediumPlus` in the function (replace all occurrences within the function).

Also check if `getWarmCacheItems()` slices or caps the returned list — if so, update from 10 to 30 there too.

Add comment at top of file: `// [claude-code 2026-03-10] Warm cache now seeds 30 Medium+ items (was 10 High+ only)`

---

### 3. `backend-hono/src/services/riskflow/feed-service.ts`

Find any fallback or default `minMacroLevel` value. If there's a constant or default set to `3`, change it to `2`.

Look for patterns like:
```ts
minMacroLevel: options.minMacroLevel ?? 3
// or
const DEFAULT_MIN_LEVEL = 3;
```

Change `3` → `2` in any such defaults.

Add comment at top: `// [claude-code 2026-03-10] Default minMacroLevel lowered to 2 (medium through critical)`

---

## Changelog Entry

Add to `frontend/lib/changelog.ts` (find the array and prepend):
```ts
{
  date: '2026-03-10T18:30:00',
  agent: 'claude-code',
  summary: 'T1: Lower RiskFlow default minMacroLevel from 3 to 2; warm cache expanded to 30 medium+ items',
  files: [
    'backend-hono/src/routes/riskflow/handlers.ts',
    'backend-hono/src/services/twitter-cli/econ-triggered-poller.ts',
    'backend-hono/src/services/riskflow/feed-service.ts',
  ],
},
```

---

## Verification

```bash
cd /Users/tifos/Desktop/Codebases/pulse/backend-hono
npx tsc --noEmit
```

Zero TypeScript errors expected. All changes are value-only (no type shape changes).

Also verify by grep:
```bash
grep -n "minMacroLevel: 3" backend-hono/src/routes/riskflow/handlers.ts
# Should return nothing (all changed to 2)

grep -n "filterByTier.*high" backend-hono/src/services/twitter-cli/econ-triggered-poller.ts
# Should return nothing in the warm-cache init function
```
