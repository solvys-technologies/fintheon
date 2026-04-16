# Sprint Brief: T4 — Agent Memory + Outcome Tracking + Learning Loop

## Context

Fintheon has isolated feedback mechanisms (REFLECT, Outcome Tracker, Thought Bank, Calibration) but NO integrated self-learning loop. Deliberation predictions are never tracked against actual outcomes. Agents don't accumulate context across sessions. This track builds the closed feedback loop: per-agent persistent memory in Supabase, auto-tracking of deliberation accuracy at 24/48/72h, and accuracy feedback injected into the next deliberation prompt.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] New `supabase/migrations/20260416_agent_memory.sql` — `agent_memory` table
- [ ] New `supabase/migrations/20260416_deliberation_outcomes.sql` — `deliberation_outcomes` table
- [ ] New `backend-hono/src/services/agent-memory/memory-store.ts` — CRUD for per-agent memories
- [ ] New `backend-hono/src/services/agent-memory/memory-injector.ts` — builds memory context block for prompts
- [ ] New `backend-hono/src/services/agent-memory/outcome-tracker.ts` — auto-resolves deliberation predictions vs actual
- [ ] New `backend-hono/src/services/agent-memory/feedback-composer.ts` — "last time you predicted X, actual was Y"
- [ ] New `backend-hono/src/services/agent-memory/types.ts` — interfaces
- [ ] New `backend-hono/src/services/cron/outcome-resolver.ts` — cron job checks 24/48/72h outcomes
- [ ] Update `backend-hono/src/boot/services.ts` — add outcome resolver cron
- [ ] Update `backend-hono/src/services/autoresearch/reflect-engine.ts` — write REFLECT findings to agent memory (all agents)
- [ ] Wire memory injector into DAG template prompt composition (coordinate with T1/T2 output)

## Scope — Excluded (DO NOT TOUCH)

- `base-prompts.ts`, `agent-instructions/dossiers/` (T1 owns)
- `miroshark-template.ts`, `miroshark-client.ts` (T2 owns)
- `oracle-research/` (T3 owns)
- `mobile/` files (T6/T7 own)

## Known Issues to Preserve

- Existing `outcome-tracker.ts` (root services) is JSONL-backed and manual. This track replaces it with DB-backed auto-tracker. The old file can be deprecated but not deleted until T10 integration verifies the new system works.
- Existing `thought-bank-store.ts` provides cross-agent awareness (48h TTL). Agent memory is complementary — thought bank is ephemeral awareness, agent memory is persistent learning. Don't replace thought bank.
- The `miroshark_deliberations` table already stores deliberation results (iv_score, regime, category_scores). Outcome tracker reads FROM this table, doesn't duplicate it.
- VIX data for outcome comparison comes from `vix-service.ts` (60s polling, in-memory).
- `boot/services.ts` is also modified by T3 (Oracle research). T3 adds before this track runs, so just append after.

## Implementation Steps

1. Create `agent_memory` table:
   ```sql
   CREATE TABLE agent_memory (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     agent_id VARCHAR(50) NOT NULL, -- 'oracle', 'feucht', 'consul', 'herald'
     memory_type VARCHAR(50) NOT NULL, -- 'deliberation_output', 'accuracy_feedback', 'reflect_finding', 'learned_pattern'
     content TEXT NOT NULL,
     metadata JSONB DEFAULT '{}',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     expires_at TIMESTAMPTZ -- NULL = permanent
   );
   CREATE INDEX idx_agent_memory_agent ON agent_memory(agent_id, memory_type);
   CREATE INDEX idx_agent_memory_created ON agent_memory(created_at DESC);
   ```
2. Create `deliberation_outcomes` table:
   ```sql
   CREATE TABLE deliberation_outcomes (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     deliberation_id UUID REFERENCES miroshark_deliberations(id),
     agent_id VARCHAR(50) NOT NULL,
     predicted_iv_score DECIMAL(4,2),
     predicted_regime_shift DECIMAL(3,2),
     predicted_category_scores JSONB,
     actual_vix_24h DECIMAL(5,2),
     actual_vix_48h DECIMAL(5,2),
     actual_vix_72h DECIMAL(5,2),
     direction_correct_24h BOOLEAN,
     direction_correct_48h BOOLEAN,
     direction_correct_72h BOOLEAN,
     magnitude_error_24h DECIMAL(5,2),
     resolved_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
3. Build `memory-store.ts` — simple CRUD: `addMemory()`, `getMemories(agentId, type, limit)`, `pruneExpired()`
4. Build `memory-injector.ts` — `buildMemoryBlock(agentId)`: returns formatted string with last 3 deliberation outputs + accuracy feedback for prompt injection
5. Build `outcome-tracker.ts` — `captureDeliberation(deliberationId)`: reads agent assessments from `miroshark_deliberations`, stores predictions in `deliberation_outcomes`
6. Build `feedback-composer.ts` — `composeFeedback(agentId)`: queries resolved outcomes, formats as "Your last 3 predictions: [date] predicted IV 6.2, actual VIX moved +1.3 (direction correct, magnitude overshot by 40%)"
7. Build `cron/outcome-resolver.ts`:
   - Runs every 2 hours
   - Finds unresolved `deliberation_outcomes` where created_at > 24h ago
   - Fetches actual VIX values at 24/48/72h marks
   - Computes direction correctness and magnitude error
   - Updates rows with actuals
   - Writes accuracy feedback to `agent_memory`
8. Update `reflect-engine.ts` — after generating nightly REFLECT report, write key findings to `agent_memory` for ALL agents (not just Harper)
9. Wire `memory-injector.ts` into the DAG template's prompt composition — agents see their recent memory block before each deliberation

## Acceptance Criteria

- [ ] `agent_memory` table exists with per-agent rows
- [ ] Deliberation predictions captured in `deliberation_outcomes` automatically
- [ ] Outcome resolver checks 24/48/72h VIX against predictions
- [ ] Accuracy feedback written back to `agent_memory`
- [ ] Agent prompts include last 3 deliberation outputs + accuracy
- [ ] REFLECT findings distributed to all agents, not just Harper
- [ ] Existing `thought-bank-store.ts` untouched (complementary, not replaced)
- [ ] All new files under 300 lines

## Validation Commands

```bash
cd backend-hono && bun run build
# Manual: trigger deliberation → check deliberation_outcomes has rows → wait 24h or mock time → verify resolver fills actuals → trigger another deliberation → verify memory block in prompt
```
