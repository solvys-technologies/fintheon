# Task Brief: Strands Phase 8 — Vercel AI SDK Removal + Route Cutover

**Date:** 2026-04-05
**Scope:** Replace all Vercel AI SDK imports with Strands equivalents in route handlers, then remove `ai` and `@ai-sdk/*` packages.
**Estimated files:** 17
**Repo root:** `~/Documents/Codebases/fintheon`
**Working directory:** `~/Documents/Codebases/fintheon/backend-hono`

## Prerequisites

- Phases 6 (MCP) and 7 (Observability) should be complete first.
- The Strands SDK is at `@strands-agents/sdk@1.0.0-rc.2` in `backend-hono/`.
- The full Strands layer lives at `backend-hono/src/services/strands/` with: `provider.ts`, `agent-factory.ts`, `harper-tools.ts`, `stream-adapter.ts`, `pipeline.ts`, `mcp-loader.ts`, `telemetry.ts`, `memory-store.ts`, `agents/`, `skills/`.
- VProxy (localhost:8317) provides Claude models via OpenAI-compatible API.
- Build command: `cd ~/Documents/Codebases/fintheon/backend-hono && bun run build`
- Health check: `fintheon doctor` (run before AND after)
- Read `~/Documents/Codebases/fintheon/CLAUDE.md` for project rules (changelog protocol, version branching).

## Context

Phases 1-7 built the complete Strands layer alongside the existing Vercel AI SDK code. Both stacks coexist. This phase cuts over the route handlers to use Strands, then removes the old packages. This is the highest-risk phase — every chat/AI endpoint changes.

**CRITICAL**: Run `fintheon doctor` before AND after. The backend must be healthy throughout.

## Files to Read First

- `~/Documents/Codebases/fintheon/backend-hono/src/services/strands/index.ts` — Everything available from Strands layer
- `~/Documents/Codebases/fintheon/backend-hono/src/services/strands/stream-adapter.ts` — `strandsToUIStream()` + `uiStreamToSSEResponse()`
- `~/Documents/Codebases/fintheon/backend-hono/src/services/strands/agents/harper.ts` — `streamHarperChat()` drop-in replacement
- `~/Documents/Codebases/fintheon/backend-hono/src/routes/ai/handlers/chat.ts` — Main chat handler (LARGEST file, most complex)
- `~/Documents/Codebases/fintheon/backend-hono/src/routes/harper/index.ts` — Harper chat route (already has Strands-compatible structure)
- `~/Documents/Codebases/fintheon/CLAUDE.md` — Project rules (changelog protocol, version branching)

## What to Build/Change

### Group A: Route Handler Cutover (the critical path)

#### 1. Harper Chat Route

- **Path:** `backend-hono/src/routes/harper/index.ts`
- **Action:** Modify
- **Spec:**
  - Replace the entire `app.post('/chat')` handler body
  - Import `streamHarperChat` from `../../services/strands/index.js`
  - Call `streamHarperChat(options, headers)` which returns a Response directly
  - Remove imports: `createUIMessageStreamResponse` from `ai`, `harperChat`/`isHarperAvailable` from old handler, `BridgeStreamEvent` from claude-sdk bridge
  - Keep: conversation store, cognition emitter, tool-decision endpoints, permissions endpoints
  - The old 230-line ReadableStream construction is replaced by one `streamHarperChat()` call

#### 2. Main AI Chat Handler

- **Path:** `backend-hono/src/routes/ai/handlers/chat.ts`
- **Action:** Modify
- **Spec:**
  - This is the most complex file. It has agent routing (detectAgent), skill detection, model selection, and streaming.
  - Replace `streamText` + `createUIMessageStreamResponse` with Strands agent invocation
  - For non-Harper agents (Oracle, Feucht, Consul, Herald): create the appropriate Strands agent, invoke with `strandsToUIStream()`, return `uiStreamToSSEResponse()`
  - Keep the agent detection logic (`detectAgent`), skill extraction, and cognition emitter
  - Remove imports: `streamText`, `createUIMessageStreamResponse` from `ai`, `selectModel`/`createModelClient` from model-selector
  - **WARNING**: This file is large and complex. Read it fully before modifying. Preserve all conversation store logic.

#### 3. Narrative Handlers

- **Path:** `backend-hono/src/routes/narrative/handlers.ts`
- **Action:** Modify
- **Spec:**
  - Uses `generateText` from `ai` — replace with Strands `agent.invoke()` for one-shot generation
  - Create a lightweight agent (no tools) for narrative generation

#### 4. MiroShark Deliberation

- **Path:** `backend-hono/src/services/miroshark/miroshark-deliberation.ts`
- **Action:** Modify
- **Spec:**
  - Uses `generateText` from `ai` for each deliberation phase
  - Replace with Strands agent invocations (one agent per phase)
  - Preserve the 4-phase state machine and anti-groupthink logic

#### 5. MiroShark Client

- **Path:** `backend-hono/src/services/miroshark/miroshark-client.ts`
- **Action:** Modify
- **Spec:** Same as deliberation — replace `generateText` with Strands agent

### Group B: Support File Cutover

#### 6-10. Agent analysis files that use `generateText`

These files all follow the same pattern — replace `generateText` from `ai` with a Strands agent invocation:

- `backend-hono/src/services/agents/base-agent.ts`
- `backend-hono/src/services/agents/risk-manager.ts`
- `backend-hono/src/services/agents/trader-agent.ts`
- `backend-hono/src/services/agents/debate-protocol.ts`
- `backend-hono/src/services/brief-generator.ts`

