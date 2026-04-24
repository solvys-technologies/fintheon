# Sprint Brief: T9 — Integration & E2E Wiring

## Context

T1–T8 each land independent pieces of the econ pipeline: filter table + UI (T1), visual rebuild (T2), `economic_events` base + populator (T3), source-accounts wiring (T5), keyword trigger (T6), speaker sources (T7), countdown modal (T8), plus T4's web-source quality audit. T9 is the serial Wave 3 track: glue them into one coherent flow, run the E2E path, own the final merge, then hand to the orchestrator for `/solvys-deploy`. No new features — only wire-up, the unified `/api/econ/active-watch` join endpoint, the SSE print broadcast, and end-to-end verification.

## Branch target

`s34-t9-integration-e2e` off `main`, branched AFTER T1/T3/T5/T6/T7/T8 have merged to main. If any upstream track is still open when you kick off, stop and message the orchestrator (peer `ra3mt2`) — do not start on a stale base.

## Dependencies (must be merged to main before starting)

- **T1** — `econ_watch_filters` table + `/api/econ-filters` routes + `EconFiltersManager.tsx` in RefinementEngine.
- **T3** — `economic_events` base migration + `econ-calendar-populator.ts` writing rows.
- **T5** — News-worker reading DB-driven source-accounts via `getActiveAccounts`.
- **T6** — `econ-keyword-trigger.ts` promoting raw items on "Actual/Forecast" in-window.
- **T7** — Fiscal-speaker scraper writing `economic_events` rows with `category='Fiscal'`.
- **T8** — `EconCountdownModal.tsx` polling `/api/econ/active-watch` + consuming SSE `econ-print`.

T2 (visual rebuild) and T4 (quality audit) do not block T9 but should also be merged for a clean final deploy.

### Branch state at kickoff (from orchestrator)

- Only `s34-t1` and `s34-t4` are on origin. Other tracks live on local branches only. T9 pulls local branches directly, or coordinates with orchestrator peer `ra3mt2` to push each upstream to origin first.
- **Contamination:** `s34-t5` was built on top of `s34-t7`, and `s34-t7` already has `s34-t3` merged in. Merging `s34-t7` into T9 drags T3+T5+T7 in a single commit. Expected — **do NOT separately merge `s34-t3` or `s34-t5` after** or you'll double-apply.
- Suggested merge order: `s34-t1` → `s34-t7` (brings T3+T5+T7) → `s34-t6` → `s34-t8` → `s34-t2` → `s34-t4`. Most likely conflict hot spots: `src/lib/changelog.ts` and `backend-hono/src/routes/index.ts` — resolve additively.

## Scope — Included

- [ ] **Migration placeholder recovery.** Remote-only migrations for timestamps `20260421xxxxxx → 20260423174000` were wiped from the working tree. Fresh `supabase db push` will hit `glob does not exist` until resolved. Pick ONE:
  - (A) Recreate empty placeholder SQL files matching the remote migration names in `supabase/migrations/` on the T9 branch (preferred — durable across fresh checkouts), OR
  - (B) Run `supabase migration repair --status applied <timestamp>` for each affected timestamp before `db push`.
  - List regenerated filenames in the PR body. This also unblocks T10's `20260424102000_econ_backfill_progress.sql` push.
