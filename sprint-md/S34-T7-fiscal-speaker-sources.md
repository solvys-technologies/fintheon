# Sprint Brief: T7 — Fiscal Speaker Sources (Trump / Bessent / Fed)

## Context

The econ calendar (ForexFactory + FRED hybrid, owned by T3) covers macro prints but ignores speakers. TP wants Trump schedule items, Bessent (Treasury) remarks, and Fed speeches surfaced in the same `economic_events` table so the countdown modal (T8) and trigger (T6) treat them uniformly. No new API keys — scrape via the existing Agent-Reach primitives (`fetchRss`, `scrapeUrl` in `backend-hono/src/services/agent-reach-service.ts`, already wrapped with a 10-min domain circuit breaker after 3 failures).

## Branch target

`s34-t7-fiscal-speaker-sources` off `main`.

## Dependencies

- **T3 must land first.** T7 writes to `economic_events` via `writeEconEvent` ([backend-hono/src/services/supabase-service.ts:775](backend-hono/src/services/supabase-service.ts#L775)); T3 owns the base migration that introduces `country` + `category` + `event_key`. Do NOT write to columns T3 hasn't added yet — sync with T3 branch on `event_key` column name before building the upsert.
- **T1 should land first** (28-row `econ_watch_filters` seed) so `scrapeFiscalSpeakers` can respect `(country='US', category='Speaker').active`. If T1 hasn't merged by the time T7 implements, code the filter check behind a `await getActiveFilters()` call that no-ops to "always on" when the table is missing.

## Scope — Included

- [ ] New cron service: `backend-hono/src/services/cron/fiscal-speaker-populator.ts`
  - Export `startFiscalSpeakerPopulator(): void` + `scrapeFiscalSpeakers(): Promise<{ written: number; skipped: number }>`.
  - Uses `node-cron` identical to pattern in [`backend-hono/src/services/cron/news-worker-audit-scheduler.ts`](backend-hono/src/services/cron/news-worker-audit-scheduler.ts).
  - Runs 3× daily at 06:00, 12:00, 18:00 America/New_York (Monday–Friday).
  - Calls three scraper submodules in parallel; each returns `ScrapedFiscalEvent[]`.
- [ ] Three scraper submodules under `backend-hono/src/services/fiscal-sources/`:
  - `trump-schedule.ts` — fetch `https://www.whitehouse.gov/briefing-room/statements-releases/` (RSS where available, else `scrapeUrl` on the HTML index) + Truth Social RSS mirror (`https://trumpstruth.org/feed`). Extract `name`, `date`, `time`, `detail` (URL), `venue` if inferable.
  - `bessent-speeches.ts` — fetch `https://home.treasury.gov/news/press-releases/feed` (RSS, already in the news-worker hardcoded list at [backend-hono/src/workers/news-worker/sources/index.ts:86](backend-hono/src/workers/news-worker/sources/index.ts#L86)). Filter for items whose title mentions Bessent/Treasury Secretary.
  - `fed-speeches.ts` — fetch `https://www.federalreserve.gov/newsevents/speech/speeches.htm` HTML (scrape) + FOMC calendar JSON at `https://www.federalreserve.gov/json/calendar.json` (fall back to scraping `https://www.federalreserve.gov/newsevents/calendar.htm` if the JSON endpoint isn't reachable — `exa-scheduled-monitor.ts:141` already uses the HTML page, so the domain is in the circuit breaker cache).
- [ ] Row mapping: each scraped event → `writeEconEvent({ name, date, time, country: 'US', category: 'Speaker', importance: 2, detail, event_key })`.
  - `event_key` = sha1 of `${source}::${name}::${date}::${time}` truncated to 24 chars (mirror the pattern in [`backend-hono/src/workers/news-worker/sources/agent-reach.ts:24`](backend-hono/src/workers/news-worker/sources/agent-reach.ts#L24)) for idempotent upserts.
  - `name` format: `Bessent — <venue>`, `Trump — <venue>`, `Powell — <venue>` (speaker last name, em-dash, venue short string).
- [ ] Register in `backend-hono/src/boot/services.ts` alongside T3's `econ-calendar-populator` registration.
- [ ] Filter gate: skip writes when `econ_watch_filters` has `country='US' AND category='Speaker' AND active=false`. Read via a local cached helper (30s TTL, same shape as the source-accounts cache pattern in [`backend-hono/src/services/source-accounts/source-accounts-service.ts:70`](backend-hono/src/services/source-accounts/source-accounts-service.ts#L70)).
- [ ] Diagnostics: per-source counter (`trump_schedule_events`, `bessent_speeches_events`, `fed_speeches_events`) appended to the response of [`GET /api/diagnostics`](backend-hono/src/routes/diagnostics) under a new `fiscal_speakers` block.
- [ ] Changelog entry in [`src/lib/changelog.ts`](src/lib/changelog.ts) and top-of-file `// [claude-code 2026-04-24] ...` comments on every new/modified file.

## Scope — Excluded (DO NOT TOUCH)

- `economic_events` base migration → owned by **T3**. If the columns you need (`country`, `category`, `event_key`) aren't there yet, block and ping the orchestrator. Do NOT author a parallel migration.
- `econ-calendar-populator.ts` itself → owned by **T3**. Build a sibling cron file; do not edit T3's populator.
- `econ_watch_filters` table + routes → owned by **T1**. Read-only consumer only.
- Countdown modal frontend → owned by **T8**. This track only fills the table.
- Keyword trigger / SSE broadcast on print → owned by **T6**. Speakers don't "print" actuals, so T6 integration is out of scope for T7.
- News-worker sources list at `backend-hono/src/workers/news-worker/sources/index.ts` → owned by **T5**. The Treasury + Fed RSS feeds live there today; T7 can read the same URLs but MUST NOT edit the file.
- Backfill orchestrator → owned by **T10**. Forward-looking only: today and future speaker events. No historical scrape.

## Known issues to preserve

- `feedback_orchestrator_brief_factcheck`: all table + function + URL identifiers in this brief were grep-verified against the live tree on 2026-04-24. If T3's migration renames `event_key` → something else mid-sprint, this brief's column name must be updated before T7 merges.
- `feedback_supabase_migration_filenames`: T7 writes ZERO migrations. All DDL is T3's territory.
- `feedback_fly_always_on`: new cron lives in the main `fintheon` Fly app (24/7), not the news-worker app. Register in `backend-hono/src/boot/services.ts`, not the news-worker boot.
- `feedback_no_claude_routines`: scheduling is node-cron in-process, NOT an Anthropic Routine.
- `feedback_launchd_backend_desktop_checkout`: any new route introduced here (diagnostics extension) won't hit `localhost:8080` until TP syncs the Desktop checkout. Note it in the PR description; don't fail validation on it.
- Agent-Reach circuit breaker pauses a domain for 10 min after 3 consecutive failures — structure scrapers to log + return empty on failure, never throw.
- No `mcp__claude_ai_Supabase__apply_migration` / `execute_sql` for DDL (T7 doesn't need DDL anyway; this is a reminder if scope creeps).

## Implementation steps

1. Confirm T3's `economic_events` base migration has landed (or at minimum its PR is open with the expected column set: `country`, `category`, `event_key` + existing `name`/`date`/`time`/`importance`/`actual`/`forecast`/`previous`/`impact`). If blocked, ping orchestrator via claude-peers MCP and pause.
2. Build `fiscal-sources/fed-speeches.ts` first — most structured source, best canary for the scraper contract. Start with the JSON calendar endpoint; fall back to HTML scrape if the JSON 404s.
3. Build `fiscal-sources/bessent-speeches.ts` — reuses existing Treasury RSS feed; lowest novelty.
4. Build `fiscal-sources/trump-schedule.ts` — noisiest source; be aggressive on the title filter (keep only items mentioning a venue/time or explicit scheduling language).
5. Write `fiscal-speaker-populator.ts` that fans out across the three scrapers, maps results to `writeEconEvent`, respects the filter gate.
6. Register the cron in `boot/services.ts`.
7. Extend `/api/diagnostics` with the `fiscal_speakers` counter block.
8. Type-check + bun build. Restart local backend. Smoke-test: `curl localhost:8080/api/econ/upcoming?category=Speaker&country=US` (route owned by T3; wait for T3 if missing).
9. Changelog + top-of-file comments. Commit.

## Acceptance criteria

- [ ] Running `scrapeFiscalSpeakers()` manually on weekday 10am ET returns `{ written: >=1, skipped: 0 }` on first call against an empty table, and `{ written: 0, skipped: N }` on immediate second call (idempotent via `event_key`).
- [ ] Toggling `(country='US', category='Speaker').active = false` in `econ_watch_filters` causes the next tick to early-return with zero writes (cache TTL respected within 30s).
- [ ] No direct table DDL, no migration files authored by T7.
- [ ] `GET /api/diagnostics` includes a `fiscal_speakers` block with three per-source ingested counters.
- [ ] Rows visible in `economic_events` with `country='US'`, `category='Speaker'`, well-formed `name` (e.g. `Powell — Economic Club of New York`), non-null `date`.
- [ ] Agent-Reach circuit breaker failures log as warnings, never throw.

## Validation commands

```bash
cd backend-hono && bun run build && cd ..
npx tsc --noEmit --project backend-hono/tsconfig.json

# Restart local backend (per feedback_launchd_dist_not_src)
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke — depends on T3's /api/econ/upcoming route
curl -s http://localhost:8080/api/diagnostics | jq '.fiscal_speakers'
curl -s 'http://localhost:8080/api/econ/upcoming?country=US&category=Speaker' | jq 'length'

# Manual kick (expose a debug route or run ts-node one-shot; DO NOT ship the debug route)
```

## Commit format

```
[v.04.24.7] feat: T7 fiscal speaker sources (Trump/Bessent/Fed)
```

## Open questions

- **`category` string for speakers: `Speaker` vs `Fiscal`.** The source plan (`we-need-to-not-polymorphic-star.md` WS6) says `category='Fiscal'`; T1 treats `Speaker` as an implicit fifth category in the filter table. This brief canonicalizes `category='Speaker'` so the T1 filter row and `economic_events` row key on the same string. Confirm with orchestrator before merge — if `Fiscal` wins, change the 6 occurrences in this track.
- **Truth Social RSS reliability.** `trumpstruth.org/feed` is a third-party mirror and can rate-limit. If flaky in Wave 2, scope Trump to the whitehouse.gov index only; revisit in a post-sprint follow-up.
- **FOMC JSON endpoint.** Plan assumes `federalreserve.gov/json/calendar.json` exists. If it 404s, HTML scrape is the fallback and no blocker — just log and use `calendar.htm`.
