# Task Brief: S17-T0 — Foundation: Zustand Chat Store + Relay requestId Exposure

**Date:** 2026-04-15
**Scope:** Extract all chat state into a shared Zustand store (consumed by both Main chat and AskHarp sidebar across desktop and mobile), and expose `requestId` from the relay bridge so all clients can subscribe to cognition events.
**Estimated files:** 4 (1 new + 3 modified)
**Phase:** 0 (Foundation — must complete before T1-T5)
**Applies to:** Desktop frontend + Mobile — both chat interfaces (Main & AskHarp sidebar)

## Project Memory (READ FIRST)

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Key memories to load:** feedback_keep_chat_mounted, feedback_useChat_stale_closure, feedback_uimessagestream_framing, feedback_bun_idle_timeout
- **Sprint plan:** `/Users/tifos/.claude/plans/cosmic-snuggling-peacock.md`

## Context

The mobile chat (`ChatPage.tsx`) currently keeps all state local (messages, isLoading, conversationId, abortController). Five new features (stop button, queue, approvals, tool panes, thinking stream) all need to read/write chat state. A Zustand store enables both Main chat and future AskHarp sidebar to consume the same state. Additionally, the relay bridge generates a `requestId` per request but never exposes it to mobile — this is needed to subscribe to the cognition event stream for approvals and tool dispatch events.

## Files to Read First

- `mobile/components/chat/ChatPage.tsx` — Current chat implementation with all local state
- `mobile/hooks/useVixTicker.ts` — Existing Zustand store pattern in the project
- `backend-hono/src/services/relay-bridge.ts` — Relay bridge with requestId generation (line 72)
- `backend-hono/src/routes/relay.ts` — Relay HTTP routes (SSE streaming)
- `frontend/components/chat/hooks/useToolApprovals.ts` — Desktop cognition stream subscription (reference)
- `backend-hono/src/services/cognition-emitter.ts` — Server-side cognition event system

## What to Build

### 1. `mobile/stores/useChatStore.ts` (NEW)

- **Action:** Create
- **Spec:** Zustand store holding all chat state. Shape:

```typescript
interface ChatStore {
  // Core chat state (extracted from ChatPage)
  messages: ChatMessageData[];
  isLoading: boolean;
  conversationId: string | null;
  requestId: string | null; // NEW: from relay response
  relayState: RelayState;

  // Abort control
  abortController: AbortController | null;

  // Thinking state (T11)
  // These fields must exist in the store now so T11 can use them without modifying the store
  thinkingState: "idle" | "thinking" | "done";
  thinkingContent: string;
  thinkingStartTime: number;
  thinkingDurationMs: number;

  // Tool calls (T12)
  activeToolCalls: ToolCallPane[];

  // Queue (T13)
  queuedMessages: QueuedMessage[];

  // Approvals (T14)
  pendingApprovals: ToolApprovalRequest[];
  sessionApprovedTools: Set<string>;

  // Actions
  sendMessage: (
    text: string,
    getAccessToken: () => Promise<string | null>,
  ) => Promise<void>;
  abort: () => void;
  clearMessages: () => void;
  setConversationId: (id: string | null) => void;
  setRelayState: (state: RelayState) => void;

  // Queue actions (T13 will implement logic, stubs here)
  enqueue: (text: string) => void;
  dequeue: (id: string) => void;
  reorderQueue: (from: number, to: number) => void;

  // Approval actions (T14 will implement logic, stubs here)
  addApproval: (approval: ToolApprovalRequest) => void;
  resolveApprovalLocal: (
    approvalId: string,
    decision: "approved" | "denied",
  ) => void;
  approveAllForSession: (toolName: string) => void;
}
```

- **SSE Parser:** Move the SSE parsing loop from ChatPage into `sendMessage()`. Expand it to handle ALL event types (not just `text-delta`):
  - `text-delta` → append to current assistant message content (existing behavior)
  - `relay-meta` → capture `requestId` into store state
  - `reasoning-start` → set `thinkingState='thinking'`, record `thinkingStartTime`
  - `reasoning-delta` → append to `thinkingContent`
  - `reasoning-end` → set `thinkingState='done'`, calculate `thinkingDurationMs`
  - `start-step`, `finish-step` → track step boundaries for tool duration (future use)
  - `error` → set error content on assistant message
  - `[DONE]` → finalize
- After stream completes, store thinking content on the message object (`ChatMessageData.thinkingContent`, `.thinkingDurationMs`), then reset thinking state to idle.

- **Auto-drain queue:** In the `finally` block of `sendMessage`, if `queuedMessages.length > 0`, shift the first item and auto-send it.

- **Max lines:** 200

