# Sprint Brief: S30-T3 — Session/Journal Backend + Futures Daily Cache + Daily Market Summary + Hermes Routines

## Context

Sprint 1 of the S30/S31/S32 Super Sprint. 100% backend. Builds:

1. **`session_journal`** table + CRUD API. Per-day trader metrics. Scores are **0.0–10.0 decimal** (not 0–100).
2. **`futures_daily`** cache (PK `(contract, date)`) + sync + `GET /api/market/futures-daily?contract=ES`. **Fintheon trades futures only — no stocks.** Seed contracts: ES, NQ, MES, MNQ, CL, GC, 6E (Yahoo: `ES=F`, `NQ=F`, etc.).
3. **`daily_market_summary`** table (PK `date`) + `GET /api/market/daily-summary?date=YYYY-MM-DD`. Summary is **≤160 chars, date-pinned, contract-invariant** — T1's heatmap swaps contract but NEVER swaps the summary text.
4. **Hermes session summary** Routine — 5pm ET weekdays, populates `session_journal.hermes_summary`.
5. **Daily market summary** Routine — 5pm ET weekdays, populates `daily_market_summary` from top IV-weighted RiskFlow items.

Per standing rule (`feedback_supabase_migration_filenames.md`), migrations are **local SQL files only** — no `apply_migration` / `execute_sql`. Hand files to TP for `supabase db push`.

## Branch Target

`s30-performance`

## Scope — Included

### Migrations

- [ ] `backend-hono/migrations/031_session_journal.sql`:

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

- [ ] `backend-hono/migrations/032_futures_daily.sql`:

  ```sql
  CREATE TABLE IF NOT EXISTS futures_daily (
    contract TEXT NOT NULL,
    date DATE NOT NULL,
    open NUMERIC(12,4),
    high NUMERIC(12,4),
    low NUMERIC(12,4),
    close NUMERIC(12,4),
    volume BIGINT,
    pct_change NUMERIC(6,3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (contract, date)
  );
  CREATE INDEX IF NOT EXISTS idx_futures_daily_contract_date ON futures_daily(contract, date DESC);
  ```

- [ ] `backend-hono/migrations/033_daily_market_summary.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS daily_market_summary (
    date DATE PRIMARY KEY,
    summary TEXT NOT NULL CHECK (char_length(summary) <= 160),
    source TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```

### Services

- [ ] `backend-hono/src/services/session-journal.ts` — `get`, `getRange`, `upsert` with Zod validation
- [ ] `backend-hono/src/services/market-data/futures-daily-sync.ts` — extends Yahoo to fetch `=F` futures bars; per-contract backfill (365d on first run per contract); upserts `futures_daily`
- [ ] `backend-hono/src/services/market-data/yahoo-market.ts` — extend with `getDailyBars(symbol, from, to)` if missing; ensure `ES=F`, `NQ=F`, `MES=F`, `MNQ=F`, `CL=F`, `GC=F`, `6E=F` all resolve
- [ ] `backend-hono/src/services/market-data/daily-market-summary.ts` — generates ≤160 char summary from top N IV-weighted RiskFlow items for a given date via Harper; upserts `daily_market_summary`

### Routes

- [ ] `backend-hono/src/routes/session-journal.ts`:
  - `GET /api/session-journal?date=YYYY-MM-DD`
  - `GET /api/session-journal/range?from=...&to=...`
  - `PUT /api/session-journal` — upsert on `(user_id, date)`
  - Auth: existing Supabase JWT middleware (grep existing authed routes, mirror pattern)
- [ ] `backend-hono/src/routes/market/futures-daily.ts`:
  - `GET /api/market/futures-daily?contract=ES&from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Returns `{ contract, data: FuturesDailyBar[], stats: { total, up, down, avgPct } }`
  - If contract empty, trigger `syncFuturesDaily({ contract, backfill: true })` fire-and-forget, return 202
- [ ] `backend-hono/src/routes/market/daily-summary.ts`:
  - `GET /api/market/daily-summary?date=YYYY-MM-DD` → `{ date, summary, source, updatedAt }` or 404
- [ ] `backend-hono/src/routes/harper-ops/hermes-daily-summary.ts` — Routine-secret-gated POST
- [ ] `backend-hono/src/routes/harper-ops/daily-market-summary.ts` — Routine-secret-gated POST

### Routines (docs for TP to wire via Harper Ops)

- [ ] `docs/routines/hermes-daily-summary.md` — Mon–Fri 5pm ET → per-user session summary
- [ ] `docs/routines/daily-market-summary.md` — Mon–Fri 5pm ET → single market summary for the day

### Mounts + Types

- [ ] Append new routes in `backend-hono/src/routes/index.ts` (T4 also appends; do NOT reorder)
- [ ] Append to `shared/index.ts`:

  ```ts
  export interface SessionJournal {
    id: string;
    userId: string;
    date: string;
    infractions: number;
    disciplineScore: number | null;
    emotionalControl: number | null;
    hermesSummary: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }
  export interface FuturesDailyBar {
    contract: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    pctChange: number;
  }
  export interface DailyMarketSummary {
    date: string;
    summary: string;
    source: string | null;
    updatedAt: string;
  }
  ```

- [ ] Changelog + `// [claude-code 2026-04-23] S30-T3 ...` header comments

