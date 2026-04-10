# Track Unification Review — 2026-04-02

## Scope Reviewed

- Track A: analyzer timeout + scorer/poller timeout/circuit-breaker + central-scoring startup assertion.
- Track B: UI polling-toggle removal + headline badge fallback + warm/stale feed cache behavior.

## Current Source-of-Truth Checks

- Boot entrypoint is `backend-hono/src/index.ts`, which calls `bootServices()` from `backend-hono/src/boot/services.ts`.
- `startCentralScorer()` is invoked from `backend-hono/src/boot/services.ts`.
- Route `POST /api/riskflow/polling-toggle` remains registered in `backend-hono/src/routes/riskflow/index.ts`.

## Validation Snapshot (this workspace)

- `frontend`: `bun run typecheck` ✅
- `frontend`: `bun run build` ✅
- `backend-hono`: `npm run typecheck` ✅
- `backend-hono`: `bun run build` ✅

## Merge-Risk Findings (ordered by severity)

1. High — cache overwrite regression risk  
   Files: `backend-hono/src/services/riskflow/feed-service.ts:160`, `backend-hono/src/services/riskflow/feed-poller.ts:186`  
   `updateFeedCache(enrichedItems)` overwrites in-memory cache with only the current poll’s new items. Since poller passes just the delta (`newItems`), feed history can collapse to a tiny subset until re-warm.

2. Medium — unification scope drift in `feed-service.ts`  
   File: `backend-hono/src/services/riskflow/feed-service.ts`  
   Cache changes are mixed with additional scoring/macro-level logic changes. High collision probability with other in-flight edits if merged wholesale.

3. Medium — file-size policy currently unmet  
   Files: `backend-hono/src/services/riskflow/central-scorer.ts` (523 lines), `backend-hono/src/services/riskflow/feed-poller.ts` (322 lines)  
   This exceeds the stated “<300 lines” plan target.

## Unification Carry List (safe intent)

- `backend-hono/src/services/analysis/grok-analyzer.ts`
  - Add `abortSignal: AbortSignal.timeout(TIMEOUT_MS)` to the AI headline call.
- `backend-hono/src/services/riskflow/central-scorer.ts`
  - Add timeout wrapper around `enrichFeedWithAnalysis`.
  - Add consecutive-failure tracking + warn/critical logging + effective 60s backoff.
- `backend-hono/src/services/riskflow/feed-poller.ts`
  - Add timeout wrapper around enrichment.
  - Add consecutive-failure tracking + warn/critical logging + effective 60s backoff.
- `backend-hono/src/boot/services.ts`
  - Keep the pre-`startCentralScorer()` assertion for `ENABLE_CENTRAL_SCORING`.
- `frontend/components/feed/RiskFlowMain.tsx`
  - Remove `AutoRefreshToggle` from render path.
- `frontend/contexts/RiskFlowContext.tsx`
  - Remove frontend polling gates keyed on `autoRefresh`.
- `frontend/components/feed/FeedSection.tsx`
  - Remove interval gating keyed on `autoRefresh`.
- `frontend/components/layout/FloatingWidget.tsx` + `frontend/types/api.ts`
  - Render arrow + `pointRange ?? ivScore` fallback and add API typings.

## Unification Hold/Isolate List

- Do not wholesale-merge all of `backend-hono/src/services/riskflow/feed-service.ts`.
- Isolate only cache lifecycle hunks:
  - cache declaration/init
  - `warmCacheFromDB()`
  - `seedCacheFromDb()`
  - `updateFeedCache()` (but fix merge semantics to preserve existing items)
  - `getCachedFeed()` stale-on-failure path
  - module-level warm call (`void warmCacheFromDB()`)

## Recommended Merge Order

1. Apply Track A backend reliability changes (analyzer/scorer/poller/boot assertion).
2. Apply Track B frontend changes (toggle removal + badge fallback + typing).
3. Apply isolated cache lifecycle hunks from `feed-service.ts` with collision-safe manual merge.
4. Run validation commands above.
5. Runtime smoke: verify poll timeout path, 5-failure backoff behavior, and stale cache return during simulated fetch failure.
