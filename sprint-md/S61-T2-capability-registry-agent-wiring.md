# Sprint Brief: T2 -- Capability Registry Runtime + Agent Tool Wiring

## Context

Today's "capability registry" is the static text block `CROSS_AGENT_REGISTRY_BLOCK` in `agent-instructions/index.ts`. Sub-agents (oracle/feucht/consul/herald) are created as bare agents in `agent-factory.ts` -- they get only a system prompt, zero tools. The `CRUD_CAPABILITY_BLOCK` advertises endpoints (`/api/agent/narratives`, `/api/agent/regimes`) that don't exist. T2 replaces this with a Zod-validated, machine-readable capability registry enforced at runtime. Every agent gets its correct tool set wired; prohibited tools are blocked.

## Branch Target

`sprint/S61`

## Scope -- Included

- [ ] `backend-hono/src/services/capability-registry/types.ts` [NEW] -- Zod schemas: `AgentCapabilityProfile` (agent_id, responsibilities[], required_tools[], optional_tools[], prohibited_tools[], handoff_targets[]), `ToolPermission`, `RegistryEnforcementResult` (allowed: boolean, reason: string)
- [ ] `backend-hono/src/services/capability-registry/registry.ts` [NEW] -- static registry of all 5 agents as `Record<string, AgentCapabilityProfile>`. `loadRegistry()` validates all profiles against Zod on import. `getProfile(agentId)` returns validated profile or throws. `getAllProfiles()` returns all.
- [ ] `backend-hono/src/services/capability-registry/enforcer.ts` [NEW] -- `enforceCapability(agentId, toolName): RegistryEnforcementResult` checks required_tools, optional_tools, prohibited_tools and returns allow/deny with reason. `getHandoffTargets(agentId)` returns valid handoff destinations. `getRequiredTools(agentId)` returns tool list for agent creation.
- [ ] `backend-hono/src/services/ai/agent-instructions/index.ts` [EDIT] -- replace `CROSS_AGENT_REGISTRY_BLOCK` text (lines ~80-120) with a call to `renderRegistryBlock()` that reads from the runtime registry. Replace `CRUD_CAPABILITY_BLOCK` (lines ~130-160, advertises non-existent endpoints) with a note that mutations go through the unified approval pipeline. Preserve `getAgentSystemPrompt()` return shape `{ systemPrompt: string }`.
- [ ] `backend-hono/src/services/ai/soul/harper.md` [EDIT] -- update `tools:` section to `required: [handoff_to_*, browse_task, run_command, read_file, write_file, web_fetch, read_mcp_config, get_fintheon_paths]`, `optional: [all MCP tools]`, `prohibited: []`. Preserve `native_home` identity block (S59-T2).
- [ ] `backend-hono/src/services/ai/soul/oracle.md` [EDIT] -- update `tools:` section to `required: [get_kalshi_quote, get_polymarket_quote, get_options_iv_surface, handoff_to_harper]`, `optional: [get_econ_calendar]`, `prohibited: [run_command, write_file, web_fetch]`. Preserve `native_home`.
- [ ] `backend-hono/src/services/ai/soul/feucht.md` [EDIT] -- update `tools:` section to `required: [get_quote, get_vwap, get_fib_levels, get_ema_stack, submit_trade_idea, handoff_to_harper]`, `optional: [get_econ_calendar]`, `prohibited: [run_command, write_file, web_fetch]`. Preserve `native_home`.
- [ ] `backend-hono/src/services/ai/soul/consul.md` [EDIT] -- update `tools:` section to `required: [get_earnings_calendar, get_analyst_revisions, get_company_fundamentals, get_sector_rotation, handoff_to_harper]`, `optional: [get_econ_calendar]`, `prohibited: [run_command, write_file, web_fetch]`. Preserve `native_home`.
- [ ] `backend-hono/src/services/ai/soul/herald.md` [EDIT] -- update `tools:` section to `required: [get_sentiment_skew, get_aaii_survey, get_put_call_ratio, get_unusual_options_flow, get_news_velocity, handoff_to_harper]`, `optional: [get_econ_calendar, web_fetch]`, `prohibited: [run_command, write_file]`. Preserve `native_home`.
- [ ] `backend-hono/src/services/strands/agent-factory.ts` [EDIT] -- wire sub-agent tools based on capability registry. Currently oracle/feucht/consul/herald create bare agents (systemPrompt only). After edit: each calls `getRequiredTools(agentId)` to get tool list, passes to `createAgent()`. Harper unchanged (already has full tool wiring).
- [ ] `backend-hono/src/services/strands/agents/oracle.ts` [EDIT] -- import registry, call `getRequiredTools("oracle")`, pass tools to `createAgent()`
- [ ] `backend-hono/src/services/strands/agents/feucht.ts` [EDIT] -- same pattern
- [ ] `backend-hono/src/services/strands/agents/consul.ts` [EDIT] -- same pattern
- [ ] `backend-hono/src/services/strands/agents/herald.ts` [EDIT] -- same pattern