#### 11. RiskFlow Agent Notes

- **Path:** `backend-hono/src/services/riskflow/agent-notes.ts`
- **Action:** Modify — replace `generateText` usage

#### 12. Grok Analyzer

- **Path:** `backend-hono/src/services/analysis/grok-analyzer.ts`
- **Action:** Modify — replace AI SDK model creation with Strands

### Group C: Model Infrastructure Removal

#### 13. Model Selector (deprecate)

- **Path:** `backend-hono/src/services/ai/model-selector.ts`
- **Action:** Modify or delete
- **Spec:** The model routing logic (task→model, fallback chains) should be preserved but rewired to create Strands agents instead of `@ai-sdk` clients. Move the routing config into `backend-hono/src/services/strands/model-router.ts` if needed.

#### 14. Hermes Service

- **Path:** `backend-hono/src/services/hermes-service.ts`
- **Action:** Modify
- **Spec:** Remove `createOpenAI` import from `@ai-sdk/openai`. The agent definitions (types, interfaces) stay — they're consumed everywhere.

#### 15. VProxy Anthropic Client (archive)

- **Path:** `backend-hono/src/services/vproxy/anthropic-client.ts`
- **Action:** Delete or archive
- **Spec:** Fully replaced by `backend-hono/src/services/strands/provider.ts` + `harper-tools.ts`. All exports from this file must have equivalents in the strands layer before deletion.

### Group D: Frontend (minimal changes)

#### 16-17. Frontend Chat Hooks

- **Path:** `frontend/components/chat/hooks/useHermesChat.ts`
- **Path:** `frontend/components/chat/hooks/useChatWithAuth.ts`
- **Action:** Audit
- **Spec:** These import from `ai` package. Check if they use `useChat` or just types. If types only, replace with local types. If `useChat`, keep the `ai` package in frontend only (it's the transport consumer, not the provider).

### Group E: Package Cleanup

#### Backend package.json

- **Path:** `backend-hono/package.json`
- **Action:** Modify
- **Spec:** Remove these dependencies:
  - `ai`
  - `@ai-sdk/anthropic`
  - `@ai-sdk/openai`
  - `@ai-sdk/xai`
  - `@ai-sdk/groq`
  - `@ai-sdk/gateway`
- Run `bun install` to clean lockfile

#### Root + Frontend package.json

- **Action:** Audit
- **Spec:** Check if `ai` or `@ai-sdk/react` are needed by frontend. If `@assistant-ui/react-ai-sdk` requires them, keep them. Only remove what's safe.

## Key Rules

- **Test after every file change** — `bun run build` must pass at each step
- **Do Group A files one at a time** — each is a potential breakpoint
- **Keep Vercel AI SDK in frontend** if `@assistant-ui/react-ai-sdk` depends on it
- The `createUIMessageStreamResponse` from `ai` is replaced by `uiStreamToSSEResponse` from strands layer
- The `streamText` from `ai` is replaced by `agent.stream()` + `strandsToUIStream()`
- The `generateText` from `ai` is replaced by `agent.invoke()`
- Preserve all conversation store writes (addMessage, getConversation, etc.)
- Follow patterns already established in `backend-hono/src/services/strands/`
- All new agents use VProxy via `createAgent()` from agent-factory

## DO NOT

- Touch the strands layer files (they're done)
- Remove packages before verifying all imports are gone (grep first)
- Break the frontend — if in doubt, keep `ai` package for frontend
- Remove types/interfaces from hermes-service.ts that are used elsewhere
- Modify `.claude/hooks/` or `.claude/settings.json`

## Verification

```bash
cd ~/Documents/Codebases/fintheon/backend-hono
# Pre-flight
fintheon doctor

# After each Group:
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v scripts/
bun run build

# After Group E (package removal):
grep -rn "from 'ai'" src/ --include="*.ts" | grep -v node_modules  # should be 0
grep -rn "from '@ai-sdk" src/ --include="*.ts" | grep -v node_modules  # should be 0
bun install
bun run build

# Final:
fintheon doctor
# Manual: start backend, test Harper chat, test MiroShark deliberation
```

## Changelog Entry

```typescript
{
  date: '2026-04-05T__:__:00',
  agent: 'claude-code',
  summary: 'Strands Phase 8: Full cutover — replaced all Vercel AI SDK imports with Strands agents across 15 backend files. Removed ai, @ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/xai, @ai-sdk/groq, @ai-sdk/gateway packages from backend.',
  files: [
    'backend-hono/src/routes/harper/index.ts',
    'backend-hono/src/routes/ai/handlers/chat.ts',
    'backend-hono/src/routes/narrative/handlers.ts',
    'backend-hono/src/services/miroshark/miroshark-deliberation.ts',
    'backend-hono/src/services/miroshark/miroshark-client.ts',
    'backend-hono/src/services/agents/base-agent.ts',
    'backend-hono/src/services/agents/risk-manager.ts',
    'backend-hono/src/services/agents/trader-agent.ts',
    'backend-hono/src/services/agents/debate-protocol.ts',
    'backend-hono/src/services/brief-generator.ts',
    'backend-hono/src/services/riskflow/agent-notes.ts',
    'backend-hono/src/services/analysis/grok-analyzer.ts',
    'backend-hono/src/services/ai/model-selector.ts',
    'backend-hono/src/services/hermes-service.ts',
    'backend-hono/package.json',
  ]
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
