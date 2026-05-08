# Sprint Brief: T2 — Differentiated Context Feeding + Legacy Kill

## Context

The DAG template (`miroshark-template.ts`) feeds every agent the same unfiltered lanes + catalysts, causing identical scores. The old MiroShark market analyst debate (`miroshark-client.ts:687`) correctly filters headlines by subject tags — this pattern must be ported into the DAG template. The legacy 5-analyst system (Alex Vane, Priya Nair, James Osei, Sophie Kwan, Marcus Webb) is being killed. "Agentic Chatroom" must be renamed to "Agentic Forum" in remaining backend refs.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] Rewrite `buildAnalystPrompt()` in `miroshark-template.ts` to query `scored_riskflow_items` filtered by agent's `subjects` array
- [ ] Rewrite `buildNarrativeContext()` to accept per-agent filtered items instead of abstract catalysts
- [ ] Port filtering logic from `miroshark-client.ts:687-756` — 12 subject-matched items + 3 high-impact cross-domain
- [ ] Update `MiroSharkParams` interface — remove `catalysts: CatalystCard[]`, add scored items fetch
- [ ] Remove legacy `MARKET_ANALYSTS` array from `miroshark-client.ts`
- [ ] Remove `fetchHeadlinesForAnalyst()` from `miroshark-client.ts` (after porting logic)
- [ ] Remove `fetchExaHeadlinesForAgent()` if only used by legacy system
- [ ] Update `arbitrum-chamber-scheduler.ts` `fetchRecentHeadlines()` to use subject-filtered pattern
- [ ] Fix "Agentic Chatroom" → "Agentic Forum" in `harper-handler.ts`
- [ ] Fix "Agentic Chatroom" → "Agentic Forum" in `docs/HARPER-SOUL.md`
- [ ] Search + fix any other "Agentic Chatroom" references

## Scope — Excluded (DO NOT TOUCH)

- `base-prompts.ts` (T1 owns)
- `agent-instructions/dossiers/` (T1 owns)
- `agent-instructions/index.ts` (T1 owns)
- `agent-memory/` (T4 owns)
- `oracle-research/` (T3 owns)
- `boot/services.ts` (T3/T4 own)
- `mobile/` files (T6/T7 own)

## Known Issues to Preserve

- Column fix `scored_riskflow_items.title → headline` was applied 2026-04-16. The DB column is `headline`, not `title`.
- `miroshark-client.ts` has both the legacy debate system AND the DAG-based deliberation. Only kill the legacy analysts; preserve the DAG execution infrastructure.
- The `ANALYST_META` in `miroshark-template.ts` (lines 60-98) defines subjects per agent. These are the filtering keys. T1 may enrich them later but they work as-is.
- `buildGovPrompt()` (government policy analyst) is conditional — only fires when geopolitical content exceeds threshold. Preserve this.
- The Exa search fallback in `fetchHeadlinesForAnalyst` is valuable. If removing from legacy, ensure the DAG template also has an Exa fallback when DB is sparse.

## Implementation Steps

1. Read `miroshark-client.ts:687-756` to understand the working filtering pattern:
   - Query `scored_riskflow_items` with 14-day cutoff, limit 200
   - Filter by `tags` array where tag starts with `subj:` and matches agent's subjects
   - Take top 12 matching + 3 high-impact cross-domain (macro_level >= 3)
   - Format as `[TIER] headline (sentiment)`
   - Fallback to Exa when < 5 relevant headlines
2. Create a shared `fetchFilteredHeadlines(subjects: string[])` function (can go in `miroshark-context.ts` or a new util)
3. Rewrite `buildAnalystPrompt()` to be async — call `fetchFilteredHeadlines(meta.subjects)` instead of `buildNarrativeContext(lanes, catalysts)`
4. Update `buildMiroSharkDAG()` — the analyst tasks in Wave 0 need to await the filtered headlines per agent
5. Remove the `CatalystCard` interface from the params (lanes can stay — they're narrative context, not headlines)
6. Remove legacy `MARKET_ANALYSTS`, `fetchHeadlinesForAnalyst()`, `fetchExaHeadlinesForAgent()` from `miroshark-client.ts`
7. Update `arbitrum-chamber-scheduler.ts` — `fetchRecentHeadlines()` should filter by Oracle's subjects since it's Oracle-specific
8. Global search + replace "Agentic Chatroom" → "Agentic Forum"
9. Verify builds pass

## Acceptance Criteria

- [ ] `buildAnalystPrompt()` queries DB with subject-tag filtering
- [ ] Each agent sees different headlines (Oracle sees macro/monetary-policy/prediction-markets/regime; Feucht sees futures/flow/vol-surface/positioning; etc.)
- [ ] 12 subject-matched + 3 high-impact cross-domain per agent
- [ ] Exa fallback when DB has < 5 relevant headlines per agent
- [ ] `MARKET_ANALYSTS` array fully removed (grep returns 0)
- [ ] `fetchHeadlinesForAnalyst` removed
- [ ] "Agentic Chatroom" found 0 times in entire codebase
- [ ] `arbitrum-chamber-scheduler.ts` uses filtered headlines for Oracle
- [ ] DAG deliberation still executes end-to-end

## Validation Commands

```bash
cd backend-hono && bun run build
grep -r "MARKET_ANALYSTS\|Alex Vane\|Priya Nair\|Marcus Webb\|Sophie Kwan\|James Osei" backend-hono/src/
grep -ri "agentic chatroom" .
# Manual: trigger /api/miroshark/deliberation and verify agents get different headline sets
```
