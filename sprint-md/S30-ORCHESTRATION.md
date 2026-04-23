# S30 — Performance Tab Overhaul — Orchestration

**Sprint 1 of the S30/S31/S32 Super Sprint.**
**Branch**: `s30-performance` (cut off `main` @ `968eadbe`).
**Baseline**: v5.22.9W (S29 cherry-pick).
**Target version**: v5.22.10W (bumped per sub-sprint; single release tag at Super Sprint end).

## Waves

### Wave 1 — Parallel (4 tracks on `s30-performance`)

```
@sprint-md/S30-T1-heatmaps-and-kpi-layout.md
```

```
@sprint-md/S30-T2-strategium-blindspots-session-fe.md
```

```
@sprint-md/S30-T3-session-journal-spy-backend.md
```

```
@sprint-md/S30-T4-calendar-projectx-screenshot-daycard.md
```

### Wave 2 — Unification (orchestrator-run)

The orchestrating Claude instance merges the 4 tracks, resolves `PerformanceJournal.tsx` conflicts (shared real estate), and runs validation.

## Shared File Ownership

| File                                                 | Wave 1 owner                                                                                  | Wave 2 merger             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| `frontend/components/journal/PerformanceJournal.tsx` | T1 top-row flip, T2 inserts session panel + blindspots row, T4 removes pill + inline calendar | Orchestrator merges       |
| `backend-hono/src/routes/index.ts`                   | T3 appends session + spy mounts, T4 appends trades + projectx mounts                          | Orchestrator              |
| `shared/index.ts`                                    | T3 appends types, T2 appends types                                                            | Orchestrator              |
| `src/lib/changelog.ts`                               | Each track appends one entry                                                                  | Orchestrator consolidates |

All other files are single-owner. No two tracks modify the same non-shared file.

## Wave 1 Parallel Summary

- **T1** rebuilds the top row with two heatmap cards (Trade Activity + SPY Daily) in the user's bullish/bearish palette, moves the 8 KPI cards down, extends `FusePalette` with color prefs.
- **T2** swaps the Strategium Blindspots widget for a Weekly Performance widget, promotes Blindspots to a full-width before/after row on Performance, and collapses the 3 session cards + Hermes + Notes into one `SessionJournalPanel` with 0.0–10.0 decimal sliders.
- **T3** ships the entire session/journal + futures daily backend: three migrations (session_journal, futures_daily, daily_market_summary), CRUD routes, Yahoo `=F` futures bar sync, `/api/market/daily-summary` (≤160-char date-pinned summary), and two Routine-gated endpoints (hermes-daily-summary + daily-market-summary, both 5pm ET).
- **T4** removes the Dashboard/Calendar pill toggle (calendar now inline + viewport-fit), audits + extends ProjectX read endpoints, adds the screenshot ingestion pipeline reusing harper-vision's LLM helper, and redesigns the Day Detail modal (equity curve + trade table + Daily News Summary replacing "Add Journal").

## Wave 2 Unification Checklist (orchestrator)

1. Merge 4 tracks onto `s30-performance`. Resolve `PerformanceJournal.tsx` with the intended final layout: heatmaps row (T1) → KPI row (T1) → BlindspotsRow (T2) → SessionJournalPanel (T2) → Calendar inline (T4).
2. Wire `SessionJournalPanel` Submit → `PUT /api/session-journal`.
3. Wire `TradeActivityHeatmap` + `SPYDailyHeatmap` → extended `FusePalette.bullishColor` / `.bearishColor`.
4. Wire `FuturesDailyHeatmap` → `GET /api/market/futures-daily?contract=...` + `GET /api/market/daily-summary?date=...` (remove mocks).
5. Wire `DailyNewsSummary` → existing RiskFlow endpoint.
6. Hand migration files to TP for `supabase db push`:
   - `backend-hono/migrations/031_session_journal.sql`
   - `backend-hono/migrations/032_futures_daily.sql`
   - `backend-hono/migrations/033_daily_market_summary.sql`
   - `backend-hono/migrations/034_trades_source.sql` (only if T4 added the `trades.source` column)
7. Wire `hermes-daily-summary` Routine via Harper Ops (TP action, documented by T3).
8. Run validation stack:
   ```bash
   npx tsc --noEmit --project frontend/tsconfig.json
   cd backend-hono && bun run build && cd ..
   rm -rf dist && npx vite build
   launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
   launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
   ```
9. Smoke test all new endpoints against `localhost:8080`, then redeploy + test against `fintheon.fly.dev`.
10. Changelog consolidated entry + per-file header comments verified.

## Deploy Readiness

S30 is not a standalone release — it ships as part of the S30/S31/S32 Super Sprint. When all three sprints land on `main`, `/solvys-deploy` handles the 3-target deploy (Fly.io backend + desktop Vercel + mobile Vercel) with a single version bump.
