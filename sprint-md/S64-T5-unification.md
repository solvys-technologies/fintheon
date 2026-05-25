# Sprint Brief: T5 — Unification & Validation

## Context

Four parallel tracks (T1–T4) are running on the shared branch `sprint/S64`. This track merges all changes, resolves any interface mismatches between tracks, runs the full validation suite, adds the changelog entry, runs `/install-maintenance`, and stages the deploy. T5 runs LAST after all four work tracks have committed their changes.

## Branch Target

`sprint/S64`

## Scope — Included

- [ ] Merge T1 (tv-pricing-desk-engine) changes — verify day-plan-service.ts exports match T4's route handler imports
- [ ] Merge T2 (desk-plan-ui-multi-window) changes — verify DayCard uses the correct API response shape from T1
- [ ] Merge T3 (enhanced-lockout) changes — verify useLockout.ts interface matches what T2's button calls
- [ ] Merge T4 (agent-instructions-orchestration) changes — verify route handler imports from T1 services
- [ ] Resolve any merge conflicts between tracks (shared branch means git merges needed)
- [ ] Verify `lockout.ts` auto-release integration with `day-plan-service.ts` (T1 + T3 handoff)
- [ ] Verify DayCard imports from `useLockout.ts` match T3's exported interface
- [ ] `src/lib/changelog.ts` — add changelog entry for S64 sprint
- [ ] Full validation: `bun run build` backend, `rm -rf dist && npx vite build` frontend, `tsc --noEmit` both
- [ ] Add comment header to substantially modified files per CLAUDE.md protocol
- [ ] Run `/install-maintenance` to audit for env var drift and dependency sync

## Scope — Excluded (DO NOT TOUCH)

- Any RiskFlow files — off-limits per sprint constraint
- Any new feature work beyond what T1–T4 shipped

## Reuse Inventory (existing code to call, not reinvent)

- `src/lib/changelog.ts` — add entry per existing format
- `backend-hono/package.json` — check for any new dependencies added by tracks

## Implementation Steps

1. **Resolve T1 ↔ T4 interface**: T1 exports `generateDayPlan()` and `getTvBars()` from day-plan-service. T4's `handlePostCaoEveningReview()` imports these. Verify function signatures match. If not, fix T1's export or T4's import — whichever needs the smaller change.

2. **Resolve T2 ↔ T3 interface**: T2's DayCard calls `useLockout()` hook. T3 adds new fields to the hook's return (`autoReleaseAt`, `scheduleLock()`). Verify T2 doesn't break from the new fields (they're additive, so it shouldn't). If T2 calls T3's new methods, verify the method signatures match.

3. **Resolve T1 ↔ T3 handoff**: T1's `day-plan-service.ts` preserves `setLockout("default", true, 30 * 60 * 1000)`. T3 adds auto-release scheduling. Verify both coexist — T3 should also hook into day-plan generation to set the auto-release timer for the nearest window. If T3's changes need to be called from T1's code path, wire it here.

4. **Run full validation suite**:

   ```bash
   cd backend-hono && bun run build && cd ..
   npx tsc --noEmit --project frontend/tsconfig.json
   rm -rf dist && npx vite build
   ```

5. **Add changelog entry** to `src/lib/changelog.ts`:

   ```typescript
   {
     date: "2026-05-13T15:00:00-04:00",
     agent: "claude-code",
     summary: "S64: Desk Plan overhaul + enhanced lockout suite. T1: TV scanner pricing, WH Pool Call scraper, window scheduler expansion for speeches/summits/cross-border macro. T2: Multi-window DayCard chevron nav, lockout button on streak row, price gating 15min pre-window. T3: Persistent Supabase lockout, auto-release timer, OS notification ('touch grass, kid.'), lockout audit log. T4: CAO 5PM evening review cron, agent pricing literacy beliefs, Trade Ledger MEGACAP/confidence scoring, per-instrument heat correlation.",
     files: [
       "sprint-md/S64-T1-tv-pricing-desk-engine.md",
       "sprint-md/S64-T2-desk-plan-ui-multi-window.md",
       "sprint-md/S64-T3-enhanced-lockout.md",
       "sprint-md/S64-T4-agent-instructions-orchestration.md",
       "sprint-md/S64-T5-unification.md",
       // + all modified source files from each track
     ],
   },
   ```

6. **Add file header comments** to substantially modified files per CLAUDE.md: `// [claude-code 2026-05-13] S64: {short description}`

7. **Run `/install-maintenance`** to audit setup/update scripts for env var drift.

## Acceptance Criteria

- [ ] All 4 tracks' changes compile together without errors
- [ ] Frontend builds clean (`rm -rf dist && npx vite build`)
- [ ] Backend builds clean (`bun run build`)
- [ ] Interfaces match across tracks (no type errors from mismatched imports)
- [ ] Changelog entry added
- [ ] File header comments added
- [ ] `/install-maintenance` completes without new env var drift

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Frontend type-check
cd .. && npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Install maintenance
# /install-maintenance
```

## Commit Format

```
[v.6.13.1] chore: S64 unification — merge T1-T4 + changelog
```
