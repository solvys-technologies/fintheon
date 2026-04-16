# Execution Sequence — Mobile Agent Interface Sprint

## Base Branch

`mobile-agent-upgrade` (created from `main`)

## Wave 1 (parallel — 3 tracks)

All three tracks branch from `mobile-agent-upgrade` and run simultaneously. No file ownership overlaps.

### Track 1: Backend Relay Expansion

**Brief:** @docs/sprint-briefs/T1-relay-expansion.md
**Branch:** `t1-relay-expansion`
**Files owned:** `backend-hono/src/routes/relay.ts`, `backend-hono/src/services/relay-bridge.ts`, `backend-hono/src/services/relay-connector.ts`, `backend-hono/src/services/tool-approval-store.ts`
**Complexity:** Medium
**Estimated:** 4 files modified, ~80 lines added

### Track 2: Mobile Agent UI

**Brief:** @docs/sprint-briefs/T2-mobile-agent-ui.md
**Branch:** `t2-mobile-agent-ui`
**Files owned:** `mobile/components/chat/ImageAttachButton.tsx` (new), `mobile/components/chat/ImagePreviewRow.tsx` (new), `mobile/components/chat/HeadlinePickerSheet.tsx` (new), `mobile/components/chat/HeadlineChips.tsx` (new), `mobile/components/chat/ToolApprovalCard.tsx` (new), `mobile/components/chat/ChatInput.tsx`, `mobile/components/chat/ChatPage.tsx`
**Complexity:** High
**Estimated:** 5 new files + 2 modified, ~540 lines added

### Track 3: Conversation Persistence

**Brief:** @docs/sprint-briefs/T3-conversation-persistence.md
**Branch:** `t3-conversation-persistence`
**Files owned:** `mobile/hooks/useConversations.ts` (new), `mobile/components/chat/SessionList.tsx`
**Complexity:** Low-Medium
**Estimated:** 1 new file + 1 modified, ~180 lines added

## Wave 2 (after Wave 1 completes)

### Track 4: Unification

**Brief:** @docs/sprint-briefs/T4-unify.md
**Branch:** `mobile-agent-upgrade` (merge target)
**Approach:** Orchestrating instance handles unification — merges all three track branches, wires the SessionList-to-ChatPage integration, runs full validation, adds changelog entry.

**Why orchestrating instance, not a dedicated track:** The unification work is primarily merge + wiring (~20 lines of glue code in ChatPage). A separate agent track would spend more time re-reading context than writing code. The orchestrator already has full context from writing the briefs.

## Conflict Risk Assessment

- **T1 vs T2:** Zero risk — T1 touches only `backend-hono/`, T2 touches only `mobile/`
- **T1 vs T3:** Zero risk — same reasoning
- **T2 vs T3:** Low risk — T2 owns `ChatPage.tsx`, T3 owns `SessionList.tsx`. The `SessionList` props interface changes in T3 but T2 doesn't import or modify SessionList. The glue is handled in T4.

## Summary

| Wave      | Tracks     | Parallelism  | Est. New Lines |
| --------- | ---------- | ------------ | -------------- |
| 1         | T1, T2, T3 | 3 parallel   | ~800           |
| 2         | T4 (unify) | 1 sequential | ~30            |
| **Total** |            |              | **~830**       |
