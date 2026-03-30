# S5 Plan: Execution Bridge + Reconciler

**Sprint:** S5 (Execution Bridge — Safety-Critical Path)
**Branch:** `v.8.28.1` (from `v.8.25.4`)
**Tracks:** 4 parallel tracks after T1

---

## Goal
Ship the live execution path from Hermes → Reconciler → ProjectX Bridge → TopStepX. After S5, the system can autonomously place orders with full safety guards (duplicate prevention, PDPT floor, hard stop, confirmation reconciliation).

## Architecture
```
Hermes Agent → Proposal (confluence ≥8) → Reconciler (TS, Hono)
  → ProjectX Service (TS, HTTP client) → Execution Bridge (Python, FastAPI :8001)
    → project-x-py SDK → TopStepX Account
```

## Track Summary

| Track | Scope | Files | Depends On |
|-------|-------|-------|------------|
| T1 | Types + Migration + Config | 3 new, 2 modified | None (runs first) |
| T2 | Python FastAPI Bridge | 5 new | T1 (type contracts) |
| T3 | Reconciler State Machine | 1 new, 1 modified | T1 (types) |
| T4 | ProjectX Service + Route Wiring | 1 new, 4 modified | T1, T2 endpoints, T3 reconciler |

## Execution Order
1. Window 1 → `@docs/sprint-briefs/S5-T1-foundation-types-migration.md` → let finish
2. Windows 2, 3, 4 → `@S5-T2`, `@S5-T3`, `@S5-T4` briefs → run parallel

## Shared File Conflicts (resolve during unification)
- `proposal-service.ts` — T3 adds reconciler gate, T4 adds projectx broker path
- `trading-service.ts` — T4 adds projectx case
- `.env.example` — T1 adds reconciler vars, T2 adds bridge vars

## Verification (post-unification)
1. `cd execution-bridge && uvicorn main:app --port 8001` → starts
2. `curl localhost:8001/health` → `{"connected": true}`
3. `cd backend-hono && bun run dev`
4. `curl localhost:8080/api/trading/test-trade -X POST -H 'Content-Type: application/json' -d '{"accountId":"test","symbol":"MNQ","side":"buy"}'` with `PRIMARY_BROKER=projectx`
5. Verify trade_runs row in Neon
6. Fire duplicate within 30s → rejected
7. `bun run build` passes clean
