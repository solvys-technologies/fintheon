# Sprint Brief: T10 — Econ Backfill Orchestrator (2023 → today, free-tier LLMs)

## Context

`economic_events` only starts carrying rows once T3's populator fires going forward. TP wants historical depth back to 2023-01-01 so the countdown modal, narrative gates, and `v_source_signal_noise` have a real baseline. Budget constraint: Harper (Opus) is too expensive for raw scraping. This track builds a gradual, cron-paced orchestrator that delegates the heavy pull to free-tier OpenRouter models (Llama 3.3 70B, Mistral Large) and reserves Harper for weekly categorization + dedup passes. Pace: 2 quarters per week so the backfill completes over ~6 weeks without burning credits or rate-limiting FRED / ForexFactory archives.

## Wave position

**Background.** Kicks off AFTER Wave 2 clears (T5/T6/T7/T8 merged). Depends on T3's `economic_events` base migration being live. Long-running — the cron continues on a weekly cadence even after the orchestrator peer closes.

## Branch target

`s34-t10-backfill-orchestrator` off `main`.

## Scope — Included

- [ ] Supabase migration: `supabase/migrations/20260424102000_econ_backfill_progress.sql` — **local file only**, do NOT apply via MCP. Hand to TP for `supabase db push`.
  - Table `econ_backfill_progress`:
    - `id uuid pk default gen_random_uuid()`
    - `slice_start date not null` (e.g. `2025-07-01`)
    - `slice_end date not null` (e.g. `2025-09-30`)
    - `country text not null`
    - `status text not null default 'pending'` — `pending | claimed | enriching | complete | failed`
    - `claimed_at timestamptz`
    - `completed_at timestamptz`
    - `rows_written integer default 0`
    - `error text`
    - `created_at timestamptz default now()`
    - `unique(slice_start, slice_end, country)`
  - Table `econ_backfill_queue`:
    - `id uuid pk default gen_random_uuid()`
    - `progress_id uuid references econ_backfill_progress(id) on delete cascade`
    - `raw_payload jsonb not null` — LLM output before Harper pass
    - `normalized boolean default false`
    - `created_at timestamptz default now()`
  - Seed `econ_backfill_progress` with `2023-Q1` → today slices (7 countries × ~13 quarters ≈ 91 rows) all `status='pending'`. Use a DO block with `generate_series` over quarter boundaries.

- [ ] New service: `backend-hono/src/services/cron/econ-backfill-orchestrator.ts`
  - `node-cron` schedule: `'0 2 * * 1'` (Monday 02:00 ET — use `America/New_York` tz option per `news-worker-audit-scheduler.ts` pattern).
  - `export function startEconBackfillOrchestrator(): void` — matches the shape of `startNewsWorkerAuditScheduler`.
  - Per tick:
    1. Claim next 2 `pending` slices via `update ... set status='claimed', claimed_at=now() where id in (select id ... order by slice_start asc limit 2) returning *`.
    2. For each claimed slice: call `pullSliceViaFreeTierLLM(slice)` (see next file).
    3. Insert result into `econ_backfill_queue`; mark `econ_backfill_progress.status='enriching'`.
    4. Trigger `harperCategorizeBacklog()` (batch — processes all `normalized=false` queue rows for that slice).
    5. On Harper completion: insert normalized rows into `economic_events` (idempotent upsert on `event_key`), set `status='complete'`, record `rows_written`.
  - Wrap each slice in try/catch; on failure set `status='failed'` + `error`, DO NOT throw (one bad slice must not block the tick).
  - Guard: if `OPENROUTER_API_KEY` is missing, log warn + skip the tick (do not crash boot — per CLAUDE.md degraded-AI rule).

- [ ] New service: `backend-hono/src/services/cron/econ-backfill-puller.ts`
  - `export async function pullSliceViaFreeTierLLM(slice: BackfillSlice): Promise<RawSlicePayload>`.
  - Model selection: try `meta-llama/llama-3.3-70b-instruct:free` first, fall back to `mistralai/mistral-large:free`. Use the same POST shape as `backend-hono/src/services/voice-sentiment.ts:105-109` (`https://openrouter.ai/api/v1/chat/completions`, `Authorization: Bearer ${process.env.OPENROUTER_API_KEY}`).
  - Tool budget: give the LLM a minimal instruction to "list all scheduled economic events for {country} between {slice_start} and {slice_end}, with date, time (ET), event name, forecast, and actual". Parse JSON response.
  - For US slices prefer FRED series (series IDs: `CPIAUCSL`, `PAYEMS`, `UNRATE`, `FEDFUNDS`, `GDP`, `CORESTICKM159SFRBATL`) — fetch directly via `https://api.stlouisfed.org/fred/series/observations` if `FRED_API_KEY` is set (optional env var, no-op if missing). LLM fills gaps.
  - For non-US slices: LLM only (Llama/Mistral have ForexFactory calendar data in pretraining through 2025).
  - Retry with exponential backoff (250ms / 1s / 4s) on HTTP 429/503 from OpenRouter.