### 2. `mobile/components/chat/ChatPage.tsx` (MODIFY)

- **Action:** Modify
- **Spec:** Replace ALL local state with `useChatStore()` selectors. ChatPage becomes a thin rendering shell:
  - Get `messages`, `isLoading`, `relayState`, `conversationId` from store
  - Get `sendMessage`, `abort`, `clearMessages`, `setRelayState` actions from store
  - Keep `visible` display:none pattern (memory: feedback_keep_chat_mounted)
  - Keep session management (sessions, activeSessionId, sessionListOpen) as local state — these are UI-only
  - Pass store actions to child components as props
  - `handleNewSession` calls `store.clearMessages()` + `store.setConversationId(null)`
  - Remove the entire `sendMessage` useCallback — it's now in the store
  - Remove `abortRef`, `conversationIdRef` — managed by store
- **Max lines:** 120 (down from 307)

### 3. `backend-hono/src/services/relay-bridge.ts` (MODIFY)

- **Action:** Modify
- **Spec:** In the `forward()` async generator, yield a `relay-meta` event as the FIRST chunk before entering the WS forwarding loop:

```typescript
// Line ~72, after generating requestId:
yield JSON.stringify({ type: "relay-meta", requestId });
```

This lets the mobile SSE parser capture the requestId from the first event without changing the function signature or return type. The mobile store's parser will check `event.type === "relay-meta"` and store the requestId.

Also add a `sendCommand()` method for non-streaming request forwarding (needed by T14 for tool decisions):

```typescript
async sendCommand(userId: string, command: { type: string; payload: unknown }): Promise<unknown> {
  const conn = this.connections.get(userId);
  if (!conn) throw new Error("local_offline");
  const requestId = `cmd-${Date.now()}`;
  // Send command, wait for single response with matching requestId
  // ... promise-based single-response pattern
}
```

- **Max lines:** 180 (up from 172)

### 4. `backend-hono/src/routes/relay.ts` (MODIFY)

- **Action:** Modify
- **Spec:** Two changes:

1. In `POST /chat` handler, after the ReadableStream starts receiving chunks, parse the first chunk for `relay-meta` type. Set `X-Request-Id` response header from it. This dual delivery (header + SSE event) ensures mobile gets requestId regardless of how it reads the stream.

2. Add `POST /tool-decision` endpoint for T14 (approval forwarding):

```typescript
app.post("/tool-decision", async (c) => {
  const userId = c.get("userId");
  if (!userId || userId === "anonymous")
    return c.json({ error: "auth_required" }, 401);
  const { approvalId, decision } = await c.req.json();
  const result = await relayBridge.sendCommand(userId, {
    type: "tool-decision",
    payload: { approvalId, decision },
  });
  return c.json(result ?? { ok: true });
});
```

- **Max lines:** 160 (up from 122)

## Extended ChatMessageData Type

Update the `ChatMessageData` interface in `ChatMessage.tsx` (or extract to a shared types file):

```typescript
export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  thinkingContent?: string; // NEW: reasoning text
  thinkingDurationMs?: number; // NEW: how long thinking took
  toolCalls?: ToolCallPane[]; // NEW: tool execution panes
}
```

## Key Rules

- Keep chat mounted across tabs with `display:none` (memory: feedback_keep_chat_mounted)
- Use refs for conversationId to avoid stale closures (memory: feedback_useChat_stale_closure)
- Follow useVixTicker.ts pattern for Zustand store structure
- Store thinking content on the message object when stream completes (not just in transient store state)
- Bun.serve() idleTimeout must be 0 for streaming (memory: feedback_bun_idle_timeout)

## DO NOT

- Delete or restructure session management — keep it local to ChatPage
- Change the relay-bridge `forward()` function signature or return type
- Add UI components — this is infrastructure only
- Break existing text-delta streaming behavior
- Use `require()` — project is ESM (memory: feedback_esm_no_require)

## Verification

```bash
cd mobile && bun run build  # Must pass with zero errors
cd backend-hono && bun run build  # Must pass with zero errors
# Manual test: open mobile, send message to Harper
# Verify: messages still stream correctly
# Verify: console.log(requestId) shows in mobile dev tools
# Verify: ChatPage is significantly shorter (~120 lines vs 307)
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'T9: Extract chat state to Zustand store, expose relay requestId, extend ChatMessageData for thinking/tools, add relay sendCommand for tool decisions',
  files: ['mobile/stores/useChatStore.ts', 'mobile/components/chat/ChatPage.tsx', 'backend-hono/src/services/relay-bridge.ts', 'backend-hono/src/routes/relay.ts']
}
```

## Post-Push Memory Update

After committing, log any bugs or patterns discovered to memory so future agents don't repeat them.