## Scope — Excluded (DO NOT TOUCH)

- All frontend — T1/T2/T4
- `backend-hono/src/routes/trades/**` — T4
- `backend-hono/src/services/projectx-service.ts` — T4 may extend
- `harper-vision/**` — T4 reuses its LLM helper; do not modify
- DO NOT apply migrations directly. Write SQL files only.

## Known Issues to Preserve

- `backend-hono/migrations/` uses 3-digit sequential (`030_harper_vision.sql`). Match that scheme: `031`, `032`, `033`. The 14-digit timestamp rule applies to the separate `/supabase/migrations/` folder.
- Yahoo futures symbols use `=F` suffix (`ES=F`). Existing `yahoo-market.ts` fetches `SPY`, `ES`, `NQ`, `QQQ` — confirm `ES=F`-style symbols work, extend if not.
- `auth.users` + `auth.uid()` required for RLS on hosted Supabase.

## Implementation Steps

1. Read `backend-hono/migrations/030_harper_vision.sql` for migration style.
2. Read `backend-hono/src/routes/index.ts` mount pattern.
3. Read `backend-hono/src/services/market-data/yahoo-market.ts`; confirm `=F` symbol handling or extend.
4. Read one existing authed route (e.g. `routes/projectx/trades.ts`) to mirror auth pattern.
5. Write three migration files.
6. Implement `session-journal.ts` service + route.
7. Implement `futures-daily-sync.ts` + `futures-daily.ts` route. Test backfill for `ES`.
8. Implement `daily-market-summary.ts` service + route.
9. Implement two Routine-gated endpoints under `routes/harper-ops/`. Reuse existing Harper chat service — don't re-implement.
10. Append `shared/index.ts` types.
11. `cd backend-hono && bun run build`.
12. Restart launchd backend.
13. Smoke test all endpoints against `localhost:8080`.
14. Changelog + file headers.
15. Notify TP: "S30-T3 ready, three migrations to push: 031_session_journal.sql, 032_futures_daily.sql, 033_daily_market_summary.sql".

## Acceptance Criteria

- [ ] Three migration files exist, idempotent, TP notified
- [ ] `GET /api/session-journal?date=2026-04-23` returns 200
- [ ] `PUT /api/session-journal` upserts and returns row
- [ ] `GET /api/market/futures-daily?contract=ES&from=2026-01-01` returns array
- [ ] Swapping `?contract=NQ` returns different bars; same date range
- [ ] `GET /api/market/daily-summary?date=2026-04-23` returns ≤160-char summary (same text regardless of contract query context)
- [ ] `POST /api/harper-ops/hermes-daily-summary` (with Routine secret) processes and returns `{ processed: N }`
- [ ] `POST /api/harper-ops/daily-market-summary` (with Routine secret) writes today's market summary
- [ ] Without Routine secret, both gated endpoints return 401
- [ ] `shared/index.ts` exports `SessionJournal`, `FuturesDailyBar`, `DailyMarketSummary`
- [ ] `bun run build` passes in `backend-hono/`
- [ ] All new files <300 lines
- [ ] Changelog entry added
- [ ] `fintheon.fly.dev/api/diagnostics` green post-deploy

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build
cd ..

# Frontend type check (shared/ surface)
npx tsc --noEmit --project frontend/tsconfig.json

# Local backend restart
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Endpoint smokes
curl -s "http://localhost:8080/api/session-journal?date=2026-04-23" | jq .
curl -s -X PUT http://localhost:8080/api/session-journal \
  -H "content-type: application/json" \
  -H "authorization: Bearer $LOCAL_TEST_JWT" \
  -d '{"date":"2026-04-23","infractions":0,"disciplineScore":8.5,"emotionalControl":7.0,"notes":"smoke"}' | jq .
curl -s "http://localhost:8080/api/market/futures-daily?contract=ES&from=2026-01-01" | jq '.data | length'
curl -s "http://localhost:8080/api/market/futures-daily?contract=NQ&from=2026-04-01" | jq '.data | length'
curl -s "http://localhost:8080/api/market/daily-summary?date=2026-04-22" | jq .
```

## Commit Format

```
[v5.22.10W] feat: S30-T3 session/journal + futures-daily cache + daily-market-summary + hermes routines
```
