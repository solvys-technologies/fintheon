# Sprint Brief: T6 — Keyword "Actual/Forecast" Trigger + Event-Window Scheduler

## Context

Today's econ-print promotion relies on `ACTUAL_PATTERNS` regex in [`rettiwt-poller-econ.ts:25-29`](backend-hono/src/services/riskflow/rettiwt-poller-econ.ts#L25-L29), which requires numeric extraction and misses FinancialJuice's mixed formats. TP wants a simpler gate: if a raw item contains the word `Actual` or `Forecast` **and** it lands inside an active watch window for a subscribed (country, category) combo, promote it to `category='econ-print'`, `risk_type='Macro'`, `macro_level>=3`. Numeric extraction becomes best-effort enrichment only.

Also: once a print lands, the backend must broadcast over SSE so T8's countdown modal can flip from countdown → "Actual X vs Forecast Y" in-place.

## Branch target

`s34-t6-keyword-trigger-scheduler` off `main`.

## Dependency posture

- **T1** (`econ_watch_filters` table) — read-only consumer. If the table isn't present yet at build time, fall back to an "all subscribed" implicit filter (7 countries × 4 categories treated as active) so this track compiles and runs standalone.
- **T3** (`economic_events` base migration) — read-only consumer for the watch-window check. Fall back to empty active-events list when the table is empty or absent; the trigger becomes a no-op, not an error.
- **T8** (countdown modal) — consumer of the new `broadcastEconPrint` SSE event. T8 will subscribe; T6 only needs to emit.

Do NOT block on T1/T3 merging first. Tolerate their absence gracefully; post-merge the brief becomes fully wired.

## Scope — Included

- [ ] **New service** `backend-hono/src/services/riskflow/econ-keyword-trigger.ts`:
  - `containsEconPrintKeyword(text: string): boolean` — matches `/\b(actual|forecast)\b/i`.
  - `isInActiveWatchWindow(timestamp: Date, activeEvents: EconEvent[], filters: EconWatchFilter[]): { event: EconEvent; category: string } | null` — returns the first event within `−5min` to `+15min` whose `(country, category)` pair has `active=true` in filters. Reuses `PRE_EVENT_MINUTES=5` / `POST_EVENT_MINUTES=15` constants already in `rettiwt-poller-econ.ts:12-13` — import, don't duplicate.
  - `promoteToFeed(rawItemId: string, matchContext: { event; category; keyword }): Promise<void>` — updates the `raw_riskflow_items` row with `category='econ-print'`, `risk_type='Macro'`, `macro_level=4`, then invokes the existing central-scorer pipeline so the item flows to `scored_riskflow_items` like any other promotion. Idempotent — skip if already `category='econ-print'`.
  - Exposes `runEconKeywordSweep(): Promise<{ scanned: number; promoted: number }>` for the cron tick + diagnostics.

- [ ] **New cron scheduler** `backend-hono/src/services/cron/econ-keyword-scheduler.ts`:
  - Reuse the shape of [`news-worker-audit-scheduler.ts`](backend-hono/src/services/cron/news-worker-audit-scheduler.ts) — `start…`/`stop…`/`isActive` triplet, env-flag gate (`ECON_KEYWORD_TRIGGER_ENABLED`, default on), `timezone: "America/New_York"`.
  - Single job: `* * * * *` (every minute). Tick calls `runEconKeywordSweep` and logs `{ scanned, promoted }`. Swallow errors per the audit-scheduler pattern so one bad tick doesn't kill the cron.
  - Register in `backend-hono/src/boot/services.ts` alongside `startNewsWorkerAuditScheduler()` around line 266.

- [ ] **Modify** `backend-hono/src/services/riskflow/rettiwt-poller-econ.ts`:
  - `processActualsFromTweets` stays, but replaces the **gate** at the top: first check `containsEconPrintKeyword(tweet.text)`; if true AND `isInActiveWatchWindow` returns a match, call `promoteToFeed` immediately. Numeric `extractActualFromText` still runs as best-effort enrichment downstream so the feed card can still show "3.1 vs 3.0" when present, but its absence no longer blocks promotion.
  - Do NOT delete `extractActualFromText`, `matchTweetToEvent`, or `ACTUAL_PATTERNS` — they remain the enrichment path.

- [ ] **SSE broadcast hook** — add `broadcastEconPrint(print: { rawItemId: string; event: EconEvent; category: string; actual?: number; forecast?: number })` to `backend-hono/src/services/riskflow/sse-broadcaster.ts` alongside `broadcastLevel4`. Call it from `injectEconPrintToFeed` in [`econ-bridge.ts`](backend-hono/src/services/riskflow/econ-bridge.ts) right after the item successfully injects.

- [ ] **Diagnostics** — extend `/api/diagnostics` response shape (or the nearest existing riskflow-diagnostics block) with `econ_keyword_trigger: { enabled, lastTick, lastScanned, lastPromoted, errors }`. If there's no clean slot, add a dedicated `GET /api/econ/trigger-status` route under a new `backend-hono/src/routes/econ-trigger/` folder matching the repo's route-handler split (`index.ts` + `handlers.ts`).

