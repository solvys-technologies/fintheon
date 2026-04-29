# Sprint Brief: S50-T2 — Performance Tab Migration

## Context

The Performance Tab hosts five hand-rolled SVG charts (`BloombergChart`, `PnLChart`, `HybridChart`, `ERTrendChart`, `EquityCurveDrawer`) that ship one-off coordinate math and no shared design tokens. T2 migrates each to T1's Solvys-skinned Recharts wrappers without changing public prop signatures, and adds subsection-level show/hide toggles to `AgentPerformanceTab` and `PerformanceJournal`. Charts default ON; toggle state persists per-subsection via `localStorage`. Zero call-sites should need to change.

## Orchestration Context

**Sprint:** S50 — Charts Refactor (Solvys-skinned Recharts). See `sprint-md/S50-ORCHESTRATION.md` for the full sprint plan.

**Your wave:** Wave 2 (consumer migration). You run **in parallel with T3** (Arbitrum chart overlays). T3 touches `frontend/components/arbitrum/`, you touch `frontend/components/journal/` — disjoint, no coordination needed.

**Wave 1 must merge first.** You consume T1's wrappers (`@/components/charts/...`) and T1's tokens hook. Do not start until T1's PR is merged.

**Sibling tracks (do not modify their files):**

- T1 owns `frontend/components/charts/**` + `frontend/lib/charts/**` + `frontend/package.json`. Import only.
- T3 owns `frontend/components/arbitrum/{ArbitrumChamber,ArbitrumChartOverlays,ConfidenceHistoryChart,VoteBreakdownChart,DissentRadial}.tsx` + Arbitrum overlay-related Sanctum.tsx wiring.
- T4 owns the backend endpoints. T2 may consume `/api/journal/pnl-series` ONLY if T4 has merged; otherwise stay on the existing data path.
- T5 owns the mobile port and unification — do not port your changes to mobile yourself.

**Gate to next wave:** T2 + T3 PRs both merged + screenshots posted + TP sign-off. Then T5 begins.

**Owner pool:** non-Claude-Code (Cursor / Codex / juniors). No inter-track messaging. File ownership is the only conflict-prevention layer.

## Branch Target

`s50-charts` (rebases on top of T1 commit)

**Wave:** 2 (parallel with T3, after T1 merges)
**Complexity:** High
**Estimated:** 5 charts migrated + 2 toggle hosts wired + 1 new ChartToggle component, ~500 LOC churn

## Scope — Included

- [ ] Migrate `frontend/components/journal/BloombergChart.tsx` — replace SVG body with `<SolvysArea>` + `<SolvysScatter>` + `<SolvysBar>` siblings inside one `<ResponsiveContainer>`. Keep the public prop interface (`BloombergChartProps`) verbatim; keep `export function BloombergChart(...)` so call-sites don't change.
- [ ] Migrate `frontend/components/journal/PnLChart.tsx` → `<SolvysLine>` with zero-baseline reference line.
- [ ] Migrate `frontend/components/journal/HybridChart.tsx` → `<SolvysDualAxis>`. Preserve P&L on left axis (gold) and ER on right axis (conditional color).
- [ ] Migrate `frontend/components/journal/HybridChartDropdown.tsx` — only the inner chart swap; dropdown chrome stays.
- [ ] Migrate `frontend/components/journal/ERTrendChart.tsx` → `<SolvysArea>` with conditional fill: `score ≥ 6 ? bullish : score ≤ 3 ? bearish : accent` (preserve existing rule).
- [ ] Migrate `frontend/components/journal/TradingCalendar/EquityCurveDrawer.tsx` → `<SolvysLine>` with running-zero reference. Drawer chrome stays untouched.
- [ ] Create `frontend/components/journal/ChartToggle.tsx` — lightweight wrapper component. Props: `{ subsectionId: string; defaultOpen?: boolean; children: ReactNode }`. Renders a small text-button (`[Chart] / [Hide]`) in section header; reads/writes `localStorage` under key `s50.perf.charts.{subsectionId}`. Hidden state collapses children with `display:none` (instant, no transition).
- [ ] Wire `<ChartToggle>` around every chart subsection in:
  - `frontend/components/journal/AgentPerformanceTab.tsx`
  - `frontend/components/journal/PerformanceJournal.tsx`
- [ ] **Do NOT touch any iframe.**
- [ ] Append one changelog entry to `src/lib/changelog.ts`.

## Scope — Excluded (DO NOT TOUCH)

