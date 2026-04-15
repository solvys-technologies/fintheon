# Task Brief: T6 — Mobile Consilium (Chat) + Fly.io Relay

**Date:** 2026-04-14
**Scope:** Full-screen Harper chat with Fly.io relay bridge to user's local backend, connection status, and session management.
**Estimated files:** 10 (6 mobile + 4 backend)

## Project Memory (READ FIRST)

Before doing anything, read the project memory for critical context, patterns, and feedback from prior work:

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Key memories to load:** feedback_uimessagestream_framing, feedback_uimessagestream_framing_v2, feedback_node_sse_timeout, feedback_fullstream_not_textstream, feedback_bun_idle_timeout, feedback_useChat_stale_closure, feedback_cao_not_analyst, feedback_keep_chat_mounted
- **Master plan:** `/Users/tifos/.claude/plans/tidy-foraging-garden.md`

## Context

Harper (CAO — Chief Agentic Officer, NOT "Analyst") is the default chat agent on mobile. The critical architecture: mobile can't reach the user's local backend directly, so Fly.io acts as a relay. The user's local backend maintains a persistent WebSocket to Fly.io. When mobile sends a chat message, Fly.io forwards it through the WebSocket to the local backend, which routes to Harper/Claude and streams the response back. If local backend is offline, mobile shows `[HARPER OFFLINE]` inline status.

## Files to Read First

- `frontend/components/consilium/AgentChattr.tsx` — Desktop chat implementation (streaming, message rendering)
- `frontend/components/consilium/ConsiliumMessage.tsx` — Message rendering with markdown, agent badges
- `frontend/lib/services/ai.ts` — AIService (chat endpoint, streaming)
- `frontend/contexts/ThreadContext.tsx` — Thread/session management (if applicable)
- `backend-hono/src/routes/ai.ts` — Chat endpoint implementation
- `backend-hono/src/routes/harper.ts` — Harper-specific route (local-only bridge)
- `backend-hono/src/index.ts` — Server entry, understand route registration
- `backend-hono/src/services/ai-service.ts` — AI service with streaming

## What to Build

### MOBILE COMPONENTS

### 1. `mobile/components/chat/ChatPage.tsx`

- **Path:** `mobile/components/chat/ChatPage.tsx`
- **Action:** Create
- **Spec:** Full-screen chat layout. Top bar: `HARPER` in Space Mono ALL CAPS left, connection status badge right (ConnectionStatus component), session list icon (List) far right. Middle: message list (flex-1, scroll). Bottom: ChatInput fixed to bottom. Messages render newest at bottom, auto-scroll on new message. Uses Framer Motion for message enter animation (opacity fade 200ms ease-out). Background: `var(--black)`. IMPORTANT: Keep chat mounted across tabs using `display:none` not conditional render — streams survive navigation (memory: feedback_keep_chat_mounted).
- **Max lines:** 100

### 2. `mobile/components/chat/ChatMessage.tsx`

- **Path:** `mobile/components/chat/ChatMessage.tsx`
- **Action:** Create
- **Spec:** Message bubble. User messages: right-aligned, `var(--surface-raised)` bg, 12px radius, padding 12px 16px, Space Grotesk 14px `--text-primary`. Agent messages: left-aligned, `var(--surface)` bg, `1px solid var(--border)`, 12px radius. Agent has "H" monogram badge (AgentBadge) top-left of message. Content rendered via `react-markdown` with `remark-gfm`. Code blocks: Space Mono, `var(--surface-raised)` bg, 8px radius. Streaming: text appears character-by-character (already handled by the streaming transport). Timestamp: Space Mono 10px `--text-disabled` below message.
- **Max lines:** 80

### 3. `mobile/components/chat/ChatInput.tsx`

- **Path:** `mobile/components/chat/ChatInput.tsx`
- **Action:** Create
- **Spec:** Bottom-anchored input bar. `var(--surface)` bg, `1px solid var(--border-visible)` top border. Auto-growing textarea (Space Grotesk 14px, max 4 lines/96px, then scroll). Send button: 44px circle, `var(--accent)` bg, arrow-up icon in `var(--black)`. Send on button tap or Enter (without Shift). Disabled when `isLoading` (no double-send). Placeholder: `"Message Harper..."` in `--text-disabled`. Keyboard-aware: respects `env(safe-area-inset-bottom)`.
- **Max lines:** 70

### 4. `mobile/components/chat/AgentBadge.tsx`

- **Path:** `mobile/components/chat/AgentBadge.tsx`
- **Action:** Create
- **Spec:** Agent identity chip. 28px circle, `var(--surface-raised)` bg, `1px solid var(--border-visible)`. Center: "H" in Space Mono 12px `--text-display`. Title under badge (optional via prop): "HARPER" in Space Mono ALL CAPS 9px `--text-secondary`. Always Solvys Gold accent — never per-agent color variations.
- **Max lines:** 25

### 5. `mobile/components/chat/ConnectionStatus.tsx`

- **Path:** `mobile/components/chat/ConnectionStatus.tsx`
- **Action:** Create
- **Spec:** Inline connection status indicator in chat header. Three states: `[CONNECTED]` with 6px green dot (`--success`), `[RECONNECTING...]` with 6px amber dot (`--warning`), `[OFFLINE]` with 6px red dot (`--error`). Text in Space Mono ALL CAPS 10px. Polls relay health endpoint every 30s. When offline: disables ChatInput and shows `[HARPER OFFLINE — START LOCAL INSTANCE]` in the message area as an inline status message.
- **Max lines:** 50