- [ ] **Unified join endpoint** `GET /api/econ/active-watch` in `backend-hono/src/routes/econ/active-watch.ts` (new file; register in `backend-hono/src/routes/index.ts` under the existing `econ` block).
  - Joins `economic_events` (upcoming within next 24h) × `econ_watch_filters` (active only) on `country` + `category`.
  - Returns `{ id, name, country, category, scheduled_at, forecast, actual, event_key, watch_window_start, watch_window_end }[]` ordered by `scheduled_at asc`.
  - `watch_window_start = scheduled_at - 5min`, `watch_window_end = scheduled_at + 15min` (matches T6's trigger window).
  - 10s in-memory cache to absorb 30s modal poll + per-minute trigger cron.
- [ ] **SSE broadcast on print arrival.** In `backend-hono/src/services/riskflow/econ-bridge.ts` → `injectEconPrintToFeed`, after the row is persisted, call `broadcastEconPrint({ event_key, country, category, actual, forecast, scheduled_at })` from `sse-broadcaster.ts`. If T6 did not add the broadcaster helper, add it here (channel: `econ-print`). Modal (T8) subscribes to this channel — verify the wire end-to-end.
- [ ] **Trigger reads active filters.** In `econ-keyword-trigger.ts::isInActiveWatchWindow`, confirm the filter fetch reads `econ_watch_filters` via the T1 service, not a hardcoded list. If T6 shipped with a TODO placeholder, replace it with `getActiveWatchFilters()` from the T1 service. Keep a 60s filter cache to avoid hammering Supabase on every cron tick.
- [ ] **Populator respects filters.** In `econ-calendar-populator.ts`, before upserting events, filter the ForexFactory payload against `econ_watch_filters` — skip rows whose `(country, category)` combo is inactive. Keeps the table lean when TP disables a category.
- [ ] **Modal mounted in live tree.** Grep for `<EconCountdownModal` in `frontend/`; if only defined and never rendered, mount it in the Strategium root (`frontend/components/strategium/StrategiumPanel.tsx` or current equivalent) so it renders above the RiskFlow feed.
- [ ] **Integration changelog rollup.** One entry in `src/lib/changelog.ts` summarizing T9 wire-up with touched files. Top-of-file `// [claude-code 2026-04-24]` comments on every file T9 modifies.
- [ ] **E2E run.** Execute the path in Acceptance locally; capture pass/fail per step in the PR body.
- [ ] **Open the final PR** against `main`. Tag orchestrator peer `ra3mt2`. Orchestrator reviews + merges; `/solvys-deploy` runs in the orchestrator thread, not here.

## Scope — Excluded (DO NOT TOUCH)

- `EconFiltersManager.tsx` / `NotchedFuse.tsx` / `EconCountdownModal.tsx` internals — T1/T2/T8 own them. Mount only, no redesign.
- Populator scraping logic — T3 owns. Only add the filter-skip check.
- Source-accounts wiring internals — T5 owns. Verify it's live; don't refactor.
- Fuses, icon sets, Kanban borders, glass effects — `feedback_fuses_are_sacred`, `feedback_no_glass_effects` still apply.
- `/solvys-deploy` — orchestrator runs it after T9 merges. Do not run deploy or push releases from this track.
- T10 backfill orchestrator — separate background track; wiring it is not T9's job. BUT: T10's migration won't push cleanly until T9's placeholder recovery lands, so T9 unblocks T10 implicitly.

## Known issues to preserve

- `feedback_supabase_migration_filenames`: if you need a tiny migration (e.g., index on `(country, category, active)` for `econ_watch_filters`), write a 14-digit-timestamped local SQL file and hand to TP. Never `mcp__claude_ai_Supabase__apply_migration`.
- `feedback_backend_restore_to_prod`: because T9's PR triggers deploy, every endpoint T9 touches must return 200 on `fintheon.fly.dev/api/*` after deploy.
- `feedback_launchd_dist_not_src` + `feedback_launchd_backend_desktop_checkout`: local backend reads `dist/index.js` from the Desktop checkout. After `bun run build`, restart launchd; local tests only pass on the Desktop checkout if TP has synced.
- `feedback_verify_branch_before_deploy`: confirm `git branch --show-current` is `s34-t9-integration-e2e` before every build.
- `feedback_fly_always_on`: do not toggle `auto_stop_machines` or `min_machines_running`.
- `feedback_no_claude_routines`: all cron here is in-process (`node-cron` inside Fly machine) or launchd — never suggest `/schedule`.
- `feedback_no_glass_effects`, banned ornaments (no gradients, emojis, Kanban borders, AI sparkles) still apply for any template output or inline UI touch.

## Implementation steps

1. **Gate check.** `git fetch origin && git log --oneline origin/main -30`. Confirm which upstream branches exist on origin vs local-only; coordinate with orchestrator peer `ra3mt2` if any track is still open.
2. **Branch.** `git checkout main && git pull && git checkout -b s34-t9-integration-e2e`.
3. **Placeholder recovery.** Run `supabase migration list`; for each remote-only entry in `20260421xxxxxx → 20260423174000`, create an empty stub SQL file under `supabase/migrations/` with the matching timestamp+slug. Commit as `[v.04.24.9] chore: restore migration placeholders for T9 integration base`.
4. **Merge upstream in order.** `s34-t1` → `s34-t7` (brings T3+T5+T7; skip separate T3/T5 merges) → `s34-t6` → `s34-t8` → `s34-t2` → `s34-t4`. Keep changelog/routes conflicts additive.
5. **Active-watch endpoint.** Create `backend-hono/src/routes/econ/active-watch.ts` with the join query + 10s cache; register in `backend-hono/src/routes/index.ts`.
6. **Populator filter guard.** Patch `econ-calendar-populator.ts` to skip inactive `(country, category)` combos on upsert.
7. **Trigger filter read.** Patch `econ-keyword-trigger.ts` to call the T1 service for active filters; 60s cache.
8. **SSE print broadcast.** Confirm/add `broadcastEconPrint` in `sse-broadcaster.ts`; call it from `econ-bridge.ts::injectEconPrintToFeed`.
9. **Modal mount.** Grep for `<EconCountdownModal`; if not rendered anywhere, mount in Strategium root.
10. **Build + typecheck.**
    - `cd backend-hono && bun run build && cd ..`
    - `npx tsc --noEmit --project frontend/tsconfig.json`
    - `rm -rf frontend/dist && npx vite build --config frontend/vite.config.ts`
11. **Restart local backend.** `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist; launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`.
12. **Run E2E.** Execute the path in Acceptance; record results per step.
13. **Changelog + top-of-file comments.**
14. **Commit** with the format below, push, open PR, tag orchestrator peer `ra3mt2` in PR body.

## Acceptance criteria (E2E path)

- [ ] `supabase db push` from a clean checkout applies all migrations without `glob does not exist` (placeholder recovery verified).
- [ ] `curl localhost:8080/api/econ-filters | jq 'length'` → 28 (T1 seed intact).
- [ ] Disable `US → Supply Chain` via UI → `GET /api/econ/active-watch` no longer returns US supply-chain events.
- [ ] `GET /api/econ/upcoming?country=US` returns populator-written rows with `category` populated (T3).
- [ ] Seed a fake `economic_events` row 6min in the future for an active filter combo → within 30s, `EconCountdownModal` fades in at T-5min.
- [ ] Inject a raw item containing "Actual 3.1" inside an active window → T6 trigger promotes it → `injectEconPrintToFeed` broadcasts SSE `econ-print` → modal flashes + shows `Actual 3.1 vs Forecast X` in place → feed card appears in the RiskFlow panel.
- [ ] Modal fades out ~20s after print lands.
- [ ] Toggle a source-account handle in RefinementEngine → within one tier cycle, `/api/diagnostics` shows the new source feeding `news_worker.tiers.standard.items_ingested` (T5 wiring live).
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` clean.
- [ ] `bun run build` clean; `vite build` clean with no stale `dist/`.
- [ ] No glass effects, no gradients, no emojis anywhere touched.
- [ ] Changelog entry lands; top-of-file comments present on each modified file.

## Validation commands

```bash
# Gate check
git fetch origin && git log --oneline origin/main -30

# Build
cd backend-hono && bun run build && cd ..
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && npx vite build --config frontend/vite.config.ts

# Restart local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
sleep 2

# Endpoint smokes
curl -s http://localhost:8080/api/diagnostics | jq '.services'
curl -s http://localhost:8080/api/econ-filters | jq 'length'
curl -s 'http://localhost:8080/api/econ/upcoming?country=US' | jq 'length'
curl -s http://localhost:8080/api/econ/active-watch | jq '.[0]'

# SSE smoke (in another terminal)
curl -N 'http://localhost:8080/api/riskflow/sse?channel=econ-print'
```

## Commit format

```
[v.04.24.9] feat: T9 econ pipeline integration + E2E wiring
```

## Handoff to orchestrator

Once the PR passes local E2E and CI, comment on the PR with:

- Pass/fail per Acceptance bullet.
- List of regenerated migration placeholders.
- Any T1–T8 gaps discovered during wire-up (so orchestrator can loop back to the owning track if needed).
- Optional: short screen recording of the countdown modal cycle.

Orchestrator thread then merges, runs `/solvys-deploy` (Fly + Vercel desktop + Vercel mobile + DMG + .exe), and kicks T10 backfill in background. Because T9's placeholder recovery unblocks T10's migration push, T10 can run immediately after.

## Open questions

- **If T1's filter service didn't ship with `getActiveWatchFilters()`** — add it in T9 as part of the trigger wire-up rather than reopening T1. Note it in the PR body so orchestrator knows.
- **If T8's modal mounted itself already** — skip the modal-mount step. Don't double-mount.
- **If populator is still scraping all 7 countries × 4 categories** — the filter-guard step is still correct; it becomes a no-op once everything is active.
- **If `s34-t7` doesn't cleanly bring T5** (contamination may be partial) — cherry-pick missing T5 commits individually rather than re-merging `s34-t5`. Surface to orchestrator if unclear.
