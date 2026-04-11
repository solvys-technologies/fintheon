# S14-T5: Feed Refresh Consistency (Red Flag Kill)

## Goal

Feeds across Dashboard, Strategium, RiskFlow Main, and Boardroom refresh consistently without going stale. Add multi-select headline attachment to all chat surfaces.

## Current State

Feed sometimes goes stale — items don't appear for minutes after app load. Cache refresh interval is too long (120s). Boot sequence doesn't block until cache is warm. Users have no way to attach feed headlines to chat messages.

## What to Do

1. **Fix boot sequence**:
   - @backend-hono/src/boot/services.ts:129 — ensure `seedCacheFromDb()` blocks boot until cache is warm (currently fire-and-forget)

2. **Reduce cache staleness**:
   - @backend-hono/src/services/riskflow/feed-service.ts — reduce cache refresh window to match central scorer frequency (30s)

3. **Verify all feed surfaces refresh**:
   - @frontend/contexts/RiskFlowContext.tsx:334-342 — ensure poll interval fires reliably
   - @frontend/components/feed/RiskFlowMain.tsx — verify infinite scroll + refresh cycle
   - @frontend/components/executive/MainDashboard.tsx — verify feed widget refreshes on the Dashboard

4. **Headline attachment (multi-select popover)**:
   - Build a searchable popover list component that pulls from scored_riskflow_items
   - Checkboxes for multi-select, appears inline near the chat input bar
   - Wire into: **boardroom chat, sidebar chat, and main Consilium chat**
   - Attach button in the chat input bar toolbar (alongside existing + button)
   - Selected headlines get injected as context into the message

## Key Context

- @frontend/contexts/RiskFlowContext.tsx — polls backend every BACKEND_FEED_POLL_MS
- @frontend/lib/services/riskflow.ts — RiskFlowService.list() fetches from /api/riskflow/feed
- @backend-hono/src/services/riskflow/feed-service.ts — CACHE_REFRESH_INTERVAL_MS = 120_000 (too slow)
- Feed items come from scored_riskflow_items table via central scorer

## Verify

- Open Dashboard, Strategium, RiskFlow Main — items appear within 5s of app load
- Wait 2 minutes — new items appear without manual refresh
- Click attach button in chat input — popover shows recent headlines
- Select multiple headlines — they attach to message as context
