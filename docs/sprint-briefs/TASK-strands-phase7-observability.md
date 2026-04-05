# Task Brief: Strands Phase 7 — Memory + Observability
**Date:** 2026-04-05
**Scope:** Replace custom cognition-emitter with OpenTelemetry spans from Strands, and wire Strands session memory to conversation store.
**Estimated files:** 4
**Repo root:** `~/Documents/Codebases/fintheon`
**Working directory:** `~/Documents/Codebases/fintheon/backend-hono`

## Prerequisites
- Phase 6 (MCP integration) should be complete first, but this phase can proceed independently if needed.
- The Strands SDK is already installed at `@strands-agents/sdk@1.0.0-rc.2` in `backend-hono/`.
- The Strands agent layer lives at `backend-hono/src/services/strands/` with: `provider.ts`, `agent-factory.ts`, `harper-tools.ts`, `stream-adapter.ts`, `pipeline.ts`, `agents/harper.ts`, `skills/`.
- VProxy (localhost:8317) provides Claude models via OpenAI-compatible API.
- Build command: `cd ~/Documents/Codebases/fintheon/backend-hono && bun run build`

## Context
Fintheon has a custom `cognition-emitter.ts` that emits SSE events (agent-route, context-build, skill-check, tool-dispatch, tool-approval-needed, gateway-call, response-ready, error) via a Node EventEmitter. The frontend subscribes at `GET /api/ai/cognition/stream?requestId=xxx`. Strands SDK has native OpenTelemetry integration that emits traces for model calls, tool executions, and agent lifecycle. We need to bridge Strands OTel spans → cognition SSE format so the frontend continues to work unchanged.

Additionally, Strands has session/conversation memory that should replace the manual history slicing in `conversation-store.ts`.

## Files to Read First
- `~/Documents/Codebases/fintheon/backend-hono/src/services/cognition-emitter.ts` — Current EventEmitter-based cognition system (96 lines). Understand `CognitionStepKind`, `emitStep()`, `onStep()`, `onEnd()`
- `~/Documents/Codebases/fintheon/backend-hono/src/routes/ai/handlers/queue.ts` lines 90-139 — SSE endpoint `handleCognitionStream` that consumes emitter events. **BUG**: stream doesn't terminate properly → `ERR_INCOMPLETE_CHUNKED_ENCODING`
- `~/Documents/Codebases/fintheon/backend-hono/src/services/ai/conversation-store.ts` — Current conversation history management
- `~/Documents/Codebases/fintheon/backend-hono/src/services/strands/stream-adapter.ts` — Current Strands→UIMessageStream adapter
- `~/Documents/Codebases/fintheon/backend-hono/node_modules/@strands-agents/sdk/dist/src/hooks/events.d.ts` — All Strands event types: `BeforeToolCallEvent`, `AfterToolCallEvent`, `BeforeModelCallEvent`, `AfterModelCallEvent`, etc.
- `~/Documents/Codebases/fintheon/CLAUDE.md` — Project rules (changelog protocol, version branching, Solvys Gold palette)

## What to Build/Change

### 1. Telemetry Bridge
- **Path:** `~/Documents/Codebases/fintheon/backend-hono/src/services/strands/telemetry.ts`
- **Action:** Create
- **Spec:**
  - Subscribe to Strands agent events (via plugins or hooks API) during agent execution
  - Map Strands events → CognitionStepKind:
    - `BeforeModelCallEvent` → `gateway-call`
    - `AfterModelCallEvent` → `response-ready`
    - `BeforeToolCallEvent` → `tool-dispatch`
    - `AfterToolCallEvent` → `tool-dispatch` (with result)
    - Agent creation → `agent-route`
  - Call existing `emitStep()` and `emitEnd()` from cognition-emitter (keep it as the SSE transport)
  - Export `withCognition(agent: Agent, requestId: string): Agent` wrapper that instruments an agent
- **Max lines:** 100

### 2. Fix Cognition SSE Stream Bug
- **Path:** `~/Documents/Codebases/fintheon/backend-hono/src/routes/ai/handlers/queue.ts`
- **Action:** Modify lines 90-139
- **Spec:**
  - The `handleCognitionStream` function has a race condition: when `done = true` fires, the SSE stream closes without a proper frame
  - Fix: send a final SSE `event: done` message before closing
  - Fix: call `offEnd()` in the cleanup path (line 123 calls it but `onEnd` handler at line 111 doesn't call `offStep()`)
  - Replace the 100ms poll interval with a proper Promise resolution
- **Max lines:** stays under 60

### 3. Session Memory Adapter
- **Path:** `~/Documents/Codebases/fintheon/backend-hono/src/services/strands/memory-store.ts`
- **Action:** Create
- **Spec:**
  - Implement a Strands `ConversationManager` interface that reads/writes to the existing `conversation-store.ts`
  - On agent creation, load last N messages from conversation store as Strands messages
  - On agent completion, save the new messages back to conversation store
  - Export `createConversationManager(conversationId: string, userId: string): ConversationManager`
- **Max lines:** 80

### 4. Wire telemetry into Harper
- **Path:** `~/Documents/Codebases/fintheon/backend-hono/src/services/strands/agents/harper.ts`
- **Action:** Modify
- **Spec:**
  - Import `withCognition` from telemetry.ts
  - In `createHarperAgent()`, wrap the agent with cognition instrumentation
  - In `streamHarperChat()`, pass `requestId` to the cognition wrapper

## Key Rules
- Keep `cognition-emitter.ts` unchanged — it's the SSE transport. The telemetry bridge just feeds it.
- The frontend subscribes to `/api/ai/cognition/stream` — that endpoint must keep working exactly as before.
- Strands agent hooks/plugins are the right way to intercept events — check `@strands-agents/sdk` Plugin interface.
- Peer deps that may be needed: `@opentelemetry/api` (check if Strands bundles it or needs it as peer)

## DO NOT
- Modify the cognition SSE endpoint format (frontend depends on it)
- Touch frontend code
- Remove or modify `cognition-emitter.ts` exports
- Install heavyweight OTel exporters (we just need the event hooks, not full trace export)
- Remove or modify the existing Vercel AI SDK code (that's Phase 8)

## Verification
```bash
cd ~/Documents/Codebases/fintheon/backend-hono
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v scripts/
bun run build
# Manual test: start backend, open browser, send a Harper chat message
# Verify cognition SSE stream shows events without ERR_INCOMPLETE_CHUNKED_ENCODING
```

## Changelog Entry
```typescript
{
  date: '2026-04-05T__:__:00',
  agent: 'claude-code',
  summary: 'Strands Phase 7: Bridge Strands agent events to cognition SSE via telemetry adapter. Fix ERR_INCOMPLETE_CHUNKED_ENCODING in cognition stream. Add ConversationManager for Strands session memory.',
  files: ['backend-hono/src/services/strands/telemetry.ts', 'backend-hono/src/services/strands/memory-store.ts', 'backend-hono/src/routes/ai/handlers/queue.ts', 'backend-hono/src/services/strands/agents/harper.ts']
}
```

## Post-Push Memory Update
After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:
1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