### 6. `mobile/components/chat/SessionList.tsx`

- **Path:** `mobile/components/chat/SessionList.tsx`
- **Action:** Create
- **Spec:** BottomSheet showing chat session history. Each row: session title (or `Session #N`) in Space Grotesk 14px, timestamp in Space Mono 11px `--text-secondary`. Active session highlighted with 2px `var(--accent)` left border. `[NEW SESSION]` button at top as a ghost button. Rows have `1px solid var(--border)` dividers, 44px height.
- **Max lines:** 60

### BACKEND COMPONENTS (Fly.io + Local)

### 7. `backend-hono/src/routes/relay.ts`

- **Path:** `backend-hono/src/routes/relay.ts`
- **Action:** Create
- **Spec:** Relay bridge on Fly.io. Two endpoints:
  - `GET /api/relay/connect` — WebSocket upgrade. Local backend connects here and maintains persistent connection with heartbeat (ping every 30s). Stores the WebSocket connection keyed by user_id (from JWT). Only one connection per user.
  - `POST /api/relay/chat` — Receives chat message from mobile (auth required). Looks up the user's WebSocket connection. If connected: forwards the message through WebSocket, streams the response back to mobile as SSE. If not connected: returns 503 with `{ error: 'local_offline', message: 'Local backend not connected' }`.
  - `GET /api/relay/health` — Returns `{ connected: boolean }` for the authenticated user's relay status.
    Register routes in the main router.
- **Max lines:** 150

### 8. `backend-hono/src/services/relay-bridge.ts`

- **Path:** `backend-hono/src/services/relay-bridge.ts`
- **Action:** Create
- **Spec:** Manages the relay connection pool. `connections: Map<string, WebSocket>` keyed by user_id. Methods: `register(userId, ws)`, `unregister(userId)`, `isConnected(userId)`, `forward(userId, message): AsyncGenerator<string>` (sends message to local backend via WS, yields streamed response chunks). Handle WebSocket close/error events to auto-unregister. Heartbeat: if no ping response in 60s, close and unregister.
- **Max lines:** 100

### 9. `backend-hono/src/services/relay-connector.ts`

- **Path:** `backend-hono/src/services/relay-connector.ts`
- **Action:** Create
- **Spec:** Outbound connector for the LOCAL backend (runs on user's machine). On backend startup: opens WebSocket to `wss://pulse-api-withered-dust-1394.fly.dev/api/relay/connect` with JWT auth header. Listens for forwarded chat messages. When a message arrives: routes to the local Harper/AI chat handler, streams the response back through the WebSocket. Auto-reconnect on disconnect (exponential backoff: 1s, 2s, 4s, max 30s). Heartbeat: responds to pings. Log connection status.
  This should be conditionally enabled — only runs when `RELAY_ENABLED=true` env var is set (local backends opt-in).
- **Max lines:** 120

### 10. `backend-hono/src/routes/index.ts` (UPDATE)

- **Path:** `backend-hono/src/routes/index.ts`
- **Action:** Modify
- **Spec:** Register the new relay routes: `app.route('/api/relay', relayRouter)`. Import from `./relay`.
- **Max lines:** N/A (minor edit)

## Key Rules

- CAO = Chief Agentic Officer, NOT "Analyst" (memory: feedback_cao_not_analyst)
- Keep chat mounted across tabs with `display:none`, not conditional render (memory: feedback_keep_chat_mounted)
- Bun.serve() idleTimeout must be 0 for streaming endpoints (memory: feedback_bun_idle_timeout)
- Disable all Node HTTP timeouts for SSE streams (memory: feedback_node_sse_timeout)
- Use fullStream not textStream for VProxy (memory: feedback_fullstream_not_textstream)
- UIMessageStream needs start/finish events (memory: feedback_uimessagestream_framing)
- DefaultChatTransport captures conversationId at creation — use refs (memory: feedback_useChat_stale_closure)
- Agent colors always #D4AF37 — never per-agent variations
- Relay connector is OPT-IN via RELAY_ENABLED env var

## DO NOT

- Call Harper "Analyst" — it's CAO (Chief Agentic Officer)
- Conditionally render chat page (use display:none for tab hiding)
- Use textStream (use fullStream)
- Hardcode agent colors per-agent
- Make relay connector run by default — it's opt-in
- Add spring/bounce animations to message bubbles

## Verification

```bash
cd mobile && bun run build
cd backend-hono && bun run build
# Test relay: start local backend with RELAY_ENABLED=true
# Check: local backend connects to Fly.io relay
# Open mobile dev: Chat tab shows [CONNECTED]
# Send message: streams through relay to local Harper
# Stop local backend: mobile shows [OFFLINE] within 60s
# Hamburger menu: [REFRESH HARPER] button pings relay health
```

## Changelog Entry

```typescript
{
  date: '2026-04-14T00:00:00',
  agent: 'claude-code',
  summary: 'T6: Mobile Consilium chat with Harper via Fly.io WebSocket relay, connection status indicator, session list, relay bridge + connector backend services',
  files: ['mobile/components/chat/ChatPage.tsx', 'mobile/components/chat/ChatMessage.tsx', 'mobile/components/chat/ChatInput.tsx', 'mobile/components/chat/AgentBadge.tsx', 'mobile/components/chat/ConnectionStatus.tsx', 'mobile/components/chat/SessionList.tsx', 'backend-hono/src/routes/relay.ts', 'backend-hono/src/services/relay-bridge.ts', 'backend-hono/src/services/relay-connector.ts']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
