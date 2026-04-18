# Sprint Brief: S23-T4 — Unified CAO Memory Bank

## Context

Three agent-memory substrates coexist and none are fully wired:

1. **`agent_context_bank`** — the intended unified user-scoped bank. Production-ready service layer exists at [backend-hono/src/services/agent-context-bank-service.ts](../../backend-hono/src/services/agent-context-bank-service.ts). Harper calls `getContextForAgent("00000000-0000-0000-0000-000000000000", "harper-opus")` at [harper-handler.ts:243-246](../../backend-hono/src/services/harper-handler.ts#L243-L246) — a **hardcoded null UUID**, so memories never return.
2. **`agent_memory`** — per-agent table used only by Hermes via [memory-injector.ts](../../backend-hono/src/services/agent-memory/memory-injector.ts). User-scoped but orphaned from the unified bank.
3. **`peer_shared_memory`** — referenced in [cao-memory-flush.ts](../../backend-hono/src/services/cao-memory-flush.ts); no matching migration. Phantom table.

`traderName` never reaches any prompt — Harper and Hermes both accept `userContext.traderName` in the request body but drop it before prompt assembly. No write path exists for agents to save insights back to `agent_context_bank`. No summarizer.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] **B4.1 USER IDENTITY block.** Thread real `userId` from `c.get("userId")` through [harper/index.ts](../../backend-hono/src/routes/harper/index.ts) → `buildHarperResponse`. Inject a `--- USER IDENTITY ---` block at the top of the system prompt with `traderName`, `tradingGoals`, `instrumentsTraded`, `riskSettings`. Server-side fallback read via settings-store if `userContext.traderName` is absent.
- [ ] **B4.2 Fix Harper's memory read.** Replace the null UUID at [harper-handler.ts:243-246](../../backend-hono/src/services/harper-handler.ts#L243-L246) with real `userId`. In [hermes-handler.ts](../../backend-hono/src/services/hermes-handler.ts), swap the `agent_memory`-based `buildMemoryBlock` for `getContextForAgent(userId, agentId)` so all 5 CAOs read the same bank. Include `is_shared=true` entries so shared observations broadcast across agents.
- [ ] **B4.3 Explicit `[MEMORY]` writes.** Post-response hook in both Harper and Hermes handlers: parse assistant output for `[MEMORY type=preference|observation|protocol|soul shared=true|false]…[/MEMORY]` blocks, call `saveMemory(...)`, strip the block from the client-facing text. Document the tag in each agent's capabilities block.
- [ ] **B4.4 `/api/memory` route.** New [backend-hono/src/routes/memory/index.ts](../../backend-hono/src/routes/memory/index.ts): `POST /save` wraps `saveMemory`, `GET /list` wraps `getContextForAgent`. Mount in the main router.
- [ ] **B4.5 Redirect CAO flush.** In [cao-memory-flush.ts](../../backend-hono/src/services/cao-memory-flush.ts), replace writes to `peer_shared_memory` with `saveMemory({ agentId: 'harper-opus', memory_type: 'observation', is_shared: true })`.
- [ ] **B4.6 Hourly summarizer.** New `backend-hono/src/services/agent-memory/summarizer-job.ts`. Hourly cron colocated with MDB scheduler. Per user, pull last-hour conversations, Haiku 4.5 summarizer prompt, emit `saveMemory` calls, substring de-dupe. Behind `ENABLE_MEMORY_SUMMARIZER=true` env flag for safe rollback.
- [ ] **B4.7 `/api/me` diagnostic.** New [backend-hono/src/routes/me/index.ts](../../backend-hono/src/routes/me/index.ts) returning `{ userId, email, traderName }` for cross-client debugging.

## Scope — Excluded (DO NOT TOUCH)

- Aquarium UI — T1
- Deliberation polling — T2
- Surface-based context injection — T3 owns that gating change (T4 composes with it)
- Supabase migrations — `agent_context_bank` already exists; `agent_memory` deprecated-in-place (don't drop yet)

## Known Issues to Preserve

- `agent_memory` reads stay live as a fallback during cutover — do not delete the service file or table.
- Harper base prompt (HARPER_BASE_SYSTEM_PROMPT) — preserve content, only prepend the USER IDENTITY block.
- Hermes dossier injection pattern — preserve; add memory block alongside, don't replace.

## Implementation Steps

1. Read [backend-hono/src/middleware/auth.ts](../../backend-hono/src/middleware/auth.ts) to confirm `c.get("userId")` is always available on authenticated chat routes.
2. **B4.1.** In `harper/index.ts`, extract `userId = c.get("userId")` (non-boardroom path). Pass into `buildHarperResponse(...)`. In `harper-handler.ts`, assemble USER IDENTITY block from `userContext` + server-side fallback; prepend to system prompt before feed context.
3. **B4.2.** Replace the null UUID. In `hermes-handler.ts`, refactor its memory-block builder to call `getContextForAgent(userId, agentRole)` and format the returned entries in the same layout as the current agent_memory output.
4. **B4.3.** Add `parseMemoryTags(text): { cleaned: string, writes: MemoryWrite[] }` helper. Run after the LLM response completes, issue writes in parallel, return cleaned text to the client. Update agent capabilities to teach the tag usage.
5. **B4.4.** Create `/api/memory` route — thin wrappers over `saveMemory` + `getContextForAgent`, Zod-validated body, auth-required.
6. **B4.5.** In `cao-memory-flush.ts`, swap the `peer_shared_memory` INSERTs for `saveMemory` calls with shared=true.
7. **B4.6.** Create `summarizer-job.ts` with a pure function `summarizeUserHour(userId, agentId, turns) => MemoryWrite[]`. Wire into the cron register next to MDB. Gate the register call behind `process.env.ENABLE_MEMORY_SUMMARIZER === "true"`.
8. **B4.7.** Create `/api/me` route — one-liner returning `{ userId, email, traderName }` from auth context + settings-store.
9. Add changelog entry + file-header comments on each substantially modified file.

## Acceptance Criteria

- [ ] Fresh Harper conversation: "what's my name?" → "TP" (from USER IDENTITY block)
- [ ] "Remember I prefer ES over NQ for swing trades" → `[MEMORY type=preference]` written to `agent_context_bank`; next session Harper cites it unprompted
- [ ] Oracle in a new session references a shared observation previously written by Harper (proves `is_shared=true` cross-agent broadcast)
- [ ] `POST /api/memory/save` + `GET /api/memory/list` return expected shapes and reject unauth requests
- [ ] `cao-memory-flush.ts` writes land in `agent_context_bank`, not the phantom table
- [ ] With `ENABLE_MEMORY_SUMMARIZER=true`, after one hour of conversation the table has new `memory_type=observation` rows tagged with the summarizer
- [ ] `GET /api/me` returns real `{ userId, email, traderName }` on both desktop and mobile
- [ ] Changelog entries added

## Validation Commands

```bash
cd backend-hono
bun run build

launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

curl -s http://localhost:8080/api/me -H "Authorization: Bearer <jwt>"

# Harper identity smoke
curl -s -X POST http://localhost:8080/api/harper/chat \
  -H "Content-Type: application/json" -H "Authorization: Bearer <jwt>" \
  -d '{"message":"what is my name?"}' | head -c 400
```

## Commit Format

```
[v.04.17.1] feat: S23-T4 unified CAO memory bank
```
