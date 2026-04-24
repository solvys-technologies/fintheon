# Sprint Brief: T4 — Web Source Quality Audit + FJ-Alignment Pass

## Context

news-worker reports `items_ingested: 0, errors: 0` every tick in prod — suspicious silent-drop. TP says "lots of bullshit in the feed, less actionable than FinancialJuice." Three documented silent-drop zones (from Explore report): (a) empty collector arrays in `workers/news-worker/sources/index.ts`, (b) dedup on tweet_id in `persist.ts`, (c) central-scorer filtering in `content-guard.ts` + MARKET_KEYWORDS. This track surfaces the drop rate + tightens the content gate toward FJ-grade density.

## Branch target

`s34-t4-web-source-quality-audit` off `main`.

## Scope — Included

- [ ] Instrument silent-drop points — add per-source counters (no behavior change yet):
  - `backend-hono/src/workers/news-worker/persist.ts` — track `{source, dropped_dedup, dropped_missing_fields, written}` per batch.
  - `backend-hono/src/services/riskflow/content-guard.ts` — track `{rejected_keyword, rejected_length, rejected_language}` per call.
  - `backend-hono/src/services/riskflow/central-scorer.ts` — track `{dropped_below_threshold, dropped_dismissed_pattern}` per item.
- [ ] Emit drop counters into a new table `riskflow_drop_counters` via a 60s flush. Migration: `supabase/migrations/20260424103000_riskflow_drop_counters.sql`.
  - Columns: `id uuid pk`, `source text`, `stage text`, `reason text`, `count int`, `window_start timestamptz`, `window_end timestamptz`.
- [ ] New Supabase view `v_source_signal_noise` joining `raw_riskflow_items` × `scored_riskflow_items` over the last 48h, returning per-source `{ingested, promoted, drop_rate, avg_score}`.
- [ ] New diagnostics endpoint: `GET /api/diagnostics/source-quality` reading `v_source_signal_noise` + `riskflow_drop_counters`.
- [ ] Scrape ≥500 recent FinancialJuice posts via existing `agent-reach.ts` / `browser-harness.ts` primitive (do NOT enable Rettiwt). Derive the keyword-density floor from the sample — median count of MARKET_KEYWORDS per post. Save as a tuning artifact at `backend-hono/src/services/riskflow/fj-keyword-baseline.json`.
- [ ] Update `content-guard.ts` allowlist with additional FJ-density keywords discovered in the sample (append-only, no removals without TP review).
- [ ] Write a short report at `sprint-md/S34-T4-REPORT.md` with: (1) baseline drop rates per source, (2) top 5 lowest-signal sources, (3) recommended prune list (requires TP approval before any RSS URL actually gets removed).
- [ ] Changelog + top-of-file comments.

## Scope — Excluded (DO NOT TOUCH)

- `workers/news-worker/sources/index.ts` RSS/URL list — T5 (WS1) owns the DB-driven swap. Do NOT add/remove URLs here.
- `rettiwt-poller-econ.ts`, `rettiwt-service.ts`, Rettiwt gating — T6 owns.
- `econ_watch_filters`, `economic_events` — T1/T3 own.
- Any frontend file.
- `content-guard.ts` MUST NOT tighten so aggressively in Wave 1 that live feed volume drops. Counters-first, tuning-later. Any allowlist changes must only ADD keywords (expand pass rate), never remove.

## Known issues to preserve

- `feedback_no_claude_routines`: the 60s counter flush is node-cron in-process, not /schedule.
- `feedback_fact_check_worker_briefs`: verify `raw_riskflow_items` + `scored_riskflow_items` column names against Supabase REST before writing the view SQL. Don't hallucinate.
- `feedback_supabase_migration_filenames`: 14-digit, local file only, hand to TP.
- The "0 ingest, 0 error" pattern in prod is the smoking gun — DO NOT mask it with a fallback that fabricates nonzero counts. Report real zeroes.

## Implementation steps

1. Grep `raw_riskflow_items` + `scored_riskflow_items` column names in existing migrations to confirm view schema.
2. Add counter instrumentation in persist.ts / content-guard.ts / central-scorer.ts — wrap existing drops with `bumpCounter(source, stage, reason)`.
3. Write `riskflow_drop_counters` migration + `v_source_signal_noise` view in same SQL file.
4. Add `/api/diagnostics/source-quality` route.
5. Build FJ scrape script (one-shot in `backend-hono/scripts/scrape-fj-sample.ts`) → write `fj-keyword-baseline.json`.
6. Write `sprint-md/S34-T4-REPORT.md` with findings + recommendations.
7. Build + restart + smoke.
8. Changelog + comments + commit. Do NOT remove any RSS URL without TP signoff in the report.

## Acceptance criteria

- [ ] `curl localhost:8080/api/diagnostics/source-quality` returns per-source drop-rate + signal-noise numbers.
- [ ] `v_source_signal_noise` query returns rows for every source currently in `raw_riskflow_items`.
- [ ] `fj-keyword-baseline.json` exists with ≥500 post-derived keyword density stats.
- [ ] `content-guard.ts` allowlist gains new keywords (documented in report); no allowlist keyword is removed.
- [ ] `S34-T4-REPORT.md` names the 5 lowest-signal sources with concrete % drop rates, marked "AWAITING TP APPROVAL" for prune.

## Validation commands

```bash
cd backend-hono && bun run build && cd ..
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
sleep 90  # let counters accumulate one flush
curl -s http://localhost:8080/api/diagnostics/source-quality | jq '.'
```

## Commit format

```
[v.04.24.4] feat: T4 source-quality counters + FJ-baseline + prune report
```
