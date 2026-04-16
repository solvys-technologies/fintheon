# Sprint Brief: T6 — Conversation Persistence

## Context

Harper chat conversations don't persist across sessions or between mobile/desktop. The infrastructure is 90% built (schema, store, API handlers, UI scaffolding) but the wiring is broken: the relay path doesn't save messages, mobile ChatPage has dead code from a half-completed refactor, SessionList types don't match the hook output, and desktop uses bare fetch without auth headers.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] `backend-hono/src/routes/relay.ts` — store user message + create conversation before `relayBridge.forward()`
- [ ] `backend-hono/src/services/relay-connector.ts` — pass userId through relay payload
- [ ] `backend-hono/src/services/strands/agents/harper.ts` — idempotency guard on assistant message persistence (onFinish vs DbConversationManager dual-write)
- [ ] `mobile/components/chat/ChatPage.tsx` — fix dead code (remove stale `setSessions`, `setActiveSessionId`, `ChatSession`), wire `loadSession()`, refresh sessions after stream
- [ ] `mobile/components/chat/SessionList.tsx` — align types to `ConversationSummary`, add search, swipe-to-archive
- [ ] `mobile/hooks/useConversations.ts` — add `archiveSession(id)` method
- [ ] `frontend/components/chat/SessionsPanel.tsx` — switch from bare fetch to BackendClient service layer with auth headers
- [ ] New `supabase/migrations/20260416_conversation_rls.sql` — RLS policies for ai_conversations + ai_messages

## Scope — Excluded (DO NOT TOUCH)

- `agent-instructions/` (T1 owns)
- `miroshark-template.ts`, `miroshark-client.ts` (T2 owns)
- `oracle-research/` (T3 owns)
- `agent-memory/` (T4 owns)
- `mobile/public/sw.js` (T7 owns)
- `mobile/App.tsx` (T7 owns)
- `mobile/contexts/SettingsContext.tsx` (T7 owns)
- `boot/services.ts` (T3/T4 own)

## Known Issues to Preserve

- `ChatPage.tsx` was updated 2026-04-16 — T4 unification + T3/T6 full-screen Harper chat. Memory notes: `feedback_keep_chat_mounted` (use display:none not conditional render), `feedback_uimessagestream_framing` (start/finish events in SSE stream). Preserve these patterns.
- `conversation-store.ts` already has auto-summarization at 80k tokens, 50 message cap, 5-min cache. No changes needed there.
- `DbConversationManager` in `strands/memory-store.ts` handles `AfterInvocationEvent` to save assistant messages. The `onFinish` callback in `harper.ts` is a belt-and-suspenders backup. Add dedup guard (check if message already saved by conversation_id + approximate timestamp).
- `user_id` in `ai_conversations` is VARCHAR(255), Supabase `auth.uid()` returns UUID. RLS policy must cast: `user_id = auth.uid()::text`.
- `conversation-store.ts` is over 300 lines. If adding significant logic, split summarization into `conversation-summarizer.ts`.

## Implementation Steps

1. **Relay persistence** (backend):
   - In `routes/relay.ts` POST /chat handler, before `relayBridge.forward()`:
     - Extract userId from authenticated request context
     - If no conversationId provided, create one via `conversationStore.createConversation()`
     - Store user message via `conversationStore.addMessage()`
     - Pass conversationId into relay payload
     - Set `X-Conversation-Id` response header
   - In `relay-connector.ts`, extract userId from WebSocket auth and include in chat frame
2. **Idempotency guard** (harper.ts):
   - In `onFinish` callback, before saving assistant message, check if `DbConversationManager` already persisted (query by conversation_id + created_at within 5s window)
3. **Mobile ChatPage fix**:
   - Remove dead references: `setSessions`, `setActiveSessionId`, `ChatSession` type
   - Use `conversationId` as activeSessionId for SessionList
   - On session select: call `loadSession(id)`, populate `messages` from returned data, set `conversationId`
   - On new session: clear messages, set conversationId to null
   - In sendMessage `finally` block: call `refreshSessions()`
4. **SessionList type alignment**:
   - Change props to accept `ConversationSummary[]` from `useConversations`
   - Display `messageCount` badge, use `lastMessageAt` for timestamp
5. **useConversations update**: add `archiveSession(id)` calling DELETE or POST to archive endpoint
6. **Desktop auth fix**: Replace bare `fetch()` in SessionsPanel with BackendClient calls
7. **RLS migration**: Enable RLS on both tables, add user-scoped SELECT + service_role ALL policies

## Acceptance Criteria

- [ ] Send message on mobile → message persisted in `ai_messages` table
- [ ] Switch to desktop → same conversation loads with full history
- [ ] Send on desktop → mobile sees it via relay
- [ ] Session list shows real conversations with message counts
- [ ] Loading a session restores all messages
- [ ] New session starts clean
- [ ] No duplicate assistant messages (idempotency guard works)
- [ ] RLS prevents cross-user conversation access
- [ ] Desktop SessionsPanel works with auth headers

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
# Manual: send message on mobile, check ai_messages table, load session on desktop
```
