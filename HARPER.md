# HARPER Handoff — Continue As-Is (No Fixups)

## Intent
This branch is an **as-is unification commit** for approved tracks only.
Do **not** apply bug fixes in this commit/thread; preserve known quirks for follow-up.

## Branch / Commit Intent
- Branch target: `v.04.02.0`
- Commit style: **single commit only**
- Push target: `origin/v.04.02.0`

## Original Unification Prompt (to continue from)
Create one integration branch, stage only approved track files, run lightweight validation, and ship one commit without debugging/fixing known issues.

### Scope to include (only this scope)

#### Track A: 24/7 polling + feed cache + Exa monitor
- `backend-hono/src/services/riskflow/polling-config.ts`
- `backend-hono/src/services/riskflow/feed-poller.ts`
- `backend-hono/src/services/twitter-cli/econ-triggered-poller.ts`
- `backend-hono/src/services/riskflow/feed-service.ts`
- `backend-hono/src/services/riskflow/exa-scheduled-monitor.ts`
- `backend-hono/src/routes/riskflow/handlers.ts`
- `backend-hono/src/boot/services.ts`

#### Track B: Boot/env validation
- `backend-hono/src/boot/index.ts`
- `backend-hono/src/boot/services.ts`
- `backend-hono/src/index.ts`
- `backend-hono/.env.template`
- `backend-hono/src/boot/__tests__/validateEnv.test.ts`
- `.github/workflows/ci.yml`

#### Track C: IV/SSE scoring fixes
- `backend-hono/src/services/market-data/point-estimator.ts`
- `backend-hono/src/services/market-data/iv-score-ticker.ts`
- `backend-hono/src/services/market-data/iv-scorer.ts`
- `backend-hono/src/routes/market-data/handlers.ts`
- `backend-hono/src/routes/market-data/index.ts`
- `frontend/components/layout/TopHeader.tsx`
- `frontend/components/layout/FloatingWidget.tsx`
- `frontend/components/IVScoreCard.tsx`
- `frontend/types/market-data.ts`
- `frontend/types/api.ts`
- `frontend/lib/services.ts`
- `frontend/contexts/RiskFlowContext.tsx` (if modified in this track, keep as-is)

### Explicit excludes
- `backend-hono/.env`
- `.claude/settings.local.json`
- `Video Footage/`
- `backend-hono/logs/`
- `execution-bridge/.venv/`
- `supabase/.temp/`
- Any unrelated modified files

## Known issues to preserve as-is (do not fix in this unify commit)
1. Feed cache write-through can shrink cache to latest-cycle items.
2. Poller stop-race behavior in timeout-rescheduling paths.
3. Floating widget neutral-direction fallback glyph is incomplete when direction is null.
4. Boot error text references `backend/.env.template` instead of `backend-hono/.env.template`.
5. Debrief test path wording mismatch (`__tests__` vs `tests`).

## Additional bug found during review (also preserve in this unify commit)
- `updateFeedCache()` currently replaces warm cache with only the latest batch from poller delta updates, which can collapse in-memory feed history until re-warm.
  - Relevant paths:
    - `backend-hono/src/services/riskflow/feed-service.ts`
    - `backend-hono/src/services/riskflow/feed-poller.ts`

## Validation commands expected
- `cd backend-hono && npm run -s typecheck && npm run -s build`
- `cd ../frontend && npm run -s typecheck`

## Commit message expected
`chore(unification): merge approved polling, boot-env, and IV/SSE tracks as-is`

## Post-commit expectations
- One commit only.
- Branch pushed.
- Only scoped files (plus this `HARPER.md` handoff file) included.
- No bugfix refactors added.
