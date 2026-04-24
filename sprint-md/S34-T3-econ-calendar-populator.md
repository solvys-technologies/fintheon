# Sprint Brief: T3 — Econ Calendar Populator + `economic_events` Base Migration

## Context

The `economic_events` table exists in prod but has NO base migration in `supabase/migrations/` (per `feedback_trades_table_migration` memory — this will break fresh db pushes). It's also orphaned: `writeEconEvent` has zero callers post-Notion severance on 2026-04-16. TP picked a **hybrid populator**: ForexFactory for the forward calendar, FRED for US backfill. This track lays the foundation for T6 (trigger), T7 (speakers), T8 (modal), T10 (backfill).

## Branch target

`s34-t3-econ-calendar-populator` off `main`.

## Scope — Included

- [ ] Base migration: `supabase/migrations/20260424101000_economic_events_base.sql` — **local file only**, hand to TP for `supabase db push`.
  - `CREATE TABLE IF NOT EXISTS public.economic_events` with existing columns (id, name, date, time, forecast, actual, previous, detail, impact, created_at, updated_at) **plus** new columns: `country text`, `category text`, `event_key text unique`.
  - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for country/category/event_key so it's idempotent in prod.
  - Index on `(country, category, date)` for the filter join.
  - `event_key` = stable hash of `name + date + time + country` for idempotent upserts.
- [ ] Extend `backend-hono/src/types/supabase-service.ts` → update `EconEventRecord` interface (line 761-773) to include `country?: string`, `category?: string`, `event_key?: string`.
- [ ] New service: `backend-hono/src/services/cron/econ-calendar-populator.ts` using `node-cron` (pattern from `news-worker-audit-scheduler.ts`):
  - Sunday 22:00 America/New_York: fetch `https://nfs.faireconomy.media/ff_calendar_thisweek.json` (ForexFactory weekly JSON — free, no key).
  - Hourly during market hours (9–17 ET weekdays): re-fetch today's slice to catch actuals.
  - Upsert to `economic_events` keyed on `event_key`.
  - Filter to 7 subscribed countries: US, EU, UK, JP, NZ, AU, CA (hard-coded default; T9 integration will wire this to `econ_watch_filters`).
- [ ] Add `categorizeEvent(name: string): 'Fiscal' | 'Supply Chain' | 'Inflation' | 'Job Market' | 'Speaker'` in `backend-hono/src/services/econ-calendar-service.ts`:
  - Fiscal → Treasury auctions, budget, debt, Fed funds, rate decisions, FOMC, ECB/BoE/BoJ/BoC/RBA/RBNZ rate.
  - Supply Chain → ISM, PMI manufacturing, durable goods, factory orders, trade balance, inventories.
  - Inflation → CPI, PPI, PCE, HICP, import/export prices.
  - Job Market → NFP, claims, ADP, unemployment, JOLTS, ECI, wages.
  - Fallback → `Fiscal` (speaker events inherit from T7).
- [ ] New route: `backend-hono/src/routes/econ/upcoming.ts` — `GET /api/econ/upcoming?country=X&category=Y` returns next 7 days filtered.
- [ ] Wire `writeEconEvent` call path in populator; verify `econ-enricher.ts` (existing) now reads a populated table.
- [ ] Register scheduler in `backend-hono/src/boot/services.ts` next to `startEconEnricher()`.
- [ ] Changelog + top-of-file comments.

## Scope — Excluded (DO NOT TOUCH)

- `econ_watch_filters` table and routes — T1 owns.
- `econ-keyword-trigger.ts` — T6 owns.
- Fiscal speaker scrapers (Trump/Bessent/Fed) — T7 owns.
- Countdown modal frontend — T8 owns.
- Backfill orchestrator — T10 owns (same table, but writes historical; T10 respects `event_key` uniqueness).

## Known issues to preserve

- `feedback_trades_table_migration`: grep for CREATE TABLE on trades before staging any migration that would ALTER trades. THIS migration does not touch trades; just confirm your migration runs independently.
- `feedback_supabase_migration_filenames`: 14-digit timestamp, local file only, never MCP apply.
- `feedback_launchd_dist_not_src`: local backend runs dist/index.js; must rebuild + restart after changes.
- `feedback_no_claude_routines`: use in-process node-cron inside the backend, NOT Anthropic routines / /schedule.

## Implementation steps

1. Write `20260424101000_economic_events_base.sql` — CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + index + comment.
2. Update `EconEventRecord` interface.
3. Write `econ-calendar-populator.ts` — node-cron Sunday + hourly.
4. Add `categorizeEvent` helper.
5. Add `/api/econ/upcoming` route + register.
6. Register scheduler in `boot/services.ts`.
7. `cd backend-hono && bun run build`. Restart launchd backend.
8. Curl smoke.
9. Changelog + comments + commit.

## Acceptance criteria

- [ ] Migration file lints clean; CREATE IF NOT EXISTS + ALTER IF NOT EXISTS idempotent.
- [ ] After TP runs `supabase db push`, manual populator run upserts ≥50 rows for current week across 7 countries.
- [ ] `curl localhost:8080/api/econ/upcoming?country=US&category=Inflation` returns only US inflation rows sorted by date.
- [ ] `event_key` uniqueness prevents duplicate rows across re-runs.
- [ ] `backend-hono/src/services/cron/econ-enricher.ts` now sees non-empty event list (log "processed N" instead of "No events for today").

## Validation commands

```bash
cd backend-hono && bun run build && cd ..
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
# Wait a beat then:
curl -s http://localhost:8080/api/diagnostics | jq '.services'
curl -s "http://localhost:8080/api/econ/upcoming?country=US" | jq 'length'
```

## Commit format

```
[v.04.24.3] feat: T3 economic_events base + ForexFactory/FRED populator
```

## Open questions

- Forward-calendar source fallback if ForexFactory JSON 404s → retry + fall back to FRED US-only. Do NOT add a scraper here; T10 backfill handles the broader archive path.
