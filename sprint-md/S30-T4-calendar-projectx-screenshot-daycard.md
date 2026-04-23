# Sprint Brief: S30-T4 — Calendar Inline + ProjectX Extension + Screenshot Ingest + Day-Detail Redesign

## Context

Sprint 1 of the S30/S31/S32 Super Sprint. This is the heaviest track — four deliverables sharing the Calendar/DayDetail surface. Goals:

1. **Kill the Dashboard/Calendar pill toggle**: Calendar becomes an inline section scrolled BELOW Dashboard inside Performance tab, not a sibling pill. Must fit one viewport without inner scroll (match the screen-height-locked feel of Sanctum/Dashboard).
2. **Audit + extend ProjectX API coverage** (sync is already live; check balance/equity-curve endpoints and add if missing).
3. **Screenshot ingestion**: upload TopStepX day-performance screenshot → vision parse → trade rows → upsert into existing `trades` table.
4. **Day-detail card redesign**: mirror the TopStepX Day Performance modal style (equity curve + trade table), but swap the "Add Journal" CTA for a **Daily News Summary** from `scored_riskflow_items`.

## Branch Target

`s30-performance`

## Scope — Included

- [ ] **Calendar inline layout**:
  - In `frontend/components/journal/PerformanceJournal.tsx`, remove the Dashboard/Calendar pill toggle. Render both sections stacked vertically:
    - Top: existing Dashboard (heatmaps from T1 + KPIs + BlindspotsRow from T2 + SessionJournalPanel from T2)
    - Below: Calendar (existing `TradingCalendar/` components), full-width
  - Keep the Human/Agent toggle — that stays
  - Compress calendar vertical density to fit viewport:
    - In `TradingCalendar/CalendarCell.tsx`, reduce vertical padding (target ~80-90px per cell instead of current ~140-150px)
    - In `TradingCalendar/index.tsx`, reduce week-row gap
    - Font-size trim for date numerals — preserve readability, drop ornamental space
  - Verify final layout fits 1440×900 desktop minimum without inner scroll on the calendar region
- [ ] **ProjectX extension audit**:
  - Read `backend-hono/src/services/projectx-service.ts` fully; enumerate existing methods
  - Confirm coverage for: `getTrades`, `getAccount`, `getPositions`, `getEquityCurve`
  - Add missing methods as thin wrappers; do NOT rewrite existing sync logic
  - Expose via `backend-hono/src/routes/projectx/`:
    - `GET /api/projectx/account` (balance, buying power)
    - `GET /api/projectx/equity-curve?from=...&to=...`
  - If any method already exists, note it in the track report and move on
- [ ] **Screenshot ingestion** — new endpoint + service + frontend upload:
  - `backend-hono/src/routes/trades/ingest-screenshot.ts`:
    - `POST /api/trades/ingest-screenshot` accepting `multipart/form-data` with `image` field
    - Validates file type (`image/png`, `image/jpeg`, `image/webp`), max 8 MB
    - Calls `screenshot-parser.ts`
  - `backend-hono/src/services/trades/screenshot-parser.ts`:
    - Function `parseTradeScreenshot(buffer: Buffer, userId: string): Promise<{ inserted: number; rows: TradeRow[] }>`
    - Reuses harper-vision's LLM describe helper (from `backend-hono/src/services/harper-vision/engine.ts` or the underlying vision-call utility — find + reuse, do NOT re-implement the vision call)
    - Prompt: structured extraction — "Extract every trade row from this screenshot into JSON matching: `{id, symbol, size, entryTime, exitTime, duration, entryPrice, exitPrice, pnl, commissions, fees, direction}`. Return a JSON array, no prose."
    - Zod validates the LLM output
    - Upserts into `trades` with `origin='user'` and new column `source='screenshot'` (add column if missing via a tiny migration)
  - If a `trades.source` column does not exist, write migration `backend-hono/migrations/033_trades_source.sql`:
    ```sql
    ALTER TABLE trades ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'api';
    ```
  - Frontend upload button in the new Day Detail header (see next bullet):
    - File input (png/jpg/webp), POSTs to the endpoint, on success refetches trades and closes the upload state
- [ ] **Day-detail card redesign** — match TopStepX Day Performance modal style:
  - New component `frontend/components/journal/DayDetailModal.tsx` (or refactor the existing `EquityCurveDrawer.tsx` into it; pick whichever keeps files <300 lines)
  - Header: "Day Performance: MM/DD/YY" + upload-screenshot button on right
  - Equity curve chart: Profit (Y) over Time (X), red→green gradient fill below the line (the one permitted gradient — equity curve fill)
    - Reuse data from `trades` where `entry_at::date = selected day`
    - Running sum of `realized_pnl`
  - Trade table: full columns as spec'd: ID · Symbol · Size · Entry Time · Exit Time · Duration · Entry Price · Exit Price · P&L · Commissions · Fees · Direction
    - Rows-per-page selector (default 100), pagination
    - Sort by Entry Time descending by default
  - **Replace "Add Journal"** section with new `DailyNewsSummary.tsx`:
    - Fetches `scored_riskflow_items` WHERE `published_at::date = selected day`, top 3-5 IV-weighted items
    - Renders headline + source + IV score badge (reuse `IVStack`)
    - One-line context for each; no full article text
  - New component `frontend/components/journal/DailyNewsSummary.tsx`
- [ ] **Mount new routes** in `backend-hono/src/routes/index.ts` (append; do NOT reorder — T3 also appends)
- [ ] Changelog + per-file `// [claude-code 2026-04-23] S30-T4 ...` header comments

