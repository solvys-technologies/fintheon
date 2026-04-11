# S14-T1: MiroShark Revival (CRITICAL)

## Goal

Fix MiroShark so simulations produce real analysis, not garbage 5.0 scores.

## Root Cause

`frontend/components/consilium/ConsiliumHub.tsx:417` sends `{ lanes: [], catalysts: [], ropes: [] }` — empty narrative state. The backend accepts it, runs deliberation on nothing, and produces flat 5.0 scores across all categories.

## What to Do

1. **Frontend** — populate narrativeState from NarrativeContext before calling simulate:
   - @frontend/components/consilium/ConsiliumHub.tsx — line 412-419, replace empty arrays with actual narrative data
   - @frontend/contexts/NarrativeContext.tsx — expose lanes/catalysts/ropes via a getter or selector

2. **Backend fallback** — if frontend still sends empty lanes, synthesize from DB:
   - @backend-hono/src/routes/miroshark/handlers.ts:81 — if lanes empty, pull recent scored_riskflow_items and build synthetic lanes from narrativeThreads field
   - @backend-hono/src/services/miroshark/miroshark-service.ts — validate context snapshot has VIX + headlines before running (currently runs with `vixLevel: null, riskflowHeadlines: []`)

3. **Persist deliberation results** — currently in-memory only, lost on restart:
   - @backend-hono/src/services/miroshark/miroshark-deliberation.ts — write completed deliberations to Supabase (extend `mirofish_runs` table or new `miroshark_deliberations` table). Persist forever, no TTL

## Key Context

- @backend-hono/src/services/miroshark/miroshark-deliberation.ts — 4-phase DAG pipeline (analysts -> officials -> hermes -> harper)
- @backend-hono/src/routes/miroshark/index.ts — all MiroShark routes
- @frontend/lib/services/memory.ts:57 — frontend simulate call
- Deliberation uses `activeDeliberations` Map indexed by simulationId — dies on restart
- Last successful run: April 10 at 4PM, produced meaningless output

## Verify

- Trigger simulate from Consilium
- Confirm deliberation phases run with real headlines (not empty)
- Composite IV reflects actual market conditions
- Briefing contains specific findings, not generic "heat at 5.0"
- Restart backend, confirm deliberation history survives
