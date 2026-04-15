# Task Brief: S16-T1 — Hermes Agent Individuality + Persistent Memory + Catalyst Access

**Date:** 2026-04-15
**Scope:** Inject full persona files, context bank memories, and rich scored catalysts into every Hermes agent invocation — zero memory lapses.
**Estimated files:** 6
**Repo root:** `~/Documents/Codebases/fintheon`
**Working directory:** `~/Documents/Codebases/fintheon/backend-hono`

## Prerequisites

- Read `~/Documents/Codebases/fintheon/CLAUDE.md` for project rules (changelog protocol, version branching, no gradients/colored emojis).
- Build: `cd ~/Documents/Codebases/fintheon/backend-hono && bun run build`
- Backend is launchd-managed: `io.solvys.fintheon-backend`. After changes: `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist && bun run build && launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`
- Backend runs from `dist/` not `src/` — must `bun run build` before restart.

## Context

Hermes agents produce generic, groupthink-y output because they only receive thin 5-line role descriptions from `BASE_PROMPTS` and 10 bare headlines via `buildFeedContext()`. Rich 8KB+ persona files exist at `~/.hermes/memories/harper-handoff/agent-personas/` but are never loaded. The `agent_context_bank` Supabase table has full CRUD but `getContextForAgent()` is never called during chat invocations. Scored catalysts with IV scores, sentiment, tags, and macro levels are available in `scored_riskflow_items` but agents only see 10 stripped-down headlines.

## Files to Read First

- `backend-hono/src/services/ai/agent-instructions/index.ts` — Current prompt composition: `getAgentSystemPrompt()` (sync, cached) + `buildFeedContext()` (10 headlines via getFeed). This is the main file to modify.
- `backend-hono/src/services/ai/agent-instructions/base-prompts.ts` — The thin 5-line role descriptions per agent.
- `backend-hono/src/services/hermes-handler.ts` — Lines 528-600: `handleHermesChat()` assembles systemPrompt from getAgentSystemPrompt + feedContext + reflectContext + thoughtBankBlock. Primary caller.
- `backend-hono/src/services/harper-handler.ts` — Line 227: `buildFeedContext()` call for Harper. Secondary caller.
- `backend-hono/src/services/agent-context-bank-service.ts` — `getContextForAgent(userId, agentId)` reads from `agent_context_bank` table. Already exists, never called during chat.
- `backend-hono/src/services/strands/agent-factory.ts` — Line 204: calls `getAgentSystemPrompt("harper-cao", {})`. Caller.
- `backend-hono/src/services/strands/agents/harper.ts` — Line 55: calls `getAgentSystemPrompt("harper-cao", {})`. Caller.
- `backend-hono/src/services/riskflow/aquarium-scheduler.ts` — Lines 34-58: `fetchRecentHeadlines()` — the GOOD pattern for catalyst injection (direct Supabase query, IV >= 4, last 12h, includes sentiment/macro_level/tags).
- `~/.hermes/memories/harper-handoff/agent-personas/oracle.md` — Example rich persona file (8.6KB, full personality, communication style, trade templates, second-level thinking framework).
- `~/.hermes/memories/harper-handoff/agent-personas/` — All persona files: `harper.md`, `oracle.md`, `feucht.md`, `horace.md` (Consul), `herald.md`.

## What to Build/Change

### 1. Persona File Loader

- **Path:** `backend-hono/src/services/ai/agent-instructions/index.ts`
- **Action:** Modify
- **Spec:**
  - Add `async function loadPersonaFile(role: HermesAgentRole): Promise<string>` that reads `.md` files from `~/.hermes/memories/harper-handoff/agent-personas/` using `fs.readFile`.
  - Role→file mapping: `harper-cao`→`harper.md`, `pma-merged`→`oracle.md`, `futures-desk`→`feucht.md`, `fundamentals-desk`→`horace.md`, `herald`→`herald.md`
  - Cache persona content with 5-min TTL (use a `Map<string, { content: string; expiresAt: number }>`, same pattern as the existing `promptCache`).
  - Graceful fallback: if file not found, log warning and return empty string — don't crash.

### 2. Make getAgentSystemPrompt Async

- **Path:** `backend-hono/src/services/ai/agent-instructions/index.ts`
- **Action:** Modify
- **Spec:**
  - Change `getAgentSystemPrompt` return type from `string` to `Promise<string>`.
  - After loading BASE_PROMPT (step 1), call `await loadPersonaFile(role)` and insert the result as a `## Full Persona Profile` markdown section between the base prompt and SHARED_BELIEFS.
  - The prompt cache must store the fully resolved string (await the persona load, then cache the combined result).
  - Composition order becomes: BASE_PROMPT → PERSONA FILE → SHARED_BELIEFS → CAPABILITIES_BLOCK → PHILOSOPHY → GATES → SKILLS → DEEP_ANALYSIS