## Scope — Excluded (DO NOT TOUCH)

- T1 territory: `TradeActivityHeatmap.tsx`, `SPYDailyHeatmap.tsx`, `trade-colors.ts`, `FusePalette` extension
- T2 territory: `WeeklyPerformanceWidget.tsx`, `BlindspotsRow.tsx`, `SessionJournalPanel.tsx`, `BlindspotsWidget.tsx` deletion, `MainLayout.tsx`
- T3 territory: `session-journal.ts` service/route, `spy-daily` migrations/routes, `hermes-daily-summary`
- `harper-vision/**` — reuse its LLM helper ONLY; do not modify harper-vision code
- `src/lib/changelog.ts` — append-only, single entry per track at the end

## Known Issues to Preserve

- Calendar is under active refinement per S29 (CatalystSlideOut + calendar UI overhaul on 2026-04-22). Preserve:
  - `CatalystSlideOut` integration (clicking a day still opens the slide-out; do not break that wire)
  - Human/Agent toggle behavior at lines ~246-283 of `PerformanceJournal.tsx`
  - `ProjectXCalendar` vs `SolvysCalendar` dual renderers
- The "only one permitted gradient" rule: equity curve red→green fill is allowed because it's a data-viz semantic, not decoration. All other surfaces stay flat.
- `PerformanceJournal.tsx` is shared real estate. T1 owns the top-row flip; T2 owns panel consolidation. T4 touches only the pill-toggle removal + the calendar-below wiring. Coordinate via clear JSX comments so Wave 2 unification is mechanical.
- Harper-vision screenshot parsing is DIFFERENT from harper-vision's continuous capture — reuse only the LLM call helper, NOT `frame-store.ts` or the `harper_vision_frames` table.

## Implementation Steps

1. Grep for the Dashboard/Calendar pill toggle implementation in `PerformanceJournal.tsx`. Read the surrounding context.
2. Draft the new layout: Dashboard-section JSX + Calendar-section JSX stacked. Leave clear comments for T1/T2 insertion points.
3. Read `TradingCalendar/CalendarCell.tsx`. Measure current cell height in browser; compute target trim.
4. Read `projectx-service.ts` and enumerate existing methods. Add any missing read-only endpoints.
5. Find the harper-vision LLM helper. Grep for `generateDescription`, `describeImage`, or the underlying Claude/GPT-4o vision call in `backend-hono/src/services/harper-vision/`. Reuse it.
6. Write `screenshot-parser.ts` with the structured extraction prompt + Zod schema + upsert logic.
7. Write `ingest-screenshot.ts` route with multipart handling.
8. If `trades.source` column doesn't exist: write migration `033_trades_source.sql` and note it for TP.
9. Build `DayDetailModal.tsx`:
   - Header + equity curve + trade table + `DailyNewsSummary`
   - Reuse any equity-curve charting component already in `TradingCalendar/EquityCurveDrawer.tsx`
10. Build `DailyNewsSummary.tsx`: fetch from existing RiskFlow endpoint (grep `/api/riskflow/feed` — there's an endpoint per CLAUDE.md)
11. Wire everything into `PerformanceJournal.tsx`. Leave T1/T2 JSX slots intact.
12. Restart launchd backend: `launchctl unload/load io.solvys.fintheon-backend`.
13. Test: upload a screenshot locally, confirm rows appear in `trades`, click a day on the calendar, see new modal.
14. Changelog + file headers.

## Acceptance Criteria

- [ ] Performance tab: no Dashboard/Calendar pill toggle. Dashboard content renders, Calendar follows directly below, both visible via single page scroll (calendar itself does not scroll internally at 1440×900)
- [ ] `POST /api/trades/ingest-screenshot` accepts a PNG of the TopStepX day modal and inserts rows into `trades` with `origin='user'`, `source='screenshot'`
- [ ] `GET /api/projectx/account` returns account balance and buying power
- [ ] `GET /api/projectx/equity-curve?from=X&to=Y` returns time-series points
- [ ] Clicking a day cell opens `DayDetailModal` with: header, equity curve, trade table (paginated), Daily News Summary (NOT "Add Journal")
- [ ] Upload button inside Day Detail works end-to-end
- [ ] All new files <300 lines
- [ ] `tsc --noEmit`, `cd backend-hono && bun run build`, and `rm -rf dist && npx vite build` all pass
- [ ] No existing routes or sync logic broken (`/api/projectx/trades` still works, 15-min sync still runs)
- [ ] Changelog entry added

## Validation Commands

```bash
# Frontend
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# Backend
cd backend-hono && bun run build
cd ..

# Local backend restart
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke tests (local)
curl -s http://localhost:8080/api/projectx/account | jq .
curl -s "http://localhost:8080/api/projectx/equity-curve?from=2026-04-01&to=2026-04-23" | jq '.points | length'
curl -s -F "image=@/tmp/topstepx-day.png" http://localhost:8080/api/trades/ingest-screenshot | jq .

# File size sanity
wc -l frontend/components/journal/PerformanceJournal.tsx \
      frontend/components/journal/DayDetailModal.tsx \
      frontend/components/journal/DailyNewsSummary.tsx \
      backend-hono/src/services/trades/screenshot-parser.ts \
      backend-hono/src/routes/trades/ingest-screenshot.ts
```

## Commit Format

```
[v5.22.10W] feat: S30-T4 calendar inline + projectx extension + screenshot ingest + day-detail redesign
```
