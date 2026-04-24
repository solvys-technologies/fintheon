# Sprint Brief: T7 — Fiscal Speaker Sources (Trump / Bessent / Fed) (WS6)

## Context

TP wants speaker events — Trump (White House roll call), Scott Bessent (Treasury speeches), and Fed speakers — to populate the same `economic_events` table as regular econ prints so they flow through the same countdown modal (T8) and keyword trigger (T6). No new tables. Category = `'Fiscal'`, country = `'US'`.

## Branch target

`s34-t7-fiscal-speaker-sources` off `main`. Wave 2 — depends on T3 having written the `economic_events` base migration.

## Scope — Included

- [ ] New service: `backend-hono/src/services/cron/fiscal-speaker-scraper.ts` using node-cron (pattern: `econ-calendar-populator.ts` from T3).
  - Schedule: 06:00, 12:00, 18:00 America/New_York.
  - Three collectors in parallel (`Promise.allSettled`); per-source failure isolated:
    - `collectWhiteHouseSchedule()` — scrape `https://www.whitehouse.gov/briefing-room/statements-releases/` + `/briefing-room/the-presidents-schedule/` via existing `browser-harness` primitive. Extract events containing "Trump", "President", "remarks", "address", "statement" with date + time.
    - `collectTreasurySpeeches()` — scrape `https://home.treasury.gov/news/press-releases` filtering for `secretary-bessent` URL slug. Extract scheduled speeches.
    - `collectFedSpeeches()` — scrape `https://www.federalreserve.gov/newsevents/speech/speeches.htm` + pull `FOMC meeting calendar` JSON from `https://www.federalreserve.gov/json/calendar-events.json` if available; fall back to HTML parse.
  - Upsert to `economic_events` via existing `writeEconEvent` with:
    - `name` = e.g. `'Bessent — Brookings Speech'` or `'Powell — FOMC Press Conf'`.
    - `country='US'`, `category='Fiscal'`.
    - `impact='high'` for FOMC / Trump addresses; `'medium'` for Bessent/Fed-member speeches.
    - `event_key` = stable hash per T3's convention.
    - `detail` = source URL + venue (2-line max).
- [ ] Register scheduler in `backend-hono/src/boot/services.ts` near T3's populator registration.
- [ ] Extend `categorizeEvent` from T3 if needed to map speaker name patterns → `'Fiscal'`. Coordinate with T3 owner via PR description — do NOT silently overwrite T3's logic.
- [ ] Add a one-off immediate-run trigger route `POST /api/econ/refresh-speakers` (auth-gated like other admin endpoints). Used for smoke testing + ad-hoc refresh when news breaks.
- [ ] Changelog + top-of-file comments.

## Scope — Excluded (DO NOT TOUCH)

- `economic_events` base migration → T3 owns. You write to the table; you do NOT alter its shape.
- `econ-calendar-populator.ts` (ForexFactory/FRED path) → T3 owns.
- Keyword trigger → T6 owns.
- Countdown modal → T8 owns.
- Do NOT add any new scraper library / headless browser framework — reuse `backend-hono/src/services/browser/` primitives.
- `econ_watch_filters` table → T1 owns.

## Known issues to preserve

- `feedback_fact_check_worker_briefs`: verify the White House / Treasury / Fed URLs above currently render the sections you expect. If a URL 404s or the DOM shifted, flag it in the PR and fall back to the RSS equivalent rather than hallucinating a selector.
- `feedback_no_claude_routines`: node-cron only. No /schedule.
- Browser-harness has quota ledger (`browser_quota_ledger` table) — respect per-domain daily caps; these three domains should be well under cap at 3 runs/day.
- Trump events via Truth Social: the Truth Social RSS mirror is documented elsewhere in the codebase; grep for it first. Do NOT hard-code an auth key.

## Implementation steps

1. Grep existing browser-harness usage for scraping pattern + quota-check call shape.
2. Write three collector helpers, each returning `EconEventRecord[]`.
3. Write the orchestrator that fans out, de-duplicates by `event_key`, upserts.
4. Add the admin refresh route.
5. Register in `boot/services.ts`.
6. Build, restart, trigger `/api/econ/refresh-speakers` once, inspect `economic_events` rows.
7. Changelog + comments + commit.

## Acceptance criteria

- [ ] `POST /api/econ/refresh-speakers` writes ≥3 rows across the three sources for the upcoming week (Trump/Bessent/Fed combined).
- [ ] Each written row has `country='US'`, `category='Fiscal'`, non-null `event_key` (idempotent on repeat runs — no duplicate inserts).
- [ ] Re-running `/api/econ/refresh-speakers` produces 0 new rows when nothing changed.
- [ ] `GET /api/econ/upcoming?category=Fiscal&country=US` (T3 route) includes the new speaker rows.
- [ ] Browser-harness quota ledger shows the three domains at <= 3 daily fetches.

## Validation commands

```bash
cd backend-hono && bun run build && cd ..
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
curl -sX POST -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8080/api/econ/refresh-speakers | jq '.'
curl -s "http://localhost:8080/api/econ/upcoming?category=Fiscal&country=US" | jq 'length'
```

## Commit format

```
[v.04.24.7] feat: T7 fiscal speaker scrapers (Trump/Bessent/Fed)
```
