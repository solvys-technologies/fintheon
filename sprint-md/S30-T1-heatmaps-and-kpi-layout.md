# Sprint Brief: S30-T1 — Top-Row Heatmaps + KPI Layout Flip + Color-Pref Extension

## Context

Sprint 1 of the S30/S31/S32 Super Sprint refines the Performance tab shipped in v5.22.9W (S29 cherry-pick). The current top row is empty: "No P&L data" chart on the left, "No blindspots detected" card on the right — it wastes the most valuable real estate on the page. This track rebuilds the top row as two dense **heatmap cards** (Trade Activity + SPY Daily) in the user's personalized bullish/bearish palette, then demotes the 8 KPI cards to the row below.

Trade data already lives in the Supabase `trades` table (populated every 15 min by ProjectX sync + autopilot). SPY daily close data does NOT yet have a persistent cache — T3 will build `spy_daily` + `/api/market/spy-daily`; until then, scaffold the SPY heatmap against a typed mock and swap at Wave 2.

## Branch Target

`s30-performance` (cut fresh off `main` @ `968eadbe` if it does not yet exist).

## Scope — Included

- [ ] New component `frontend/components/journal/performance/TradeActivityHeatmap.tsx`
  - GitHub-style grid, rows = weekday (Mon–Fri, or Mon–Sun if user trades weekends), columns = weeks of year
  - One colored cell per trading day, color = user's `bullishColor` from `user_preferences.fusePalette`, opacity scaled by normalized daily intensity
  - Header row: title "Trade activity", subtitle "`{source}` · `{N}` active days"
  - Right-side segmented toggle: **Trades | Shares | Notional**
  - Year selector dropdown (defaults to current year); years derived from data range
  - Footer: "Less ▢▢▢▢ More" legend using the same opacity steps
  - Reads from `/api/projectx/trades?from=YYYY-01-01&to=YYYY-12-31` (existing route)
- [ ] New component `frontend/components/journal/performance/SPYDailyHeatmap.tsx`
  - Same grid layout, but color diverges: positive days = `bullishColor`, negative = `bearishColor`, opacity = `min(|pct_change|, 2%) / 2%`
  - Header row: title "SPY daily performance", subtitle "`{YEAR}` YTD · intensity = daily % change (open to close)"
  - Right-side stats row: "`N` trading days YTD · `X` up · `Y` down · avg ±`Z%`"
  - Footer legend: "`−2%` [red scale] [green scale] `+2%`"
  - Reads from `/api/market/spy-daily?from=YYYY-01-01` (T3-owned; mock until integration)
- [ ] New helper `frontend/lib/trade-colors.ts`
  - Exported: `getIntensityColor(value: number, palette: FusePalette, range: { min, max }): string`
  - Exported: `getDivergingColor(pct: number, palette: FusePalette, cap = 0.02): string`
  - Returns hex with alpha (`#c79f4acc` style) or rgba tuple — pick one and stick to it
- [ ] Extend `frontend/lib/user-preferences.ts` `FusePalette` interface:
  - Add optional `bullishColor?: string` (default `#22c55e`)
  - Add optional `bearishColor?: string` (default `#ef4444`)
  - Defaults live in a new constant `DEFAULT_TRADE_COLORS` — heatmaps fall back to these when prefs are absent
- [ ] `frontend/components/journal/PerformanceJournal.tsx` top-row layout flip:
  - Replace the current "No P&L data" chart area and the inline Blindspots card (lines ~341-374) with a `<div className="grid grid-cols-2 gap-4">` holding `<TradeActivityHeatmap />` and `<SPYDailyHeatmap />`
  - Move the KPI row (8 cards using existing `KPICard.tsx`) to render BELOW that grid
  - Keep `BloombergChart.tsx` importable as a drill-down but remove from the top-row hero slot
