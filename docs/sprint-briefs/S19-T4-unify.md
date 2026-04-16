# Sprint Brief: S19-T4 -- Unification Pass

## Context

After T1 (relay), T2 (agent UI), and T3 (persistence) complete on their own branches, this pass merges them into `mobile-agent-upgrade`, resolves any interface mismatches, wires the SessionList's conversation loading into ChatPage's message state, adds the changelog entry, and runs the full validation suite.

## Branch Target

`mobile-agent-upgrade` (merge target)

## Scope -- Included

- [ ] Merge `t1-relay-expansion` into `mobile-agent-upgrade`
- [ ] Merge `t2-mobile-agent-ui` into `mobile-agent-upgrade`
- [ ] Merge `t3-conversation-persistence` into `mobile-agent-upgrade`
- [ ] Resolve any merge conflicts (none expected — tracks have non-overlapping file ownership)
- [ ] Wire ChatPage to SessionList's new `onSelect(conversationDetail)` callback — populate messages and conversationId from loaded conversation
- [ ] Verify T2's ChatPage SSE parser works with T1's injected approval events end-to-end
- [ ] Verify T2's fetch body includes extended fields that T1's relay now accepts
- [ ] Add changelog entry to `src/lib/changelog.ts`
- [ ] Run full type-check and build for both backend and mobile

## Scope -- Excluded (DO NOT TOUCH)

- `frontend/` — desktop unchanged
- `electron/` — desktop app unchanged

## Integration Points to Verify

### T1 + T2: Relay <-> Mobile Chat

- ChatPage sends `{ message, images, riskFlowContext }` -> relay.ts accepts and forwards -> relay-connector passes to streamHarperChat
- Relay-connector injects `tool-approval-needed` SSE events -> ChatPage parser handles them -> ToolApprovalCard renders
- Mobile POSTs to `/api/relay/tool-decision` -> relay-bridge.sendToLocal -> relay-connector handles `tool-decision` frame -> resolveApproval

### T2 + T3: ChatPage <-> SessionList

- SessionList's `onSelect` returns a `ConversationDetail` with messages array
- ChatPage must map these into its `ChatMessageData[]` state and set `conversationId`
- On new session: ChatPage clears messages, sets conversationId to null

### T1 + T3: Relay <-> Persistence

- No direct integration needed — conversations are stored via the Fly.io API, not the relay
- Verify the conversation ID returned in `X-Conversation-Id` header matches what the persistence API returns

## Implementation Steps

1. Merge T1 branch: `git merge t1-relay-expansion --no-ff`
2. Merge T2 branch: `git merge t2-mobile-agent-ui --no-ff`
3. Merge T3 branch: `git merge t3-conversation-persistence --no-ff`
4. In ChatPage.tsx, wire the SessionList onSelect callback:
   ```typescript
   const handleSelectSession = useCallback((conv: ConversationDetail) => {
     setMessages(
       conv.messages.map((m, i) => ({
         id: `loaded-${i}`,
         role: m.role,
         content: m.content,
         timestamp: m.createdAt,
       })),
     );
     setConversationId(conv.id);
     setSessionListOpen(false);
   }, []);
   ```
5. Update SessionList usage in ChatPage to pass the new props interface
6. Add changelog entry
7. Run validation

## Acceptance Criteria

- [ ] All three branches merge cleanly into mobile-agent-upgrade
- [ ] Backend type-check passes: `cd backend-hono && npx tsc --noEmit`
- [ ] Backend builds: `cd backend-hono && bun run build`
- [ ] Mobile type-check passes: `npx tsc --noEmit --project mobile/tsconfig.json`
- [ ] Mobile builds: `cd mobile && npx vite build`
- [ ] End-to-end: image attachment -> send -> Harper receives image via relay
- [ ] End-to-end: tool approval card -> approve -> Harper continues
- [ ] End-to-end: session list -> select old session -> messages load from API
- [ ] Changelog entry added

## Validation Commands

```bash
cd backend-hono && npx tsc --noEmit && bun run build
npx tsc --noEmit --project mobile/tsconfig.json
cd mobile && npx vite build
```

## Commit Format

```
feat: T4 unification — mobile agent interface complete
```
