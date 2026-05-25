# Sprint Brief: S59-T2 — Persona Unification + Self-Learning Loop Activation

## Context

All 5 agents have SOUL.md files in `backend-hono/src/services/ai/soul/` but **only Harper chat actually uses them**. Every other agent desk (Oracle, Feucht, Consul, Herald) loads system prompts from the old `agent-instructions/` system via `getAgentSystemPrompt("desk-key")`. The SOUL files also lack Fintheon/PIC/Solvys identity — agents don't know whose home they're in or who they work for. Meanwhile, two of three self-learning loops are code-complete but **never turned on**: REFLECT is gated behind `ENABLE_REFLECT=true` (not set), and GEPA is not wired into boot/services.ts at all. This track unifies personas under SOUL.md and flips the switches.

## Branch Target

`s59-hermes-native` (shared)

## Scope — Included

### Part A: SOUL Identity Restoration (all 5 agents)

- [ ] Rewrite `backend-hono/src/services/ai/soul/harper.md` — add Fintheon/PIC/Solvys identity section
- [ ] Rewrite `backend-hono/src/services/ai/soul/oracle.md` — add Fintheon/PIC/Solvys identity section
- [ ] Rewrite `backend-hono/src/services/ai/soul/feucht.md` — add Fintheon/PIC/Solvys identity section
- [ ] Rewrite `backend-hono/src/services/ai/soul/consul.md` — add Fintheon/PIC/Solvys identity section
- [ ] Rewrite `backend-hono/src/services/ai/soul/herald.md` — add Fintheon/PIC/Solvys identity section

Each SOUL.md must gain a new YAML block called `native_home` containing:

```yaml
native_home:
  platform: Fintheon
  platform_description: Agentic trading platform — Consilium workspace, Sanctum narratives, Arbitrum deliberation engine, Strategium mission control
  company: Priced In Capital (PIC)
  company_description: Agentic hedge fund — human traders + AI agents collaborating on market analysis and trade decisions
  design_system: Solvys Technologies
  design_description: Industrial-luxe visual language — Solvys Gold (#c79f4a) on warm near-black (#050402) with frosted glass surfaces, precise typography, restrained motion
  model_provider: DeepSeek
  model: DeepSeek v4 Pro (deepseek-reasoner)
  model_company: DeepSeek (independent AI lab)
```

The `grounding.source_of_truth` field must point to both `CLAUDE.md` (existing) AND add a reference to the `native_home` section. The body prose below the YAML frontmatter must include a "Home" paragraph that internalizes this identity in each agent's voice.

### Part B: Persona Pipeline Unification

- [ ] Update `backend-hono/src/services/ai/agent-instructions/index.ts` — modify `getAgentSystemPrompt()` to load from SOUL.md instead of old instruction files. Map old desk keys to agent IDs:
  - `"harper-cao"` → load SOUL `"harper"`
  - `"pma-merged"` → load SOUL `"oracle"`
  - `"futures-desk"` → load SOUL `"feucht"`
  - `"fundamentals-desk"` → load SOUL `"consul"`
  - `"herald"` → load SOUL `"herald"`
- [ ] Use `loadSoul()` + `renderSoulPrompt()` from `soul/loader.ts` in `getAgentSystemPrompt()`. Keep old instruction files as fallback but prefer SOUL.
- [ ] Update `backend-hono/src/services/strands/agents/harper.ts` — if it uses `getAgentSystemPrompt("harper-cao")`, it now gets SOUL-backed prompts automatically via the above change.
- [ ] Verify all 5 strands agents now receive SOUL-grounded system prompts (no code changes needed in oracle/feucht/consul/herald.ts if `getAgentSystemPrompt()` is the only prompt source).
- [ ] Add `native_home` injection to `renderSoulPrompt()` in `soul/loader.ts` — when rendering a SOUL prompt, include the `native_home` block as a "WHERE YOU ARE" section in the rendered prompt.

### Part C: Self-Learning Loop Activation