- [ ] Changelog entry in `src/lib/changelog.ts` with date `2026-04-23` describing the layout flip + heatmaps
- [ ] Per-file header comment `// [claude-code 2026-04-23] S30-T1 heatmaps + KPI flip` on every file touched

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/mission-control/BlindspotsWidget.tsx` — T2 deletes this
- `frontend/components/mission-control/WeeklyPerformanceWidget.tsx` — T2 creates this
- `frontend/components/journal/SessionJournalPanel.tsx` — T2 creates this
- `frontend/components/journal/TradingCalendar/**` — T4 territory
- `frontend/components/journal/DayDetailModal.tsx` — T4 territory
- All `backend-hono/**` — T3/T4 territory
- `frontend/components/journal/HumanPsychTab.tsx` — T2 replaces the SessionNotesPanel there
- Do NOT remove `BloombergChart.tsx` outright — keep it on disk for drill-down reuse

## Known Issues to Preserve

- Recent changelog entries (S29, 2026-04-22): CatalystSlideOut + `/api/catalysts/by-date`, chat visual modernization, mobile tsconfig fixes — all intentional, do not revert.
- `PerformanceJournal.tsx` is 444 lines — this refactor will naturally split it; keep the top-level file under 300 lines by extracting the new grid into `PerformanceHeatmapsRow.tsx` if needed.
- The Human/Agent toggle + Dashboard/Calendar sub-toggle at lines 246-283 stay for now — T4 removes the Dashboard/Calendar pill separately. Do not touch the Human/Agent toggle.

## Implementation Steps

1. Read `PerformanceJournal.tsx` top-to-bottom. Note the exact JSX blocks that render:
   - the left "No P&L data" chart (via `BloombergChart`)
   - the inline Blindspots card
   - the KPI grid
2. Read `frontend/lib/user-preferences.ts` and extend `FusePalette` type + defaults.
3. Build `trade-colors.ts` helper. Write a quick unit-style sanity check (manual, inline in the file as `// @test` comment is fine).
4. Build `TradeActivityHeatmap.tsx`:
   - Fetch trades via an existing hook or direct `fetch('/api/projectx/trades?...')`
   - Group by `entry_at::date`, compute metric per day (count / qty sum / |notional| sum)
   - Normalize against max for the year → intensity 0–1
   - Render SVG or div-grid (pick whichever the rest of the codebase uses — grep for existing heatmap or calendar-intensity patterns in `TradingCalendar/CalendarCell.tsx`)
5. Build `SPYDailyHeatmap.tsx`:
   - Fetch from `/api/market/spy-daily` (expect 404 until T3 ships — use a mock JSON file `frontend/lib/__mocks__/spy-daily.json` until wave 2)
   - Diverging color logic via `getDivergingColor`
   - Stats row computed client-side from the fetched array
6. Refactor `PerformanceJournal.tsx`:
   - Extract new `<PerformanceHeatmapsRow />` if keeping the top-level file <300 lines requires it
   - Top row = heatmaps grid, next row = KPI grid
   - Leave the Session/Blindspots/Calendar placeholders intact for T2/T4 to replace
7. Add changelog entry + file header comments.

## Acceptance Criteria

- [ ] Top row of Performance tab renders two heatmap cards side-by-side, no "No P&L data" text anywhere
- [ ] `TradeActivityHeatmap` shows a gold (or user-custom) cell for every day in `trades` within the selected year
- [ ] Toggle between Trades/Shares/Notional updates intensity without refetch
- [ ] Year selector populates from the actual date range of `trades` (plus current year)
- [ ] `SPYDailyHeatmap` renders with diverging colors; stats row computes correctly from the mock data
- [ ] KPI row renders BELOW the heatmaps (visually confirm via build)
- [ ] `FusePalette` type accepts optional `bullishColor` / `bearishColor`; existing code that reads FusePalette still type-checks
- [ ] `PerformanceJournal.tsx` is under 300 lines (extract `PerformanceHeatmapsRow.tsx` if needed)
- [ ] No glass effects, no gradients on heatmaps (flat cells + accent borders only)
- [ ] Changelog entry added
- [ ] `tsc --noEmit` + clean `vite build` both pass

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build (stale bundle prevention)
rm -rf dist && npx vite build

# Confirm heatmap files exist and are <300 lines each
wc -l frontend/components/journal/performance/TradeActivityHeatmap.tsx \
      frontend/components/journal/performance/SPYDailyHeatmap.tsx \
      frontend/components/journal/PerformanceJournal.tsx \
      frontend/lib/trade-colors.ts
```

## Commit Format

```
[v5.22.10W] feat: S30-T1 heatmaps + KPI layout flip + color-pref extension
```
