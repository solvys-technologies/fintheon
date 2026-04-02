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

---

## Follow-up Update (2026-04-02, after unification)

This follow-up pass **did apply targeted bug fixes** to resolve hard TypeScript/test breakage introduced by track overlap.

### Fixed in this pass
- Removed duplicate exports in:
  - `backend-hono/src/services/twitter-cli/fj-emoji-filter.ts`
- Removed duplicate `RiskType` declaration:
  - `backend-hono/src/types/riskflow.ts`
- Unified macro tier typing and mapping in:
  - `backend-hono/src/utils/assign-macro-level.ts`
  - accepts both legacy (`critical/high/medium/low`) and macro (`tier1/tier2/tier3/tier4/none`) tier labels
- Restored expected canonical keyword extraction in:
  - `backend-hono/src/services/headline-parser.ts`
  - includes canonical matches such as `fed rate decision`, `rate cut`, `housing starts`
- Reinstated hard Level-4 SSE gate:
  - `backend-hono/src/services/riskflow/sse-broadcaster.ts`
  - `broadcastLevel4` now no-ops unless `item.macroLevel === 4`

### Validation status from this pass
- `cd backend-hono && npm run -s typecheck` ✅
- `cd backend-hono && npm run -s build` ✅
- `cd backend-hono && node --test dist/tests/*.test.js` ✅ (7/7 pass)
- `cd frontend && npm run -s typecheck` ❌ (pre-existing unrelated errors in `App.tsx` and `contexts/TeamPresenceContext.tsx`)

### Remaining known issues (not fixed in this pass)
- Backend lifecycle expectation still pending confirmation/implementation:
  - “backend cuts on and off when the app is opened and closed”
- Frontend local typecheck currently failing due unrelated Team Presence issues:
  - duplicate `TeamPresenceProvider` identifier in `frontend/App.tsx`
  - nullability/cast issues in `frontend/contexts/TeamPresenceContext.tsx`
