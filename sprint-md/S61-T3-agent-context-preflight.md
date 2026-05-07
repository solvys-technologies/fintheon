# Sprint Brief: T3 -- Agent Context Preflight for All 5 Agents

## Context

Today, only Harper gets rich context injection (RiskFlow context, Aquarium context, user profile, memory blocks) via `harper-handler.ts`. The `hermes/context-engine.ts` builds context but is Harper-centric. Sub-agents in the Strands pipeline receive only a bare system prompt. T3 extends context preflight to all 5 agents so every agent receives desk context (recent agent outputs, task artifacts, memory blocks) before external tool use.

## Branch Target

`sprint/S61`

## Scope -- Included

- [ ] `backend-hono/src/services/desk-context/preflight.ts` [NEW] -- `async preflight(agentId: string): Promise<DeskContextBlock>` assembles: recent agent outputs (last 24h from ops feed/journal), task artifacts (last 10 from memory), relevant memory blocks, active desk plan. Returns structured context block as string for prompt injection. Gracefully degrades on any failure (returns empty context, never crashes).
- [ ] `backend-hono/src/services/desk-context/agent-outputs.ts` [NEW] -- reads recent agent outputs from the ops feed (`harper-ops` journal) and/or memory table. `getRecentOutputs(agentId, hoursBack): Promise<string[]>` returns formatted text blocks.
- [ ] `backend-hono/src/services/hermes/context-engine.ts` [EDIT] -- extend `buildContext()` to call `preflight(agentId)` for any agent (not just Harper). Insert preflight context between system prompt and conversation history. Preserve existing compression logic (6 recent turns + summary when budget exceeded).
- [ ] `backend-hono/src/services/harper-handler.ts` [EDIT] -- delegate ad-hoc context building (Aquarium, RiskFlow, user profile assembly) to the new preflight service. Replace `buildAquariumContext()` call with preflight result. Preserve Harper Vision context (screen + audio, last 120s) which is Harper-specific and not part of general preflight.

## Scope -- Excluded (DO NOT TOUCH)

- `backend-hono/src/services/tool-approval-store.ts` -- T1 owns this
- `backend-hono/src/services/ai/soul/*.md` -- T2 owns these
- `backend-hono/src/services/strands/` -- T2 owns these
- `backend-hono/src/routes/arbitrum/` -- out of scope
- Any frontend file -- T4 owns frontend

## Reuse Inventory (existing code to call, not reinvent)

- `buildContext()` at `backend-hono/src/services/hermes/context-engine.ts:24` -- signature: `buildContext(agentId, messages, budgetTokens): Promise<{ systemPrompt, messages[], tokenBreakdown }>` -- extend, do not replace
- `getContextForAgent()` at `backend-hono/src/services/agent-context-bank-service.ts` -- fetches agent-specific memory entries from the context bank
- `assembleSimulationContext()` at `backend-hono/src/services/agent-desk/agent-desk-context.ts` -- existing desk context assembly used by Arbitrum
- `streamHarperChat()` at `backend-hono/src/services/harper-handler.ts:180` -- main Harper chat entry point. Signature: `(opts: { message, conversationId, history, persona?, riskFlowContext?, surface?, userId?, requestId? })` -- must still work after context building refactor
- `buildFeedContext()` at `backend-hono/src/services/ai/agent-instructions/index.ts:120` -- builds RiskFlow feed context for inline prompt injection
- Harper routes at `backend-hono/src/routes/harper/index.ts` -- calls `streamHarperChat()`, must still work
- Hermes context engine token constants: `DEFAULT_TOKEN_BUDGET = 120_000`, `SYSTEM_RESERVED_TOKENS = 8_000`

## Known Issues to Preserve

- Harper Vision context (screen capture + audio, last 120s, userId-gated) is Harper-specific and must remain so
- Token budget compression: when history exceeds budget, keep 6 most recent turns + summarize earlier ones -- must still work
- System prompt must still reserve `SYSTEM_RESERVED_TOKENS` tokens before preflight is appended
- `buildContext()` is called by Harper chat, Strands pipeline, Boardroom huddles, and Arbitrum -- all callers must still work
- Mobile PWA CAO chat uses the same `streamHarperChat()` path -- must not regress

## Implementation Steps

1. Create `backend-hono/src/services/desk-context/agent-outputs.ts`:
   - `getRecentOutputs(agentId, hoursBack = 24): Promise<string[]>` 
   - Query the ops feed / journal table via Supabase for entries matching agentId
   - Fall back gracefully (return []) on DB failure
   - Format each output as: `[${timestamp}] ${agentId}: ${summary}`

2. Create `backend-hono/src/services/desk-context/preflight.ts`:
   - `async preflight(agentId: string): Promise<string>` returns formatted context block like:
     ```
     ## Desk Context (Recent Activity)
     - [outputs from getRecentOutputs]
     ## Relevant Memory
     - [memory entries from getContextForAgent]
     ```
   - Each data source wrapped in try/catch -- failure in one source doesn't block context assembly
   - Maximum 2000 characters per context block to preserve token budget
   - Harper gets additional RiskFlow context (IV≥5 items, last 4h, top 10) via `buildFeedContext()`
   - Use `createLogger("desk-context")` for all logging

3. Edit `backend-hono/src/services/hermes/context-engine.ts`:
   - Import `preflight` from new desk-context service
   - In `buildContext()` (around line 30-40, after `buildSoulPipeline` call):
     ```typescript
     const deskContext = await preflight(agentId).catch(() => "");
     ```
   - Insert `deskContext` into the system prompt after the SOUL-grounded prompt and before conversation history
   - Adjust token budget: preflight context counts against `SYSTEM_RESERVED_TOKENS`
   - If preflight string is empty (degraded), skip insertion silently

4. Edit `backend-hono/src/services/harper-handler.ts`:
   - In `streamHarperChat()`, replace the `buildAquariumContext()` call (around line 220) with the preflight result
   - The preflight already includes RiskFlow context for Harper (from `buildFeedContext()`)
   - Keep Harper Vision context assembly (screen + audio, last 120s) as-is -- it's Harper-specific
   - Keep user profile assembly (trader name, symbols, instruments, risk settings) as-is

## Acceptance Criteria

- [ ] `preflight("oracle")` returns a non-empty context block with recent outputs + memory
- [ ] `preflight("unknown_agent")` returns empty string (graceful degradation)
- [ ] When Supabase is unreachable, `preflight()` returns empty string (no crash)
- [ ] Harper chat still works with full context (RiskFlow, Vision, profile, preflight)
- [ ] Strands pipeline sub-agents now receive desk context in their system prompt
- [ ] Token budget respected -- preflight block doesn't overflow `SYSTEM_RESERVED_TOKENS`
- [ ] `buildContext("feucht", messages, 120000)` produces feucht-specific context, not Harper context
- [ ] `cd backend-hono && bun run build` passes

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Backend build
cd backend-hono && bun run build

# Restart backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Harper chat smoke test
curl -s -X POST http://localhost:8080/api/harper/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"test"}]}' | head -c 200

# Diagnostics
curl -s http://localhost:8080/api/diagnostics
```

## Commit Format

```
[v6.0.17] feat: S61-T3 agent context preflight for all 5 agents
```