- [ ] Changelog entry in `src/lib/changelog.ts` and top-of-file `// [claude-code 2026-04-24] …` comments on every modified file.

## Scope — Excluded (DO NOT TOUCH)

- `econ_watch_filters` schema or UI → owned by **T1**. Read from the table only.
- `economic_events` base migration, populator, `categorizeEvent` heuristic → owned by **T3** (and T7 for speakers). Read from `economic_events` only.
- `rettiwt-poller-econ.ts`'s burst primitives (`activeBursts`, `BURST_INTERVAL_MS`, `BURST_DURATION_MS`) — leave intact.
- Countdown modal / frontend SSE subscriber → owned by **T8**. You only emit; T8 consumes.
- Source-accounts → news-worker wiring → owned by **T5**.

## Known issues to preserve

- `feedback_no_claude_routines`: this is a `node-cron` in-process scheduler, NOT an Anthropic Routine. Do not suggest `/schedule`.
- `feedback_supabase_migration_filenames`: this track writes **no migrations**. All schema access is read-only against tables T1/T3 own.
- `feedback_backend_restore_to_prod`: after deploy, verify `fintheon.fly.dev/api/diagnostics` (or the new `/api/econ/trigger-status`) shows the scheduler active. If fly serves HTML or 404, redeploy from `backend-hono/` before declaring done.
- `feedback_launchd_backend_desktop_checkout`: new routes return 404 on localhost until TP syncs Desktop. Smoke-test the build artifact against the Fly deploy, not just localhost.
- The existing `numeric-first` path in `rettiwt-poller-econ.ts` is NOT redundant — TP wants keyword-first **gating** with numeric extraction as **enrichment**. Don't delete either.

## Implementation steps

1. Read `rettiwt-poller-econ.ts` end-to-end (≈ lines 1–220) to understand the current actual-extraction flow and the burst-scheduler around it.
2. Read `sse-broadcaster.ts` end-to-end (short file) so `broadcastEconPrint` matches the existing emit shape.
3. Build `econ-keyword-trigger.ts` with the three helpers + `runEconKeywordSweep`. Type the filter / event inputs against the existing `EconEvent` export and a new `EconWatchFilter` type (import from T1's type file if present; otherwise declare a local `type EconWatchFilter = { country: string; category: string; active: boolean }` and add a TODO to switch once T1 merges).
4. Build `econ-keyword-scheduler.ts` cloning the audit-scheduler shape; register in `boot/services.ts`.
5. Patch `rettiwt-poller-econ.ts:processActualsFromTweets` top-gate to be keyword-first → window-check → `promoteToFeed`; preserve numeric extraction as downstream enrichment.
6. Add `broadcastEconPrint` to `sse-broadcaster.ts`; call it from `econ-bridge.ts:injectEconPrintToFeed` on success.
7. Wire diagnostics (existing block or new `/api/econ/trigger-status` route).
8. `cd backend-hono && bun run build` clean. Changelog + top-of-file comments. Commit.

## Acceptance criteria

- [ ] `curl localhost:8080/api/diagnostics` (or `/api/econ/trigger-status`) shows `econ_keyword_trigger.enabled=true` and a `lastTick` within the last 60s.
- [ ] With a seeded fake `economic_events` row `T+2min` in the future and an active matching filter, a raw item containing the word `Actual` inserted at `T+1min` gets promoted to `category='econ-print'`, `risk_type='Macro'`, `macro_level>=3` within one cron tick.
- [ ] A raw item containing `Actual` but outside any active watch window is NOT promoted (scheduler scans it, `promoted=0`).
- [ ] `broadcastEconPrint` fires once per successful `injectEconPrintToFeed` and is visible on an SSE client connected to the existing channel.
- [ ] Absence of `econ_watch_filters` or `economic_events` tables degrades gracefully — scheduler ticks, `scanned=0`, `promoted=0`, no error log. No crash loops.
- [ ] `bun run build` clean. No `tsc` errors. Env flag `ECON_KEYWORD_TRIGGER_ENABLED=false` cleanly disables the scheduler.

## Validation commands

```bash
# Backend build
cd backend-hono && bun run build && cd ..

# Restart local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke — scheduler ticking
curl -s http://localhost:8080/api/diagnostics | jq '.econ_keyword_trigger // .services'
# or
curl -s http://localhost:8080/api/econ/trigger-status | jq

# SSE smoke (watch broadcasts)
curl -N http://localhost:8080/api/riskflow/stream | head -20
```

## Commit format

```
[v.04.24.6] feat: T6 econ keyword trigger + event-window scheduler
```

## Open questions

- **Scoring hook:** should `promoteToFeed` re-run the full central-scorer or shortcut to write to `scored_riskflow_items` directly? Recommendation: **re-run central-scorer** so VIX/IV weighting, headline-tagger, and content-guard all apply consistently. The scorer already handles `macro_level` bumps.
- **Window bounds:** `−5min` / `+15min` comes from the existing `PRE_EVENT_MINUTES` / `POST_EVENT_MINUTES`. If T3's populator fills events with explicit `window_start`/`window_end` columns, prefer those. If not, use the constants. Flag this in the orchestrator thread before merge.
