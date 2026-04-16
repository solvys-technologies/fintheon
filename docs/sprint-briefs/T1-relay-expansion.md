# Sprint Brief: T1 -- Relay Expansion

## Context

The mobile chat relay (`/api/relay/chat`) currently only forwards `{ message, conversationId }` to the local backend. The Harper agent supports images, riskFlowContext, thinkHarder, persona, and tool approval — but the relay drops all of it. This track widens the relay pipe and adds a tool-decision return channel so mobile can participate in the full agent loop.

## Branch Target

`t1-relay-expansion` (branched from `mobile-agent-upgrade`)

## Scope -- Included

- [ ] `backend-hono/src/routes/relay.ts` — expand POST body type, add `POST /api/relay/tool-decision`
- [ ] `backend-hono/src/services/relay-bridge.ts` — generalize `forward()` payload type, add `sendToLocal()` method
- [ ] `backend-hono/src/services/relay-connector.ts` — forward full payload to `streamHarperChat()`, handle `tool-decision` frame, subscribe to cognition events and inject `tool-approval-needed`/`tool-approval-resolved` into SSE stream
- [ ] `backend-hono/src/services/tool-approval-store.ts` — add `noTimeout` flag to `requestApproval()` for relay-originated requests (block indefinitely)

## Scope -- Excluded (DO NOT TOUCH)

- `mobile/` — all frontend files belong to T2
- `backend-hono/src/routes/harper/index.ts` — desktop chat route, not modified
- `backend-hono/src/services/strands/` — agent internals unchanged
- `backend-hono/src/services/cognition-emitter.ts` — only imported, not modified

## Known Issues to Preserve

- The relay-connector uses `ws` (npm WebSocket), not native WebSocket — keep this pattern
- `relay-bridge.ts` is a singleton class (not functional) — maintain existing pattern
- Tool approval auto-approve timeout (30s) must remain for non-relay (desktop) requests
- Recent changelog entry (2026-04-16T01:30) modified mobile chat files — those belong to T2

## Implementation Steps

### 1. Expand relay payload types

In `relay.ts`, change the body type on the POST `/chat` route:

```typescript
const body = await c.req.json<{
  message: string;
  conversationId?: string | null;
  images?: string[];
  riskFlowContext?: string;
  thinkHarder?: boolean;
  persona?: string;
}>();
```

Pass the full body object (not just `{ message, conversationId }`) to `relayBridge.forward()`.

### 2. Generalize relay-bridge forward() signature

Change `forward()` from:

```typescript
async *forward(userId: string, message: { message: string; conversationId?: string | null })
```

to:

```typescript
async *forward(userId: string, payload: Record<string, unknown>)
```

The WebSocket send already JSON-stringifies the payload object — no other changes needed.

### 3. Add sendToLocal() to relay-bridge

Add a method to send arbitrary frames back to the local backend's WebSocket:

```typescript
sendToLocal(userId: string, frame: { type: string; payload: unknown }): boolean {
  const conn = this.connections.get(userId);
  if (!conn) return false;
  conn.ws.send(JSON.stringify(frame));
  return true;
}
```

### 4. Add POST /api/relay/tool-decision endpoint

In `relay.ts`, add:

```typescript
app.post("/tool-decision", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    approvalId: string;
    decision: "approved" | "denied";
  }>();
  if (!body.approvalId || !["approved", "denied"].includes(body.decision)) {
    return c.json({ error: "invalid_request" }, 400);
  }
  const sent = relayBridge.sendToLocal(userId, {
    type: "tool-decision",
    payload: body,
  });
  if (!sent) return c.json({ error: "local_offline" }, 503);
  return c.json({ ok: true });
});
```

### 5. Handle tool-decision frame in relay-connector

In the `ws.on("message")` handler in `relay-connector.ts`, add:

```typescript
if (frame.type === "tool-decision" && frame.payload) {
  const { approvalId, decision } = frame.payload;
  resolveApproval(approvalId, decision);
  return;
}
```

Import `resolveApproval` from `tool-approval-store.ts`.

### 6. Forward full payload to streamHarperChat

In `handleChatRequest`, expand the destructuring and pass all fields:

```typescript
async function handleChatRequest(
  requestId: string,
  payload: {
    message: string;
    conversationId?: string | null;
    images?: string[];
    riskFlowContext?: string;
    thinkHarder?: boolean;
    persona?: string;
  },
): Promise<void> {
  // ... existing checks ...
  const response = await streamHarperChat({
    message: payload.message,
    conversationId: payload.conversationId ?? `relay-${requestId}`,
    requestId,
    images: payload.images,
    riskFlowContext: payload.riskFlowContext,
    thinkHarder: payload.thinkHarder,
    persona: payload.persona,
    relayOriginated: true, // signals no-timeout for tool approval
  });
}
```

### 7. Inject cognition events into SSE stream

In `handleChatRequest`, subscribe to cognition steps for the requestId and forward tool-approval events:

```typescript
import { onStep } from "./cognition-emitter.js";

// Before starting the stream:
const unsubCognition = onStep(requestId, (step) => {
  if (
    step.kind === "tool-approval-needed" ||
    step.kind === "tool-approval-resolved"
  ) {
    send(
      "chunk",
      `data: ${JSON.stringify({ type: step.kind, ...JSON.parse(step.detail || "{}") })}\n\n`,
    );
  }
});

// In the finally block:
unsubCognition();
```

### 8. Add noTimeout flag to tool-approval-store

In `requestApproval()`, add an optional `noTimeout` parameter:

```typescript
export function requestApproval(
  requestId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  description: string,
  opts?: { noTimeout?: boolean },
): Promise<ApprovalDecision> {
```

Skip the `setTimeout` auto-approve block when `opts?.noTimeout` is true.

In `harper-tools.ts`, pass `{ noTimeout: true }` when the request is relay-originated (check the `requestId` prefix or add a flag to `HarperChatOptions`).

## Acceptance Criteria

- [ ] `POST /api/relay/chat` with `{ message, images: ["data:image/png;base64,..."], riskFlowContext: "test" }` forwards all fields to local Harper
- [ ] `POST /api/relay/tool-decision` with `{ approvalId, decision: "approved" }` resolves the pending approval on the local backend
- [ ] Tool-approval-needed events appear in the mobile SSE stream when Harper requests tool approval
- [ ] Relay-originated tool approvals do NOT auto-approve after 30s (block indefinitely)
- [ ] Existing desktop chat flow is unaffected

## Validation Commands

```bash
cd backend-hono && npx tsc --noEmit
cd backend-hono && bun run build
```

## Commit Format

```
feat: T1 relay expansion — full payload forwarding + tool-decision channel
```
