# S50-ORCH — Performance Tab

- **Parent sprint branch**: `sprint/S50`
- **Cycle**: Cycle 7 (Pre-Release)
- **Due**: May 16
- **Owner**: Shashank

## What this covers

Review, refine, or strip the Performance Tab after the S50 Recharts migration. The original S50 sprint migrated 5 hand-rolled SVG charts to Solvys-skinned Recharts wrappers (T1-T2). This ORCH audits the result for correctness, visual quality, and code hygiene. If any migrated charts have regressions or issues, they get fixed. If any surface is not worth keeping, strip it cleanly.

## Codebase map

### Chart components (Recharts wrappers — T1)

- `frontend/components/charts/SolvysLine.tsx` — Line chart wrapper
- `frontend/components/charts/SolvysBar.tsx` — Bar chart wrapper
- `frontend/components/charts/SolvysArea.tsx` — Area chart wrapper
- `frontend/components/charts/SolvysScatter.tsx` — Scatter chart wrapper
- `frontend/components/charts/SolvysDualAxis.tsx` — Dual-axis chart wrapper
- `frontend/components/charts/SolvysRadial.tsx` — Radial/donut chart wrapper
- `frontend/lib/charts/tokens.ts` — `useSolvysChartTokens()` hook
- `frontend/lib/charts/SolvysTooltip.tsx` — Shared chart tooltip
- `frontend/lib/charts/SolvysAxis.tsx` — Shared chart axis
- `frontend/lib/charts/SolvysGrid.tsx` — Shared chart grid
- `frontend/components/charts/__fixtures__/` — Test fixtures for all wrappers

### Journal/migrated charts (consumers — T2)

- `frontend/components/journal/BloombergChart.tsx` — P&L area + trade dots + volume bars (migrated to Recharts)
- `frontend/components/journal/PnLChart.tsx` — Simple P&L line (migrated)
- `frontend/components/journal/HybridChart.tsx` — Dual-axis P&L + ER (migrated using SolvysDualAxis)
- `frontend/components/journal/HybridChartDropdown.tsx` — Chart mode selector
- `frontend/components/journal/ERTrendChart.tsx` — ER trend with conditional coloring (migrated)
- `frontend/components/journal/TradingCalendar/EquityCurveDrawer.tsx` — Drawer chart (migrated)
- `frontend/components/journal/ChartToggle.tsx` — Subsection show/hide toggle (created in T2)
- `frontend/components/journal/AgentPerformanceTab.tsx` — Agent performance tab (toggle host)
- `frontend/components/journal/PerformanceJournal.tsx` — Main performance tab (toggle host)

### Other Performance Tab surfaces

- `frontend/components/journal/KPICard.tsx` — KPI display card
- `frontend/components/journal/performance-tab/AgentKpiStats.tsx` — Agent KPI stats grid
- `frontend/components/journal/performance-tab/AgentBreakdownTable.tsx` — Agent breakdown table
- `frontend/components/journal/performance-tab/AgentProposalTracker.tsx` — Proposal tracker
- `frontend/components/journal/performance-tab/AgentSummaryPanel.tsx` — Summary panel
- `frontend/components/journal/performance/PerformanceHeatmapsRow.tsx` — Heatmap row
- `frontend/components/journal/performance/TradeActivityHeatmap.tsx` — Trade activity heatmap
- `frontend/components/journal/performance/FuturesDailyHeatmap.tsx` — Futures heatmap
- `frontend/components/journal/PerformanceHistoryPage.tsx` — History page

### Backend

- `backend-hono/src/routes/journal/index.ts` — Journal route registration
- `backend-hono/src/routes/journal/handlers.ts` — Journal handlers

## Child tickets

### SOL-60 — S50-T2: Performance tab review + refine or strip

Branch: `sprint/S50`

**What to do**: Audit the S50 chart migration outcome. Check each of the 5 migrated chart files (BloombergChart, PnLChart, HybridChart, ERTrendChart, EquityCurveDrawer) for:

- Visual correctness: do they look equivalent to pre-migration? Check tooltips, crosshairs, conditional coloring (ER green/red rule), dual-axis rendering.
- TypeScript: do all imports from `@/components/charts/` resolve? No inline SVG path/polyline left in migrated files.
- ChartToggle behavior: does it persist to localStorage correctly? Does `display:none` collapse properly?
- Dead code: are there any unused pre-migration files or commented-out code?

If any chart has visual regressions, fix them. If a surface is not worth keeping (e.g., PnLChart is superseded by BloombergChart), strip it cleanly — remove the file, update imports in all consumers, add changelog entry.

**Key files to touch**: `frontend/components/journal/BloombergChart.tsx`, `frontend/components/journal/PnLChart.tsx`, `frontend/components/journal/HybridChart.tsx`, `frontend/components/journal/ERTrendChart.tsx`, `frontend/components/journal/TradingCalendar/EquityCurveDrawer.tsx`, `frontend/components/journal/ChartToggle.tsx`, `frontend/components/journal/AgentPerformanceTab.tsx`, `frontend/components/journal/PerformanceJournal.tsx`, `frontend/components/charts/*`

**Validation**: Visual comparison (screenshot pre/post for each chart). Verify localStorage toggle keys. `npx tsc --noEmit --project frontend/tsconfig.json && npx vite build`.

## Execution order

Single ticket, but suggested work order:

1. Run through all 5 migrated charts visually — screenshot each
2. Fix any visual regressions
3. Review dead code — strip if clearly superseded
4. Verify ChartToggle wiring in both hosts
5. Final validation pass

## Validation

- [ ] All 5 migrated charts look correct (compare to pre-migration screenshots or recall)
- [ ] No hand-rolled SVG `<path>` / `<polyline>` / `<rect>` remains in migrated files (search the diff)
- [ ] ChartToggle works: [Chart]/[Hide] button, localStorage persistence
- [ ] ERTrendChart conditional coloring preserved: `score >= 6 ? bullish : score <= 3 ? bearish : accent`
- [ ] `/api/journal/entries` and `/api/journal/summary` endpoints return expected data
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `npx vite build` passes
- [ ] No iframe was modified
- [ ] Add changelog entry to `src/lib/changelog.ts`

## Handoff to Developer (Shashank)

This file is your single entry point for the S50-ORCH Performance Tab work. This is a single-ticket ORCH (SOL-60), so work through it in the suggested sub-steps.

**To execute:**
1. Read this entire plan file for codebase map and context
2. Work through SOL-60 sub-steps: visual audit → fix regressions → strip dead code → verify toggle → final validation
3. The child ticket in Linear has enriched context with specific files and validation steps
4. After completing, run all validation steps listed in this file
5. Reference `@sprint-md/S50-T2-performance-tab-migration.md` for full migration context and `@sprint-md/S50-T1-recharts-foundation-kit.md` for wrapper API reference
6. Add changelog entry to `src/lib/changelog.ts`

**Branch**: `sprint/S50` | **Cycle**: Cycle 7 (Pre-Release) | **Due**: May 16

## Reference

- @sprint-md/S50-T2-performance-tab-migration.md — original sprint brief with full migration context
- @sprint-md/S50-T1-recharts-foundation-kit.md — T1 wrapper API reference