- T1 wrapper files at `frontend/components/charts/` and `frontend/lib/charts/` — consume only.
- ArbitrumChamber / Sanctum / any Arbitrum file (T3 owns).
- `mobile/` (T5 owns).
- `backend-hono/` (T4 owns).
- Any file in the global off-limits list.

## Off-Limits (hard ban)

- `frontend/components/chat/slots/TVChartSlot.tsx`
- `frontend/components/narrative/SanctumChart.tsx`
- `frontend/components/RiskFlow*.tsx`
- `frontend/components/IV*` / `NothingFuse*` / `IVStack*`
- `frontend/components/SolvysLoader*.tsx` + `frontend/components/icons/*`
- `frontend/components/regimes/ConfidenceBar.tsx`
- `frontend/components/consilium/DAGProgressBar.tsx`
- Any `<iframe>` anywhere in `frontend/` or `mobile/`
- `frontend/index.css` (read-only — token additions forbidden)

## Reuse Inventory

- T1 wrappers at `frontend/components/charts/` — `SolvysLine`, `SolvysBar`, `SolvysArea`, `SolvysScatter`, `SolvysDualAxis`. Import as `@/components/charts/...`.
- T1 fixtures at `frontend/components/charts/__fixtures__/` — copy data shapes from these as migration templates.
- T1 `useSolvysChartTokens()` hook at `frontend/lib/charts/tokens.ts` — use for any inline color overrides.
- Existing P&L data hooks in `frontend/hooks/` (search for `useJournal`, `usePnl`, `useERTrend`) — keep using them; do NOT change data fetchers.
- T4's NEW `/api/journal/pnl-series` endpoint (if T4 ships before T2 starts) — wire it ONLY if T4 has merged. Otherwise stay on the existing data path.

## Known Issues to Preserve

- BloombergChart current behavior: dual-layer (P&L area + trade-dot scatter + volume bars + crosshair). Preserve all four layers via composition inside one `<ResponsiveContainer>`.
- HybridChart: dual-axis P&L (left, gold) + ER (right, conditional). Do not flip axes.
- ERTrendChart conditional coloring rule: `score ≥ 6 ? bullish : score ≤ 3 ? bearish : accent`. Preserve.
- `EquityCurveDrawer` is a slide-out drawer — only the chart inside changes; drawer chrome stays.
- T2 ChartToggle uses `display:none`, NOT a transition (per "no animation drift" rule).

## Implementation Steps

1. **Pull T1 first.** Confirm `frontend/components/charts/` exists and `bun install` is clean.
2. For each of the 5 chart files, in order — Bloomberg → PnL → Hybrid → ER → EquityCurve:
   1. Read the existing file end-to-end. Copy the prop interface verbatim.
   2. Rewrite the component body to compose T1 wrappers, keeping the `export function {Name}(...)` signature unchanged.
   3. Add `// [author 2026-04-29] S50-T2: migrated to Recharts` header comment.
   4. Build + visually compare to the existing version (screenshot before/after).
3. Build `frontend/components/journal/ChartToggle.tsx`:
   - Props: `{ subsectionId: string; defaultOpen?: boolean; children: ReactNode }`
   - Renders a small text button in header position; toggles a `display:none` wrapper around children.
   - Persists open state to `localStorage` key `s50.perf.charts.{subsectionId}`.
4. Wire `<ChartToggle>` around chart subsections in `AgentPerformanceTab.tsx` and `PerformanceJournal.tsx`.
5. Append one changelog entry.
6. Run validation block.

## Acceptance Criteria

- [ ] All 5 migrated files import from `@/components/charts/...` (T1 wrappers) — verified by `grep "components/charts" frontend/components/journal/`.
- [ ] No SVG `<path>` / `<polyline>` / `<rect>` left in any of the 5 files (search the diff).
- [ ] All 5 files keep their original `export function {Name}(...)` signature — call-sites unchanged.
- [ ] `ChartToggle` works in both AgentPerformanceTab and PerformanceJournal: clicking [Hide] removes chart, [Chart] restores. State persists across reload.
- [ ] No iframe was modified or removed (`grep -rn iframe frontend/components/journal/`).
- [ ] `tsc --noEmit` passes.
- [ ] `bun run build` clean.
- [ ] **TP screenshot review:** before/after of Performance Tab, EquityCurveDrawer open, ERTrendChart in PsychAssist consumer.

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && cd frontend && bun run build && cd ..
```

## Commit Format

```
[v5.36.0-alpha.2] feat: T2 Performance Tab → Recharts wrappers + subsection toggles
```
