# Sprint Brief: T8 — Claude Code Routines

## Context

Claude Code Routines are cloud-based autonomous agents running on Anthropic infrastructure. This track migrates 3 periodic analytical jobs from the backend to `/schedule` Routines, and sets up 5 augmentation Routines that monitor/enrich existing backend jobs. Budget: 5-15 runs/day (Pro+ research preview).

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

### MOVE to Routines (fully migrate)

- [ ] REFLECT nightly quality analysis → `/schedule` cron `0 4 * * *` UTC (1 run/day)
- [ ] Prediction Resolver (Polymarket outcomes) → `/schedule` 4x/day (4 runs/day)
- [ ] Market Impact Enricher (daily 6 PM ET) → `/schedule` cron `0 22 * * 1-5` UTC (1 run/day)

### AUGMENT with Routines (monitor/enrich existing)

- [ ] Dispatch Watchdog: 7 AM ET — verify MDB generated, trigger regen if failed (1 run/day)
- [ ] Boardroom Synthesis: 10 AM ET — digest standup takeaways (1 run/day)
- [ ] MiroShark Meta: daily — check for stale predictions, agent convergence (1 run/day)
- [ ] Poly/Kalshi Divergence Analysis: 2x/day — deep analysis on persistent divergences (2 runs/day)
- [ ] ArbitrumChamber Deep Outlook: 2x/day — full Context Bank + calibration preview (2 runs/day)

### Backend coordination

- [ ] Add `REFLECT_VIA_ROUTINE=true` env flag to disable backend REFLECT scheduler when Routine is active
- [ ] Add `PREDICTION_RESOLVER_VIA_ROUTINE=true` to disable backend resolver
- [ ] Add `MARKET_IMPACT_VIA_ROUTINE=true` to disable backend enricher

**Total: ~13 runs/day** (2 buffer within 15-run ceiling)

## Scope — Excluded (DO NOT TOUCH)

- All T1-T4 agent files
- All T6-T7 mobile/frontend files
- Real-time backend services (VIX, Scorer, Feed Poller, etc.)
- `boot/services.ts` (T3/T4 own — env flags checked at existing service start points)

## Known Issues to Preserve

- Routines are in research preview — behavior may change
- Routines run on Anthropic infrastructure, not local. They need API access to Fintheon backend (via `fintheon.fly.dev`)
- REFLECT generates reports that feed into Harper's standup (via `buildReflectContext()`). If REFLECT moves to a Routine, it must still write results to Supabase so the backend can read them.
- Prediction Resolver needs Polymarket API access. The Routine must be able to make external HTTP calls.

## Implementation Steps

1. Use `/schedule` skill to create each Routine with appropriate cron expression
2. Each Routine prompt should:
   - Describe the task clearly
   - Include the Fintheon API base URL (`https://fintheon.fly.dev`)
   - Specify which API endpoints to call
   - Define expected output format
   - Include error handling (retry once, then log failure)
3. For MOVE jobs:
   - Create the Routine
   - Add env flag to backend to disable the corresponding cron
   - Verify Routine output matches backend output
4. For AUGMENT jobs:
   - Create the Routine
   - Backend crons continue running — Routine adds monitoring/enrichment layer
5. Document all Routines in a `docs/routines.md` file for reference

## Acceptance Criteria

- [ ] All 8 Routines created via `/schedule`
- [ ] REFLECT Routine runs at 04:00 UTC and writes report to Supabase
- [ ] Prediction Resolver Routine resolves outcomes 4x/day
- [ ] Market Impact Enricher runs after market close
- [ ] Dispatch Watchdog catches missed MDB generation
- [ ] Backend env flags disable migrated cron jobs
- [ ] Total runs within 15/day budget
- [ ] `docs/routines.md` documents all Routines

## Validation Commands

```bash
# Use /schedule skill to list all created routines
# Check Supabase for REFLECT report written by Routine (not backend)
# Verify backend cron disabled when env flag set
```
