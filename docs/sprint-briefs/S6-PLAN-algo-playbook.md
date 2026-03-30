# S6 Plan: Algo Playbook Engine + Validation Suite

**Sprint:** S6 (Intelligence Layer)
**Branch:** `v.8.28.2` (from S5 `eccfff9`)
**Tracks:** 3 (T1 runs first, T2/T3 parallel after)

---

## Goal
Enrich every trade signal with statistically-derived hourly fib context from the NQStats research data, build walk-forward + Monte Carlo validation that gates autonomous execution, and surface it all in the frontend.

## Prerequisite
- S5 complete (bridge, reconciler, trade_runs table all deployed)
- `hourly-sweep-table.json` populated (done in S5 Phase 0)

## Track Summary

| Track | Scope | Files | Depends On |
|-------|-------|-------|------------|
| T1 | Algo Playbook Engine | 2 new, 2 modified | None (runs first) |
| T2 | Validation Suite | 5 new | T1 (uses playbook for enrichment) |
| T3 | Frontend Execution Dashboard | 2 new, 2 modified | T1 endpoints available |

## Execution Order
1. Window 1 → `@docs/sprint-briefs/S6-T1-algo-playbook-engine.md` → let finish
2. Windows 2, 3 → `@S6-T2`, `@S6-T3` briefs → run parallel

## Verification (post-unification)
1. `bun run dev` backend → generate proposal during hour 9 → verify fib_context in trade_runs
2. Run validation suite → verify Sharpe, Monte Carlo output
3. Frontend: reconciler widget + trade runs table render correctly
4. `bun run build` passes clean
