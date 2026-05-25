# Sprint Brief: S59-T1 — Sidecar Removal + Native Hermes Agent Core

## Context

The `hermes-sidecar/` directory is a Python FastAPI scaffold that has never run the real Hermes Agent runtime. `runtime.py` returns a stub string for every chat call. The entire sidecar is gated off via `HERMES_SIDECAR_ENABLED=false`. It deploys to a Fly.io app (`fintheon-hermes`) that was never used. Fintheon Desktop runs locally on macOS — there is no need for a cloud sidecar. This track removes the sidecar entirely and ports the useful Hermes Agent architectural patterns (SOUL pipeline, context management) to native TypeScript in `backend-hono/`.

## Branch Target

`s59-hermes-native` (shared)

## Scope — Included

- [ ] Delete `hermes-sidecar/` directory entirely (Python code, venv, Dockerfile, fly.toml, launchd plists, config.yaml, entrypoint.py, ALL of it)
- [ ] Remove `~/Library/LaunchAgents/io.solvys.fintheon-hermes.plist` (and any symlinks)
- [ ] Create `backend-hono/src/services/hermes/` directory with native TypeScript Hermes Agent core
  - [ ] `backend-hono/src/services/hermes/soul-pipeline.ts` — unified SOUL loading + rendering for all agents (port from `soul/loader.ts` + `hermes-handler.ts` SOUL loading)
  - [ ] `backend-hono/src/services/hermes/context-engine.ts` — native TS lossless context management (conversation compression, memory injection, token budgeting)
  - [ ] `backend-hono/src/services/hermes/runtime.ts` — native agent runtime: take agent_id + message → load SOUL → inject memory → call DeepSeek → parse response
  - [ ] `backend-hono/src/services/hermes/types.ts` — shared types (mirror of what sidecar-contract had)
- [ ] Rewrite `backend-hono/src/services/ai/sidecar-client.ts` → `backend-hono/src/services/hermes/client.ts` — call native TS runtime instead of HTTP stub. Keep the same function signatures for drop-in compatibility with existing callers.
- [ ] Update all imports that reference `sidecar-client` to reference `hermes/client` instead
- [ ] Remove env var gates: `HERMES_SIDECAR_ENABLED`, `HERMES_SIDECAR_URL`, `INTERNAL_HERMES_JWT`
- [ ] Remove `backend-hono/src/services/hermes-handler.ts` if it's only a legacy bridge to the sidecar
- [ ] Remove `shared/sidecar-contract.ts` if it exists (or repurpose into `backend-hono/src/services/hermes/types.ts`)
- [ ] Update `backend-hono/src/boot/services.ts` — remove any `initHermesAgent()` sidecar init, replace with native Hermes init if needed
- [ ] Remove `hermes_sidecar` references from `backend-hono/.env.example`
- [ ] Kill Fly.io app `fintheon-hermes`: `fly apps destroy fintheon-hermes`
- [ ] Unload and remove hermes launchd plist if loaded

## Scope — Excluded (DO NOT TOUCH)

- SOUL.md file content changes (T2 owns persona rewrites)
- Strands agents (oracle.ts, feucht.ts, consul.ts, herald.ts) — T2 owns those
- Frontend components, Apparatus UI — T3 owns all UI
- `backend-hono/src/services/ai/soul/loader.ts` — T2 may refactor, don't delete
- `backend-hono/src/services/ai/agent-instructions/index.ts` — T2 owns the migration from old prompts to SOUL
- `backend-hono/src/services/harper-handler.ts` main Harper chat — must continue working. Don't break the SOUL loading path Harper chat uses.
- GEPA runner/pr-creator — T2 owns GEPA activation

## Reuse Inventory (existing code to call, not reinvent)

- `loadSoul()` at `backend-hono/src/services/ai/soul/loader.ts:70` — loads and validates SOUL.md via Zod. Used by Harper chat. Your soul-pipeline.ts wraps this.
- `renderSoulPrompt()` at `backend-hono/src/services/ai/soul/loader.ts:170` — renders a SOUL into a system prompt string. Reuse, don't rewrite.
- `buildMemoryBlock()` at `backend-hono/src/services/agent-memory/memory-injector.ts:15` — already builds memory blocks for any AgentId. Inject into context engine.
- `addMemory()` at `backend-hono/src/services/agent-memory/memory-store.ts:15` — CRUD for agent memories. Use for context persistence.
- `deepseekDirectModel` / `createDeepSeekDirectModel` at `backend-hono/src/services/strands/provider.ts` — DeepSeek v4 Pro provider. Your runtime calls this.
- `createAgentForTask()` at `backend-hono/src/services/strands/agent-factory.ts:143` — creates a Strands agent for DAG dispatch. Your runtime may wrap this.