## Scope -- Excluded (DO NOT TOUCH)

- `backend-hono/src/services/tool-approval-store.ts` -- T1 owns this (already extended)
- `backend-hono/src/services/strands/harper-tools.ts` -- Harper's `withApprovalGate()` preserved as-is
- `backend-hono/src/routes/arbitrum/` -- Arbitrum out of scope
- `backend-hono/src/routes/harper/` -- existing approval routes untouched
- Any frontend file -- T4 owns frontend

## Reuse Inventory (existing code to call, not reinvent)

- `createAgent()` at `backend-hono/src/services/strands/agent-factory.ts:20` -- factory all sub-agents call. Signature: `createAgent(options: { agentId, provider?, systemPrompt?, tools?, conversationId? })`
- `getAgentSystemPrompt()` at `backend-hono/src/services/ai/agent-instructions/index.ts:350` -- must preserve return shape `{ systemPrompt: string }`
- `HERMES_AGENTS` at `backend-hono/src/services/hermes-service.ts:138` -- static agent definitions for role mapping
- `loadSoul()` at `backend-hono/src/services/ai/soul/loader.ts:45` -- SOUL.md parser with Zod `SoulSchema` validation. Reads YAML frontmatter + markdown body. Do not break.
- `ROLE_TO_SOUL_ID` at `backend-hono/src/services/ai/agent-instructions/index.ts:30` -- maps `harper-cao→harper`, `pma-merged→oracle`, `futures-desk→feucht`, `fundamentals-desk→consul`, `herald→herald`
- `renderSystemPrompt()` at `backend-hono/src/services/ai/soul/loader.ts:180` -- renders final system prompt from parsed SOUL

## Known Issues to Preserve

- All 5 SOUL.md `native_home` blocks must remain intact (S59-T2 persona unification, May 5)
- `grounding.source_of_truth: ../../../../../CLAUDE.md` in every SOUL must stay
- `constraints` blocks (Never place orders, No ornaments, etc.) must stay
- `handoff_rules` (max 3 handoffs, max depth 2, self-handoff rejected) must stay
- `voice_style` per agent must stay
- `memory_policy.writes` per agent must stay
- `model_preferences` per agent must stay
- `getAgentSystemPrompt()` return shape must not change
- `SoulSchema` Zod validation in `loader.ts` must still pass after edits
- GEPA optimizer (S59-T2) modifies SOUL.md files at 02:00 ET -- new tool sections must survive optimizer runs

## Implementation Steps

1. Create `backend-hono/src/services/capability-registry/types.ts`:
   - Define Zod schemas: `AgentCapabilityProfile` (z.object with agent_id, responsibilities, required_tools, optional_tools, prohibited_tools, handoff_targets), `ToolPermission` enum (required/optional/prohibited), `RegistryEnforcementResult`
   - Export `AgentCapabilityProfile` type from Zod inference