### 3. Inject Context Bank Memories

- **Path:** `backend-hono/src/services/hermes-handler.ts`
- **Action:** Modify
- **Spec:**
  - Import `getContextForAgent` from `../agent-context-bank-service.js`
  - In `handleHermesChat()` (around line 540), after building `basePrompt`, call `getContextForAgent()` with:
    - `userId`: use a system user ID constant (e.g., `"00000000-0000-0000-0000-000000000000"` or derive from request)
    - `agentId`: map from HermesAgentRole → context bank agent ID: `harper-cao`→`harper-opus`, `pma-merged`→`oracle`, `futures-desk`→`feucht`, `fundamentals-desk`→`consul`, `herald`→`herald`
  - Format returned `AgentMemoryEntry[]` into a prompt block:
    ```
    ## Agent Memory Bank
    ### Soul
    [content entries...]
    ### Protocol
    [content entries...]
    ### Observations
    [content entries...]
    ### Preferences
    [content entries...]
    ```
  - Insert this block into systemPrompt AFTER feedContext (so it's: basePrompt + feedContext + memoryBank + reflectContext + thoughtBankBlock).
  - This MUST happen on every invocation — no lazy skips, no conditional gates.

- **Path:** `backend-hono/src/services/harper-handler.ts`
- **Action:** Modify
- **Spec:** Same context bank injection pattern in `chatWithHarper()` around line 227.

### 4. Rich Catalyst Injection

- **Path:** `backend-hono/src/services/ai/agent-instructions/index.ts` — `buildFeedContext()`
- **Action:** Modify
- **Spec:**
  - Replace `getFeed("system", { limit: 10 })` with a direct Supabase query to `scored_riskflow_items` (copy the pattern from `aquarium-scheduler.ts` lines 34-58).
  - Query: `.select("headline, sentiment, iv_score, macro_level, tags, source, published_at")`, `.gte("published_at", 12h_ago)`, `.gte("iv_score", 2)`, `.order("iv_score", { ascending: false })`, `.limit(30)`
  - Format each item as: `[IV 8.2 bearish ML4 | tariffs, trade-war] Trump announces 25% China tariffs (DeItaOne)`
  - Import `getSupabaseClient` from `../../config/supabase.js`
  - Keep the `try/catch` returning empty string on failure.

### 5. Update All Callers to Await

- **Paths:**
  - `backend-hono/src/services/hermes-handler.ts` line 536 → `const basePrompt = await getAgentSystemPrompt(...)`
  - `backend-hono/src/services/strands/agent-factory.ts` line 204 → `systemPrompt: await getAgentSystemPrompt(...)`
  - `backend-hono/src/services/strands/agents/harper.ts` line 55 → `const systemPrompt = await getAgentSystemPrompt(...)`
- **Action:** Modify each — add `await` and ensure the containing function is `async`.

## Key Rules

- Agent persona files are at `~/.hermes/memories/harper-handoff/agent-personas/` — use absolute path with `os.homedir()` or `process.env.HOME`.
- The `getContextForAgent()` function in `agent-context-bank-service.ts` already handles filtering expired entries and excluding `exclude_from_sync` entries — don't reimplement that logic.
- `VALID_AGENTS` in agent-context-bank-service.ts lists valid IDs: `harper-opus`, `oracle`, `feucht`, `consul`, `herald`, `sentinel`, `charles`, `horace`, `codi`, `price`.
- The persona file for Consul is named `horace.md` (his original codename), not `consul.md`.

## DO NOT

- Delete or modify the persona `.md` files in `~/.hermes/`
- Touch any frontend files
- Change the agent routing logic in `hermes-handler.ts` (intent detection, model selection)
- Remove the existing `BASE_PROMPTS` — they serve as the short role intro before the full persona
- Add any new npm dependencies

## Verification

```bash
cd ~/Documents/Codebases/fintheon/backend-hono && bun run build
# Restart backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null; launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
# Test: chat with Oracle and verify persona-specific language in response
curl -X POST http://localhost:8080/api/hermes/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What prediction markets look interesting right now?","agentOverride":"pma-merged"}' | head -c 500
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'S16-T1: Inject full persona files, context bank memories, and rich scored catalysts (30 items with IV/sentiment/tags) into every Hermes agent invocation. Made getAgentSystemPrompt async. Zero memory lapses.',
  files: [
    'backend-hono/src/services/ai/agent-instructions/index.ts',
    'backend-hono/src/services/hermes-handler.ts',
    'backend-hono/src/services/harper-handler.ts',
    'backend-hono/src/services/strands/agent-factory.ts',
    'backend-hono/src/services/strands/agents/harper.ts'
  ]
}
```

## Post-Push Memory Update

After committing, log any bugs or broken patterns to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md` and add pointer to `MEMORY.md`. Skip if no bugs found.
