# S64-ORCHESTRATION — Desk Plan & Enhanced Lockout Suite

**Version stamp:** `v.6.13.1`

**Branch:** `sprint/S64` (shared branch, all tracks commit here)

**Owner:** TP orchestrates via parallel Claude Code instances

**Previous S64 ORCH files:** None — this is the first S64 sprint

## Wave Sequence

### Wave 1 (parallel — zero file overlap verified)

T1, T2, T3, T4 run in parallel. File ownership is non-overlapping (verified against live tree). Each track's brief is self-contained.

```
@sprint-md/S64-T1-tv-pricing-desk-engine.md
```

```
@sprint-md/S64-T2-desk-plan-ui-multi-window.md
```

```
@sprint-md/S64-T3-enhanced-lockout.md
```

```
@sprint-md/S64-T4-agent-instructions-orchestration.md
```

### Wave 2 (after all 4 complete)

T5 merges all tracks, resolves interface mismatches, runs full validation, adds changelog.

```
@sprint-md/S64-T5-unification.md
```

## Track Dependency Graph

```
T1 ──────┐
T2 ──────┼────> T5 (unification)
T3 ──────┤
T4 ──────┘
```

No track depends on another. All 4 run in parallel on `sprint/S64`.

## File Ownership Map

| File                                                                    | Owner |
| ----------------------------------------------------------------------- | ----- |
| `backend-hono/src/services/day-plan/tv-bars-fetcher.ts`                 | T1    |
| `backend-hono/src/services/day-plan/price-rounding.ts`                  | T1    |
| `backend-hono/src/services/iv-scoring/instrument.ts`                    | T1    |
| `backend-hono/src/services/fiscal-sources/wh-pool-call.ts` [NEW]        | T1    |
| `backend-hono/src/services/cron/fiscal-speaker-populator.ts`            | T1    |
| `backend-hono/src/services/day-plan/window-scheduler.ts`                | T1    |
| `backend-hono/src/services/day-plan/day-plan-service.ts`                | T1    |
| `backend-hono/src/services/desk-planner.ts`                             | T1    |
| `backend-hono/src/services/brief-generator.ts`                          | T1    |
| `backend-hono/src/services/day-plan/desk-theme-generator.ts`            | T1    |
| `frontend/components/narrative/DayCard.tsx`                             | T2    |
| `frontend/components/narrative/DayPlanChevronNav.tsx` [NEW]             | T2    |
| `frontend/components/narrative/PriceRevealTag.tsx` [NEW]                | T2    |
| `frontend/components/layout/TopHeader.tsx`                              | T2    |
| `mobile/components/home/MobileDeskPlan.tsx`                             | T2    |
| `backend-hono/src/services/lockout.ts`                                  | T3    |
| `backend-hono/src/types/lockout.ts`                                     | T3    |
| `backend-hono/src/routes/lockout/index.ts`                              | T3    |
| `backend-hono/src/routes/index.ts`                                      | T3    |
| `backend-hono/migrations/042_lockout_persistence.sql` [NEW]             | T3    |
| `frontend/hooks/useLockout.ts`                                          | T3    |
| `frontend/contexts/SettingsContext.tsx`                                 | T3    |
| `frontend/components/settings/TradingTab.tsx`                           | T3    |
| `electron/main.cjs`                                                     | T3    |
| `backend-hono/src/services/ai/soul/harper.md`                           | T4    |
| `backend-hono/src/services/ai/soul/harper-extra.md`                     | T4    |
| `backend-hono/src/services/ai/agent-instructions/shared-beliefs.ts`     | T4    |
| `backend-hono/src/services/skills/evening-review-instructions.ts` [NEW] | T4    |
| `backend-hono/src/services/cron/cao-evening-review-scheduler.ts` [NEW]  | T4    |
| `backend-hono/src/routes/day-plan/handlers.ts`                          | T4    |
| `backend-hono/src/routes/day-plan/index.ts`                             | T4    |
| `frontend/components/narrative/ConsolidatedTradeLedger.tsx`             | T4    |
| `frontend/components/narrative/ArbitrumChamberPredictionCards.tsx`      | T4    |
| `backend-hono/src/services/agent-desk/agent-desk-briefing.ts`           | T4    |

## Interface Contracts (must match across tracks)

| Contract                                             | Tracks involved                | Resolution                                                                                        |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `useLockout()` return type                           | T2 (consumes), T3 (defines)    | T3 extends the hook with additive fields; T2 uses only existing `lock()`/`unlock()` — no conflict |
| `GET /api/day-plan/today` response shape             | T1 (backs), T2 (consumes)      | T1 adds `windows[]` array; T2 reads it — additive                                                 |
| `POST /api/day-plan/cao-evening-review`              | T1 (no conflict), T4 (defines) | T4's route handler imports from T1's service layer — verify signatures in T5                      |
| `lockout.ts` auto-lock call in `day-plan-service.ts` | T1 (preserves), T3 (extends)   | T1 keeps the existing 1-line call; T3 adds auto-release path — T5 wires the timer hook            |

## Unification Pass

A **dedicated unification track (T5)** handles merging, interface resolution, full validation, changelog entry, and post-ship audit. The orchestrating Claude does NOT merge — T5 is a standalone brief for a fresh instance. This avoids credential/auth issues with git operations on a mid-merge branch.

RiskFlow services and the RiskFlow feed are off-limits per sprint constraint (user specified).