- [ ] New service: `backend-hono/src/services/cron/econ-backfill-harper.ts`
  - `export async function harperCategorizeBacklog(progressId: string): Promise<NormalizedEvent[]>`.
  - Pulls all `econ_backfill_queue` rows for `progressId` where `normalized=false`.
  - Calls Harper (Claude Opus via the existing VProxy route — reuse `backend-hono/src/services/harper-handler.ts` client or `backend-hono/src/services/ai/routing.ts`). DO NOT write a new Anthropic client.
  - Prompt: "Dedup against existing `economic_events` (pass in slim list via tool), categorize each into `Fiscal | Supply Chain | Inflation | Job Market | Speaker` using T3's `categorizeEvent` heuristic, return JSON array of `{ country, category, name, event_time_utc, forecast, actual, event_key }` where `event_key = sha256(country + name + event_time_utc)`."
  - Weekly budget cap: if Harper usage exceeds 500k tokens on a given Monday tick, short-circuit and leave remaining queue for next week. Log the deferral.

- [ ] Type file: `backend-hono/src/types/econ-backfill.ts` — `BackfillSlice`, `RawSlicePayload`, `NormalizedEvent`, `BackfillStatus`.

- [ ] Idempotent upsert path: use T3's `economic_events.event_key` unique column for `on conflict (event_key) do update`. If T3 hasn't exposed `event_key` yet, coordinate via orchestrator — do NOT add the column here (T3 owns base migration).

- [ ] Register scheduler in `backend-hono/src/boot/services.ts` alongside `startNewsWorkerAuditScheduler` (look for the S28 block around line 265). Gate on `ECON_BACKFILL_ENABLED` env var (default `true`); only skip when explicitly `false`.

- [ ] Diagnostics: add a `econ_backfill` block to `/api/diagnostics` showing `{ last_run, slices_complete, slices_pending, slices_failed, rows_written_total }`. Read aggregates from `econ_backfill_progress`.

- [ ] Changelog entry in `src/lib/changelog.ts` and top-of-file `// [claude-code 2026-04-24] ...` comments on every modified file.

## Scope — Excluded (DO NOT TOUCH)

- `economic_events` schema / base migration → **T3** owns. Confirm `event_key` + `country` + `category` + `name` + `event_time_utc` columns exist before starting; do NOT add or alter them here.
- `econ_watch_filters` → T1 owns. Backfill intentionally ignores filter state (fills the whole 7-country matrix) — we want full history even for categories TP may toggle on later.
- T3's live populator (`econ-calendar-populator.ts`) — shares the table but has a different cron cadence; do not call into it.
- `econ-keyword-trigger.ts` (T6) and `EconCountdownModal.tsx` (T8) — they consume `economic_events`; backfill just populates it.
- Any frontend work. No UI in this track.
- Do not wire into Fly auto-scale / machine sizing. Single-machine cron, per `feedback_fly_always_on`.

## Known issues to preserve

- `feedback_supabase_migration_filenames`: 14-digit timestamp filename, local file only, NEVER `mcp__claude_ai_Supabase__apply_migration` or `execute_sql` for DDL.
- `feedback_trades_table_migration`: confirm T3's base migration for `economic_events` exists in `supabase/migrations/` BEFORE writing the progress migration. If it doesn't, flag to orchestrator and block.
- `feedback_no_claude_routines`: backfill MUST be in-process node-cron inside the Fly machine, NOT an Anthropic-hosted Routine.
- `feedback_fly_always_on`: do not re-enable auto_stop_machines or reduce min_machines to chase the Monday cron.
- `feedback_no_key_caution_lectures`: if `OPENROUTER_API_KEY` or `FRED_API_KEY` handling comes up in code comments, wire silently — no rotation warnings.
- Every service must work when its env var is missing — `OPENROUTER_API_KEY` absent ⇒ warn + skip tick, never crash.