## Known Issues to Preserve

- Harper chat path in `harper-handler.ts` uses Claude Code CLI bridge (`bridgeChat`) — NOT DeepSeek. This is intentional (TP's Claude Max subscription). Do NOT reroute Harper chat through DeepSeek.
- `harper-handler.ts` already loads SOUL.md via `loadSoul("harper")` + `renderSoulPrompt()`. This path must keep working.
- The `HERMES_SIDECAR_ENABLED=false` gate in `sidecar-client.ts` means every call already short-circuits. Removing the client won't break anything currently working.
- Legacy `hermes-handler.ts` may have other callers — check before deleting.

## Implementation Steps

1. **Audit sidecar callers.** Search for every import of `sidecar-client`, `hermes-handler`, `HERMES_SIDECAR_ENABLED`, `HERMES_SIDECAR_URL`. Map all call sites.
2. **Create `backend-hono/src/services/hermes/`** with 4 files: `types.ts`, `soul-pipeline.ts`, `context-engine.ts`, `runtime.ts`.
3. **soul-pipeline.ts**: wraps `loadSoul()` + `renderSoulPrompt()` from `soul/loader.ts`. Adds Fintheon-native identity injection (the "you are at Fintheon, part of PIC" context). Exports `getAgentSoul(agentId)` and `renderAgentSystemPrompt(agentId)`.
4. **context-engine.ts**: token-budgeted context builder. Takes agent_id + conversation history → compresses if needed → injects memory block from `buildMemoryBlock()` → returns prompt-ready context.
5. **runtime.ts**: main entry. `hermesChat(agentId, messages, options)` — loads SOUL → builds context → calls DeepSeek via provider → returns stream. Drop-in replacement for what sidecar-client pretended to do.
6. **Rewrite `sidecar-client.ts`** → rename to `hermes/client.ts`. Replace HTTP fetch to sidecar with direct call to `hermesChat()`. Keep same function signatures (`streamChat`, `chat`, `chatSync`) so existing callers work without changes.
7. **Update all import paths** from `sidecar-client` to `hermes/client`.
8. **Remove env var handling**: grep for `HERMES_SIDECAR`, `INTERNAL_HERMES_JWT` across backend-hono. Remove all references. Keep defaults in types with sane fallbacks (don't require any hermes-specific env vars — everything runs in-process now).
9. **Delete `hermes-sidecar/`** directory from repo root.
10. **Remove launchd plist**: `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-hermes.plist 2>/dev/null; rm -f ~/Library/LaunchAgents/io.solvys.fintheon-hermes.plist`
11. **Update `backend-hono/src/boot/services.ts`** — remove `initHermesAgent()` call, replace with native Hermes init if any startup work is needed (likely none — the runtime is stateless).
12. **Update `backend-hono/.env.example`** — remove hermes-sidecar env vars.
13. **Destroy Fly app**: `fly apps destroy fintheon-hermes` (confirm via `fly apps list` first).

## Acceptance Criteria

- [ ] `hermes-sidecar/` directory no longer exists
- [ ] `backend-hono/src/services/hermes/` exists with types, soul-pipeline, context-engine, runtime
- [ ] All previous imports of `sidecar-client` now import `hermes/client`
- [ ] `hermes/client.ts` exports same function signatures (`streamChat`, `chat`, `chatSync`) and works with existing callers
- [ ] No references to `HERMES_SIDECAR_ENABLED`, `HERMES_SIDECAR_URL`, `INTERNAL_HERMES_JWT` remain in backend-hono
- [ ] `backend-hono` builds clean: `bun run build`
- [ ] Harper chat still works (no regression)
- [ ] `fintheon-hermes` Fly.io app destroyed

## Validation Commands

```bash
# Verify sidecar is gone
test ! -d hermes-sidecar && echo "Sidecar removed"

# TypeScript check
cd backend-hono && npx tsc --noEmit

# Backend build
cd backend-hono && bun run build

# Verify no stale imports
grep -r "sidecar-client\|HERMES_SIDECAR" backend-hono/src/ && echo "FAIL: stale refs remain" || echo "OK: clean"

# Restart backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke test
curl -s http://localhost:8080/api/diagnostics | head -c 200
curl -s http://localhost:8080/api/harper/chat -X POST -H "Content-Type: application/json" -d '{"message":"hello"}' | head -c 200
```

## Commit Format

```
[v6.0.15] feat: S59-T1 remove Python Hermes sidecar, port to native TypeScript runtime
```
