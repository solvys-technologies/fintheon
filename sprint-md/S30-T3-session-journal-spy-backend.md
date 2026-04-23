# Sprint Brief: S30-T3 — Session/Journal Backend + SPY Daily Cache + Hermes Summary Routine

## Context

Sprint 1 of the S30/S31/S32 Super Sprint. This track is 100% backend. It builds:

1. A new **`session_journal`** table + CRUD API for per-day trader metrics (infractions, discipline, emotional control, Hermes summary, user notes). Scores are **0.0–10.0 decimal**, not 0–100.
2. A new **`spy_daily`** cache table + sync service + `/api/market/spy-daily` endpoint to feed T1's SPY heatmap.
3. A new **`hermes-daily-summary`** Routine that runs at **5pm ET weekdays** and populates the `hermes_summary` field for active users by calling Harper with that day's trades.

Per standing rule (`feedback_supabase_migration_filenames.md`), migrations are **local SQL files only** — do NOT use `mcp__claude_ai_Supabase__apply_migration` or `execute_sql`. Hand the files to TP for `supabase db push`.

## Branch Target

`s30-performance`

## Scope — Included

- [ ] **Migration** `backend-hono/migrations/031_session_journal.sql`:

  ```sql
  CREATE TABLE IF NOT EXISTS session_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    infractions INT NOT NULL DEFAULT 0 CHECK (infractions >= 0),
    discipline_score NUMERIC(3,1) CHECK (discipline_score >= 0 AND discipline_score <= 10.0),
    emotional_control NUMERIC(3,1) CHECK (emotional_control >= 0 AND emotional_control <= 10.0),
    hermes_summary TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_session_journal_user_date ON session_journal(user_id, date DESC);

  ALTER TABLE session_journal ENABLE ROW LEVEL SECURITY;
  CREATE POLICY session_journal_owner ON session_journal
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ```

- [ ] **Migration** `backend-hono/migrations/032_spy_daily.sql`:

  ```sql
  CREATE TABLE IF NOT EXISTS spy_daily (
    date DATE PRIMARY KEY,
    open NUMERIC(10,4),
    high NUMERIC(10,4),
    low NUMERIC(10,4),
    close NUMERIC(10,4),
    volume BIGINT,
    pct_change NUMERIC(6,3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_spy_daily_date ON spy_daily(date DESC);
  ```

- [ ] **New service** `backend-hono/src/services/session-journal.ts`:
  - `getSessionJournal(userId, date): Promise<SessionJournal | null>`
  - `getSessionJournalRange(userId, from, to): Promise<SessionJournal[]>`
  - `upsertSessionJournal(userId, input): Promise<SessionJournal>` — ON CONFLICT (user_id, date) DO UPDATE
  - Zod schema for input validation at the service boundary
  - Thin — the route does auth, this does DB

- [ ] **New route** `backend-hono/src/routes/session-journal.ts`:
  - `GET /api/session-journal?date=YYYY-MM-DD` → current row or null
  - `GET /api/session-journal/range?from=...&to=...` → array
  - `PUT /api/session-journal` → body `{ date, infractions, disciplineScore, emotionalControl, notes }` → upsert
  - Auth via existing Supabase JWT middleware (grep for how other authed routes do it — never bypass)
  - Returns typed `SessionJournal` shape matching the one T2 appends to `shared/index.ts`

- [ ] **New service** `backend-hono/src/services/market-data/spy-daily-sync.ts`:
  - Function `syncSpyDaily(options?: { from?: Date; to?: Date; backfill?: boolean })`
  - Uses existing `yahoo-market.ts` patterns. Extend `yahoo-market.ts` with a `getDailyBars(symbol, from, to): Promise<DailyBar[]>` helper if one does not already exist — hit `https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&period1=...&period2=...`
  - UPSERT rows into `spy_daily` on `date` primary key
  - `pct_change` = `(close - open) / open * 100`, rounded to 3 decimals
  - Initial backfill: last 365 days on first run (detect via `SELECT COUNT(*) FROM spy_daily` = 0)