## Implementation steps

1. **Verify T3 landed.** `git log --all --oneline | grep -i "T3\|economic_events"` and `ls supabase/migrations/ | grep economic_events`. If missing, stop and notify orchestrator.
2. Write `20260424102000_econ_backfill_progress.sql` with `if not exists` guards, two tables, and `DO` block seeding 2023-Q1 → current-quarter × 7 countries.
3. Create `backend-hono/src/types/econ-backfill.ts`.
4. Build `econ-backfill-puller.ts` — start with the OpenRouter call (mirror `voice-sentiment.ts`), add FRED fetch second, parser last.
5. Build `econ-backfill-harper.ts` — reuse existing Harper client; prompt must force JSON response.
6. Build `econ-backfill-orchestrator.ts` — wire puller → queue → Harper → upsert → status update.
7. Register in `boot/services.ts` under the S28 schedulers block; add env guard.
8. Add diagnostics aggregate to `/api/diagnostics`.
9. `cd backend-hono && bun run build` → clean.
10. Local smoke: `bun run -e "import('./dist/services/cron/econ-backfill-orchestrator.js').then(m => m.runBackfillTickOnce())"` (add a named export for dev-triggering one tick).
11. Verify `econ_backfill_progress.status='complete'` for the 2 oldest pending slices; verify rows appear in `economic_events` with correct `event_key`, `country`, `category`.
12. Changelog entry + top-of-file comments on every new/modified file.
13. Commit.

## Acceptance criteria

- [ ] `supabase db push` applies the migration cleanly (91-ish rows in `econ_backfill_progress`, all `status='pending'`).
- [ ] `ECON_BACKFILL_ENABLED=true` (default) → scheduler registers on boot; `curl localhost:8080/api/diagnostics | jq '.econ_backfill'` returns `{ last_run: null, slices_pending: 91, ... }` before first run.
- [ ] Running `runBackfillTickOnce()` locally claims 2 slices, pulls via free-tier LLM (or skips gracefully if no API key), enriches via Harper, writes dedup'd rows to `economic_events`.
- [ ] Second tick picks up the NEXT 2 slices (ordered by `slice_start asc`) — no overlap, no rework.
- [ ] Failed slice stays at `status='failed'` with `error` populated; does not block the tick.
- [ ] No duplicate rows in `economic_events` after re-running a completed slice (idempotency via `event_key` upsert).
- [ ] Missing `OPENROUTER_API_KEY` → warn log, zero crashes, scheduler remains registered.
- [ ] `cd backend-hono && bun run build` clean. No frontend changes.

## Validation commands

```bash
# 1. Confirm T3's base migration landed
ls supabase/migrations/ | grep -E "economic_events|20260424101000"

# 2. Build
cd backend-hono && bun run build && cd ..

# 3. Apply migration (TP runs)
# supabase db push

# 4. Seed sanity check
psql "$SUPABASE_DB_URL" -c "select count(*), status from econ_backfill_progress group by status;"
# expect: ~91 rows, all 'pending'

# 5. Restart local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# 6. Diagnostics
curl -s http://localhost:8080/api/diagnostics | jq '.econ_backfill'

# 7. Dev-trigger one tick (requires exported runBackfillTickOnce)
bun -e "import('./backend-hono/dist/services/cron/econ-backfill-orchestrator.js').then(async m => { await m.runBackfillTickOnce(); })"

# 8. Verify writes
psql "$SUPABASE_DB_URL" -c "select country, count(*) from economic_events where created_at > now() - interval '10 minutes' group by country;"
```

## Commit format

```
[v.04.24.10] feat: T10 econ backfill orchestrator (2023 → today, free-tier LLMs + Harper pass)
```

## Open questions

- **FRED API key:** optional. Plan prefers FRED for US series when available. If TP hasn't provisioned one, LLM-only fallback is acceptable — note in open-questions, don't block.
- **Harper weekly cap:** 500k tokens/week is a starting estimate. Emit usage metrics to `/api/diagnostics.econ_backfill.harper_tokens_week` so TP can re-tune after week 1.
- **Monday 02:00 ET vs 02:00 UTC:** plan says ET. Use `timezone: 'America/New_York'` in the cron options. If cron fires during DST transitions, accept the ±1hr drift.
- **Financial Datasets MCP:** plan mentions it as a fallback. Not wired in fintheon backend today — skip this track; FRED + LLM is sufficient. Flag for WS8 follow-up if signal quality disappoints.
