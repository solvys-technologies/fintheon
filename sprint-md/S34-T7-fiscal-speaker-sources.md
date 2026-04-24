# Sprint Brief: T7 — Fiscal Speaker Sources (Trump / Bessent / Fed)

## Context

The econ calendar (ForexFactory + FRED hybrid, owned by T3) covers macro prints but ignores speakers. TP wants Trump schedule items, Bessent (Treasury) remarks, and Fed speeches surfaced in the same `economic_events` table so the countdown modal (T8) and keyword trigger (T6) treat them uniformly. No new API keys — scrape via the existing Agent-Reach primitives (`fetchRss`, `scrapeUrl` in `backend-hono/src/services/agent-reach-service.ts`; 10-min domain circuit breaker after 3 failures).

## Branch target

`s34-t7-fiscal-speaker-sources` off `main` (merged with `s34-t3-econ-calendar-populator` to get base migration + `upsertEconEvent` + `categorizeEvent`).

## Dependencies

- **T3 merged in.** T7 uses `upsertEconEvent`, the base `economic_events` migration, and `categorizeEvent` from `backend-hono/src/services/econ-calendar-service.ts`. `category='Speaker'` already exists in T3's `EconCategory` enum.
- **T1 not required at build time.** The filter gate reads `econ_watch_filters` directly via Supabase and treats a missing table / error as "gate open" so T7 works before T1's migration is pushed.

## Scope — Included

- New cron service `backend-hono/src/services/cron/fiscal-speaker-populator.ts`:
  - Exports `startFiscalSpeakerPopulator`, `stopFiscalSpeakerPopulator`, `runFiscalSpeakerPopulator`, `getFiscalSpeakerStats`.
  - `node-cron` pattern mirrored from T3's `econ-calendar-populator.ts`.
  - Runs 3× daily at 06:00, 12:00, 18:00 America/New_York (Mon–Fri).
  - Kicks once at boot (best-effort, errors logged) so fresh backends have data.
  - Disabled by `FISCAL_SPEAKER_POPULATOR_ENABLED=false`.
- Three scrapers under `backend-hono/src/services/fiscal-sources/`:
  - `fed-speeches.ts` — JSON calendar `https://www.federalreserve.gov/json/calendar.json` with HTML fallback to `https://www.federalreserve.gov/newsevents/calendar.htm`.
  - `bessent-speeches.ts` — Treasury RSS `https://home.treasury.gov/news/press-releases/feed` filtered for Bessent / Treasury Secretary mentions.
  - `trump-schedule.ts` — White House statements-releases RSS + Truth Social mirror (`https://trumpstruth.org/feed`) with aggressive title filter (requires venue/schedule signal).
  - Each scraper returns `ScrapedFiscalEvent[]` and never throws; failures log + return empty.
- `ScrapedFiscalEvent` contract (module-local type):
  ```ts
  interface ScrapedFiscalEvent {
    speaker: "Trump" | "Bessent" | "Powell" | "Fed";
    venue: string; // short label or URL path segment
    date: string; // YYYY-MM-DD in America/New_York
    time: string; // HH:MM 24h ET
    detail: string; // source URL
    source:
      | "fed-json"
      | "fed-html"
      | "treasury-rss"
      | "whitehouse-rss"
      | "truth-rss";
  }
  ```
- Row mapping in populator → `upsertEconEvent({ name, date, time, country:'US', category:'Speaker', importance:'medium', detail, event_key })`:
  - `event_key` = sha256(`${name}|${date}|${time}|US`) — same scheme as T3 so joins/unique index stay clean.
  - `name` format: `Powell — <venue>`, `Bessent — <venue>`, `Trump — <venue>` (em-dash U+2014).
- Filter gate: direct Supabase query on `econ_watch_filters` with 30s TTL cache; skips writes when `(country='US', category='Speaker').active=false`. Missing table / query error → gate open (always on).
- Diagnostics: `/api/diagnostics` response gains `fiscal_speakers` block with last-run stats + per-source counters.
- Changelog entry in `src/lib/changelog.ts` + top-of-file `// [claude-code 2026-04-24]` comments.

## Scope — Excluded (hard)

- No new migrations. T3 owns `economic_events`; T1 owns `econ_watch_filters`.
- Do not edit `econ-calendar-populator.ts`. Sibling cron only.
- Do not edit `backend-hono/src/workers/news-worker/sources/index.ts` (T5 territory).
- No SSE broadcast on print — that's T6.
- Forward-looking only. No historical backfill (T10).

## Known issues to preserve

- `feedback_orchestrator_brief_factcheck`: identifiers grep-verified on 2026-04-24 against the merged T3 branch.
- `feedback_fly_always_on`: cron registers on main `fintheon` Fly app, node-cron in-process, 24/7.
- `feedback_no_claude_routines`: no Anthropic Routines.
- `feedback_supabase_migration_filenames`: zero migrations authored in T7.
- `feedback_launchd_backend_desktop_checkout`: local smoke may 404 until TP syncs Desktop checkout; that is not a T7 failure.
- Agent-Reach circuit breaker — 10min pause after 3 consecutive failures. Scrapers log warnings + return empty; never throw.

## Implementation steps

1. Merge T3 into T7 branch (done).
2. Build `fiscal-sources/fed-speeches.ts` (JSON first, HTML fallback).
3. Build `fiscal-sources/bessent-speeches.ts`.
4. Build `fiscal-sources/trump-schedule.ts`.
5. Write `fiscal-speaker-populator.ts`: fans out scrapers, maps to `upsertEconEvent`, filter gate, diagnostics stats holder.
6. Register in `backend-hono/src/boot/services.ts`.
7. Extend `/api/diagnostics` with `fiscal_speakers` block.
8. `cd backend-hono && bun run build`; `tsc --noEmit` clean; restart local backend; smoke.
9. Changelog + top-of-file comments. Commit.

## Acceptance criteria

- `runFiscalSpeakerPopulator()` returns `{ fetched:>=0, upserted:>=0, skippedFilter:0|N, perSource:{…} }`.
- Second immediate call idempotent: `upserted=0` via `event_key` unique index.
- Toggle `(US, Speaker).active=false` → next tick within 30s TTL returns `upserted=0, skippedFilter>0`.
- `GET /api/diagnostics` includes `fiscal_speakers.lastRun` + per-source counters.
- Rows in `economic_events` have `category='Speaker'`, `country='US'`, clean `name`, non-null `date`.
- Scrape failures logged as warnings, never thrown.

## Validation

```bash
cd backend-hono && bun run build && cd ..
npx tsc --noEmit --project backend-hono/tsconfig.json
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
curl -s http://localhost:8080/api/diagnostics | jq '.fiscal_speakers'
```

## Commit format

```
[v.04.24.7] feat: T7 fiscal speaker sources (Trump/Bessent/Fed)
```