- [ ] **New route** `backend-hono/src/routes/market/spy-daily.ts`:
  - `GET /api/market/spy-daily?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Returns `{ data: SpyDailyBar[], stats: { total, up, down, avgPct } }`
  - If table is empty, trigger `syncSpyDaily({ backfill: true })` in background (fire-and-forget) and return 202 with `{ status: "backfilling" }` — T1's frontend handles this gracefully

- [ ] **Mount new routes** in `backend-hono/src/routes/index.ts` (append at end of route list; do NOT reorder existing mounts — T4 is appending too)

- [ ] **New Routine doc** `docs/routines/hermes-daily-summary.md`:
  - Schedule: Mon–Fri at 5:00pm ET
  - Flow: for each user with trades today → pull trades + notes + infractions → call Harper with a "session summary, 2-3 sentences, stoic tone" prompt → `UPDATE session_journal SET hermes_summary=... WHERE user_id=... AND date=...`
  - Trigger endpoint: `POST /api/harper-ops/hermes-daily-summary` (create if a Harper-Ops pattern exists; grep `routes/harper-ops`)
  - Document is for TP to wire into Harper Routines — the endpoint ships in this track, the scheduling is TP's side

- [ ] **New route** `backend-hono/src/routes/harper-ops/hermes-daily-summary.ts`:
  - `POST` — no body, server-determines today in ET
  - Iterates users with activity today, generates summary via existing Harper chat service, upserts into `session_journal`
  - Returns `{ processed: number, errors: string[] }`
  - Auth: this route is Routine-only, gate with existing Routine secret header pattern (grep `ROUTINE_SECRET` or equivalent)

- [ ] **Types** — append to `shared/index.ts`:

  ```ts
  export interface SessionJournal {
    id: string;
    userId: string;
    date: string; // YYYY-MM-DD
    infractions: number;
    disciplineScore: number | null; // 0.0-10.0
    emotionalControl: number | null; // 0.0-10.0
    hermesSummary: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }

  export interface SpyDailyBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    pctChange: number;
  }
  ```

- [ ] Changelog + file headers

## Scope — Excluded (DO NOT TOUCH)

- ALL frontend — T1/T2/T4 own it
- `backend-hono/src/routes/trades/**` — T4 (screenshot ingestion)
- `backend-hono/src/services/projectx-service.ts` — T4 may extend
- Do NOT apply migrations directly. Write SQL files only. Hand to TP.
- Do NOT touch `harper-vision/**` — T4 reuses its LLM helper

## Known Issues to Preserve

- Supabase migration filename rule: **14-digit timestamp prefix**. But the existing `backend-hono/migrations/` folder uses a 3-digit sequential scheme (`030_harper_vision.sql`). **Match the existing convention** in that folder (so `031_session_journal.sql`, `032_spy_daily.sql`). The 14-digit rule applies to `/supabase/migrations/` — check which folder `supabase db push` points at. If both exist, mirror the existing pattern in the target folder.
- RLS: `auth.users` + `auth.uid()` — confirm these exist in the Supabase project (they do on hosted Supabase; verify locally before committing).
- `harper-vision/engine.ts` has an LLM helper that T4 will reuse for screenshot parsing — don't break its import surface when touching `shared/`.

## Implementation Steps

1. Read `backend-hono/migrations/030_harper_vision.sql` to match the migration style (headers, IF NOT EXISTS, RLS patterns).
2. Read `backend-hono/src/routes/index.ts` to see the mount convention. Append new routes at the bottom.
3. Read one existing authed route (e.g. one from `routes/projectx/trades.ts`) to mirror the auth middleware pattern.
4. Write the two migration files.
5. Implement `session-journal.ts` service + route. Test locally with a Zod-validated PUT.
6. Implement `spy-daily-sync.ts` + `spy-daily.ts` route. Manually trigger a backfill against a dev Supabase project if possible.
7. Implement `harper-ops/hermes-daily-summary.ts`. Grep for existing Harper chat service and reuse — do not re-implement the chat call.
8. Append shared types.
9. `cd backend-hono && bun run build` to confirm zero TS errors.
10. Restart local launchd backend per rule: `launchctl unload/load io.solvys.fintheon-backend`.
11. Smoke test endpoints against `http://localhost:8080` before Wave 2.
12. Changelog + file headers.
13. Hand migration files to TP with a one-liner in chat: "S30-T3 ready, two migrations to push: 031_session_journal.sql + 032_spy_daily.sql".

## Acceptance Criteria

- [ ] Two migration files exist, are idempotent (`IF NOT EXISTS`), and TP has been notified
- [ ] `GET /api/session-journal?date=2026-04-23` returns 200 with null or a row
- [ ] `PUT /api/session-journal` with valid body upserts and returns the stored row
- [ ] `GET /api/market/spy-daily?from=2026-01-01` returns an array with at least YTD rows, or 202 on first call if backfilling
- [ ] `POST /api/harper-ops/hermes-daily-summary` with the Routine secret header processes and returns `{ processed: N }`
- [ ] Without Routine secret, that endpoint returns 401
- [ ] `shared/index.ts` exports `SessionJournal` + `SpyDailyBar` types
- [ ] `bun run build` passes in `backend-hono/`
- [ ] All new files are <300 lines
- [ ] Changelog entry added
- [ ] Local backend restarts cleanly; `fintheon.fly.dev/api/diagnostics` still reports green post-deploy

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build
cd ..

# Frontend type check (confirm shared/ exports still resolve for T1/T2/T4)
npx tsc --noEmit --project frontend/tsconfig.json

# Local backend restart
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Endpoint smokes (local)
curl -s http://localhost:8080/api/session-journal?date=2026-04-23 | jq .
curl -s -X PUT http://localhost:8080/api/session-journal \
  -H "content-type: application/json" \
  -H "authorization: Bearer $LOCAL_TEST_JWT" \
  -d '{"date":"2026-04-23","infractions":0,"disciplineScore":8.5,"emotionalControl":7.0,"notes":"smoke"}' | jq .
curl -s http://localhost:8080/api/market/spy-daily?from=2026-01-01 | jq '.data | length'
```

## Commit Format

```
[v5.22.10W] feat: S30-T3 session/journal backend + spy-daily cache + hermes summary routine
```