2. Create `backend-hono/src/services/capability-registry/registry.ts`:
   - Define static `CAPABILITY_REGISTRY` Record with 5 agents using the exact tool lists from SOUL.md:
     - Harper: required=[handoff_to_oracle, handoff_to_feucht, handoff_to_consul, handoff_to_herald, browse_task, run_command, read_file, write_file, web_fetch, read_mcp_config, get_fintheon_paths], optional=[all MCP tools], prohibited=[]
     - Oracle: required=[get_kalshi_quote, get_polymarket_quote, get_options_iv_surface, handoff_to_harper], optional=[get_econ_calendar], prohibited=[run_command, write_file, web_fetch], handoff=[harper, feucht, consul]
     - Feucht: required=[get_quote, get_vwap, get_fib_levels, get_ema_stack, submit_trade_idea, handoff_to_harper], optional=[get_econ_calendar], prohibited=[run_command, write_file, web_fetch], handoff=[harper, oracle, consul]
     - Consul: required=[get_earnings_calendar, get_analyst_revisions, get_company_fundamentals, get_sector_rotation, handoff_to_harper], optional=[get_econ_calendar], prohibited=[run_command, write_file, web_fetch], handoff=[harper, oracle, feucht]
     - Herald: required=[get_sentiment_skew, get_aaii_survey, get_put_call_ratio, get_unusual_options_flow, get_news_velocity, handoff_to_harper], optional=[get_econ_calendar, web_fetch], prohibited=[run_command, write_file], handoff=[harper, oracle, feucht, consul]
   - `loadRegistry()`: validates all profiles with Zod on import, logs warnings for invalid
   - `getProfile(agentId)`, `getAllProfiles()`, `getRequiredTools(agentId)`, `getHandoffTargets(agentId)`

3. Create `backend-hono/src/services/capability-registry/enforcer.ts`:
   - `enforceCapability(agentId, toolName): RegistryEnforcementResult`
   - Check prohibited first (fast-fail), then required, then optional
   - Log denials via `createLogger("capability-registry")`

4. Edit `backend-hono/src/services/ai/agent-instructions/index.ts`:
   - Import `getAllProfiles`, `getHandoffTargets` from registry
   - Create `renderRegistryBlock()` that reads profiles and formats them as inline prompt text
   - Replace the static `CROSS_AGENT_REGISTRY_BLOCK` string with `renderRegistryBlock()`
   - Replace `CRUD_CAPABILITY_BLOCK` with a note: "Mutations go through the unified approval pipeline (see /api/harper/tool-decision)"
   - Verify `getAgentSystemPrompt()` return unchanged

5. Edit all 5 SOUL.md files (`backend-hono/src/services/ai/soul/*.md`):
   - Each file has a YAML frontmatter section with `tools:` key
   - Update the `tools:` section to add `required:`, `optional:`, `prohibited:` sub-lists
   - Do NOT touch `native_home`, `constraints`, `handoff_rules`, `voice_style`, `memory_policy`, `model_preferences`, `grounding`, `app_control`, `learning_protocol`
   - Verify `loadSoul()` Zod validation still passes (the `SoulSchema` in `loader.ts` line ~60 parses the full YAML frontmatter)

6. Edit `backend-hono/src/services/strands/agent-factory.ts`:
   - Import `getRequiredTools` from registry
   - In the agent creation path (around lines 100-200 where `createAgent` is called per agentId), add: `const tools = getRequiredTools(agentId)`
   - Pass `tools` to `createAgent({ ..., tools })`
   - Harper path unchanged (already has explicit tool wiring in `harper.ts`)

7. Edit strand agent files (oracle.ts, feucht.ts, consul.ts, herald.ts):
   - Each is ~16 lines, currently: `import { createAgent } from "../agent-factory.js"; export const oracleAgent = createAgent({ agentId: "oracle", provider: "nous", systemPrompt: {...} })`
   - Add `import { getRequiredTools } from "../../capability-registry/registry.js"`
   - Add `tools: getRequiredTools("oracle")` to the `createAgent()` call
   - Same pattern for feucht/consul/herald

## Acceptance Criteria

- [ ] Capability registry loads without errors on backend startup
- [ ] `enforceCapability("feucht", "run_command")` returns `{ allowed: false, reason: "prohibited tool" }`
- [ ] `enforceCapability("oracle", "get_kalshi_quote")` returns `{ allowed: true, reason: "required tool" }`
- [ ] `enforceCapability("consul", "get_econ_calendar")` returns `{ allowed: true, reason: "optional tool" }`
- [ ] Sub-agents (oracle/feucht/consul/herald) now have actual tool sets wired (not bare agents)
- [ ] `getAgentSystemPrompt()` returns valid system prompt with registry-resolved handoff block
- [ ] All 5 SOUL.md `native_home` blocks intact after edits
- [ ] `SoulSchema` Zod validation still passes for all 5 agents
- [ ] Harper chat still works (`curl -s -X POST http://localhost:8080/api/harper/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"test"}]}' | head -c 200`)
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
[v6.0.17] feat: S61-T2 capability registry runtime enforcement + agent tool wiring
```