- [ ] **REFLECT activation**: Set `ENABLE_REFLECT=true` in `.env`. The scheduler is already wired in `boot/services.ts:410`. No code changes needed. Verify with log grep after restart.
- [ ] **GEPA activation**: Add `startGepaRunner()` call to `backend-hono/src/boot/services.ts`. Import from `gepa/runner.ts`. GEPA already runs for all 5 agents (line 20: `AGENTS = [...]`). Schedule daily at 02:00 ET (match the launchd plist timing).
- [ ] **GEPA native routing**: Remove the `fetch(sidecarBase + "/v1/gepa/optimize")` HTTP call from `gepa/runner.ts` — port the GEPA optimization logic to native TypeScript in a new `backend-hono/src/services/gepa/optimizer.ts`. The current sidecar GEPA route 404s since it was never registered in `app.py`. The new native optimizer performs shallow mutation directly (matching what `engine.py` already does — no need for deep DSPy yet).
- [ ] **Remove GEPA launchd plist**: Since GEPA now runs in-process via `boot/services.ts`, unload and delete `~/Library/LaunchAgents/io.solvys.fintheon-gepa.plist` and its symlink.
- [ ] Verify outcome resolver is running (already wired, no changes needed).

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/ai/soul/loader.ts` structure — add `native_home` rendering, don't refactor the whole loader
- `backend-hono/src/services/harper-handler.ts` Harper chat path — already uses SOUL.md correctly
- Agent instruction `.md` files (harper-extra.md, oracle-extra.md, etc.) — keep as is, they become fallback only
- Frontend UI — T3 owns all visual surfaces
- Sidecar removal — T1 owns that
- Deep DSPy/GEPA evolution mode — out of scope, shallow mutation only
- Harper autonomous loop — already gated by `HARPER_AUTONOMOUS_ENABLED`, don't touch

## Reuse Inventory (existing code to call, not reinvent)

- `loadSoul()` at `backend-hono/src/services/ai/soul/loader.ts:70` — loads and validates SOUL.md with Zod
- `renderSoulPrompt()` at `backend-hono/src/services/ai/soul/loader.ts:170` — renders SOUL → system prompt string. Add `native_home` block here.
- `getAgentSystemPrompt()` at `backend-hono/src/services/ai/agent-instructions/index.ts` — called by all 5 strands agents. Redirect to SOUL loading here.
- `startReflectScheduler()` at `backend-hono/src/services/autoresearch/reflect-scheduler.ts:17` — already in boot. Just needs `ENABLE_REFLECT=true`.
- `runGepa()` or equivalent export from `backend-hono/src/services/gepa/runner.ts` — GEPA runner. Import into boot/services.ts.
- `startOutcomeResolver()` at `backend-hono/src/services/cron/outcome-resolver.ts` — already running, no changes.
- `buildMemoryBlock()` at `backend-hono/src/services/agent-memory/memory-injector.ts:15` — already works for all AgentIds.

## Known Issues to Preserve

- SOUL.md schema validation in `loader.ts` uses Zod. Adding `native_home` requires updating the `SoulSchema` Zod schema. Keep backward compat — if `native_home` is missing, still render the prompt (just skip the section).
- Harper chat in `harper-handler.ts` has a hardcoded `HARPER_BASE_SYSTEM_PROMPT` fallback (166 lines). This is separate from SOUL.md. Don't delete it — it's the fallback when SOUL loading fails.
- GEPA runner's `runGepa()` function checks `GEPA_ENABLED=true` from the launchd plist. When moving to boot/services.ts, respect this gate. Don't run GEPA if `GEPA_ENABLED` is not set.
- REFLECT writes to ALL agents already (verified in reflect-engine.ts:434). Flipping `ENABLE_REFLECT=true` is the only change needed.
- The `native_home` identity must NOT override or conflict with each agent's existing `identity.name`, `identity.role`, `identity.self_description`. The native_home tells them where they ARE, not what they DO.

## Implementation Steps

1. **Read all 5 existing SOUL.md files** to understand each agent's current voice and structure.
2. **Add `native_home` to SOUL.md schema**. Update `SoulSchema` in `loader.ts` to include optional `native_home` block with platform/company/design_system/model_provider/model/model_company fields.
3. **Rewrite all 5 SOUL.md files** with `native_home` YAML block + "Home" paragraph in body prose. Each agent's voice must shine through the identity section — Harper speaks like a CAO, Oracle like a probabilist, Feucht like a tape reader, Consul like a surgeon, Herald like a contrarian elder.
4. **Update `renderSoulPrompt()`** to include the native_home as a "WHERE YOU ARE" section between identity and scope in the rendered prompt.
5. **Rewrite `getAgentSystemPrompt()`** in `agent-instructions/index.ts` to load from SOUL.md. Map old desk keys → agent IDs. Fall back to old instruction files if SOUL loading fails.
6. **Verify strands agents** — build and check that oracle/feucht/consul/herald/harper strands now get SOUL-grounded prompts. No code changes needed in the agent files themselves.
7. **Create `backend-hono/src/services/gepa/optimizer.ts`** — native TypeScript shallow mutation engine. Takes agent_id + samples → returns candidate SOUL body. Port the logic from `hermes-sidecar/plugins/gepa/engine.py` lines 60-80 (shallow mutation: tweak scope/handoff/voice fragments).
8. **Update `gepa/runner.ts`** — replace `fetch(sidecarBase + "/v1/gepa/optimize")` with direct call to `optimizeSoul()` from the new native optimizer.
9. **Add GEPA to boot/services.ts** — import and call `startGepaRunner()`. Gate behind `GEPA_ENABLED=true`. Schedule daily 02:00 ET.
10. **Flip REFLECT on** — set `ENABLE_REFLECT=true` in `.env` (or wherever env vars are configured for the launchd-managed backend).
11. **Remove GEPA launchd plist** — unload and delete from `~/Library/LaunchAgents/`.
12. **Build and verify** — `bun run build`, restart backend, check logs for REFLECT and GEPA startup messages.

## Acceptance Criteria

- [ ] All 5 SOUL.md files have `native_home` block with Fintheon/PIC/Solvys identity
- [ ] `getAgentSystemPrompt()` returns SOUL-grounded prompts for all desk keys
- [ ] Oracle/Feucht/Consul/Herald strands agents receive native_home identity in their system prompts
- [ ] REFLECT scheduler logs "REFLECT scheduler started — runs daily at 04:00 UTC" (not "disabled")
- [ ] GEPA runner is wired in boot/services.ts and logs startup confirmation
- [ ] Native GEPA optimizer works without sidecar HTTP calls
- [ ] GEPA launchd plist removed
- [ ] Backend builds clean: `bun run build`

## Validation Commands

```bash
# TypeScript check
cd backend-hono && npx tsc --noEmit

# Backend build
cd backend-hono && bun run build

# Restart backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Check REFLECT status in logs
sleep 3 && tail -50 /tmp/fintheon-backend.log | grep -i reflect

# Check GEPA status
tail -50 /tmp/fintheon-backend.log | grep -i gepa

# Verify REFLECT is enabled (not "disabled")
curl -s http://localhost:8080/api/diagnostics | grep -i reflect

# Verify agent responses include identity awareness
curl -s http://localhost:8080/api/harper/chat -X POST -H "Content-Type: application/json" -d '{"message":"who do you work for and what is your home platform?"}' | head -c 500
```

## Commit Format

```
[v6.0.15] feat: S59-T2 unify agent personas under SOUL.md, activate REFLECT + GEPA self-learning loops
```
