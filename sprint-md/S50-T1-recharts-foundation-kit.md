# Sprint Brief: S50-T1 — Recharts Foundation Kit

## Context

Hand-rolled SVG charts across the Performance Tab ship one-off coordinate math, no shared tokens, no toggleable subsection model, and zero composition primitives. S47-T6 deferred Evil Charts because Recharts wasn't installed and Evil Charts' gradient aesthetic violates the Solvys ban list. T1 lands the missing primitive layer: install Recharts and ship a Solvys-skinned wrapper kit that T2 (Performance migration), T3 (Arbitrum overlays), and T5 (mobile port) consume. **No consumer migration in T1** — this brief is foundation only.

## Orchestration Context

**Sprint:** S50 — Charts Refactor (Solvys-skinned Recharts). See `sprint-md/S50-ORCHESTRATION.md` for the full sprint plan.

**Your wave:** Wave 1 (foundation). You run **in parallel with T4** (backend chart-data endpoints). T4 touches `backend-hono/`, you touch `frontend/components/charts/` + `frontend/lib/charts/` + `frontend/package.json` — disjoint, no coordination needed.

**What blocks on you:** Wave 2 cannot start until T1 merges. T2 (Performance Tab migration) and T3 (Arbitrum chart overlays) both import the wrappers you ship.

**Sibling tracks (do not modify their files):**

- T2 owns `frontend/components/journal/{Bloomberg,PnL,Hybrid,HybridChartDropdown,ER}*.tsx` + `TradingCalendar/EquityCurveDrawer.tsx` + `AgentPerformanceTab.tsx` + `PerformanceJournal.tsx` + `ChartToggle.tsx`.
- T3 owns `frontend/components/arbitrum/{ArbitrumChamber,ArbitrumChartOverlays,ConfidenceHistoryChart,VoteBreakdownChart,DissentRadial}.tsx`.
- T4 owns `backend-hono/src/routes/journal/handlers.ts` + `routes/arbitrum/index.ts` + `services/arbitrum/verdict-store.ts` (read-extension only).
- T5 owns the mobile port (`mobile/components/charts/**` + `mobile/components/journal/**`) and the unification pass.

**Gate to next wave:** T1 PR merged + sandbox screenshot collage posted + TP sign-off. Then T2 and T3 can begin.

**Owner pool:** non-Claude-Code (Cursor / Codex / juniors). No inter-track messaging. File ownership is the only conflict-prevention layer.

## Branch Target

`s50-charts`

**Wave:** 1 (parallel with T4)
**Complexity:** Medium
**Estimated:** 8–10 new files, ~600 LOC

## Scope — Included

- [ ] Add `recharts` (latest 2.x) to `frontend/package.json` dependencies. Run `cd frontend && bun install` and commit `frontend/bun.lock`.
- [ ] Create `frontend/components/charts/` with one wrapper per chart type:
  - `SolvysLine.tsx` (line chart, optional area fill)
  - `SolvysBar.tsx` (vertical bar, supports stacked + grouped)
  - `SolvysArea.tsx` (single-series area; flat fill, NO gradient)
  - `SolvysScatter.tsx` (XY scatter)
  - `SolvysDualAxis.tsx` (two-series overlay, replaces HybridChart pattern)
  - `SolvysRadial.tsx` (radial bar / donut for vote/dissent breakdowns)
- [ ] Create `frontend/lib/charts/tokens.ts` — exports a `useSolvysChartTokens()` hook that reads CSS vars from `frontend/index.css` at runtime: `--fintheon-accent` (gold #d4af37), `--fintheon-bg`, `--fintheon-surface`, `--fintheon-bullish`, `--fintheon-bearish`, `--chart-1` through `--chart-5`, `--font-body`. Returns a typed object the wrappers consume for stroke / fill / grid / tooltip.
- [ ] Create `frontend/lib/charts/SolvysTooltip.tsx` — shared tooltip with flat (NOT blurred) `rgba(10,10,0,0.94)` background and 1px `rgba(212,175,55,0.32)` border. Tabular numerals, Doto-compatible.
- [ ] Create `frontend/lib/charts/SolvysAxis.tsx` + `SolvysGrid.tsx` — opt-in via `<SolvysLine grid axis>`-style props.
- [ ] Document each wrapper with a JSDoc block listing required props + an example. Each file ≤ 200 LOC (per repo CLAUDE rule).
- [ ] Commit a `frontend/components/charts/__fixtures__/` directory with one tsx fixture per wrapper exporting a default component using mock data. T2/T3 copy these as migration templates.
- [ ] Mount fixtures behind a sandbox route (e.g. `frontend/app/_charts-sandbox/` or a dev-only route per repo convention) so TP can screenshot all 6 wrappers in one place.
- [ ] **No gradient fills anywhere.** No `linearGradient` defs. Flat fills only.
- [ ] **No backdrop-blur on tooltips/legends** (Solvys "no glass effects" rule).
- [ ] **No emojis, no AI sparkles, no Kanban borders, no generic shadows.**

## Scope — Excluded (DO NOT TOUCH)

- Migrating any consumer (T2 owns that)
- Any backend work (T4 owns that)
- Mobile (T5 owns that — separate `recharts` install in `mobile/package.json`)
- `frontend/index.css` (read-only — use existing tokens only)
- Anything in the global off-limits list (see `### Off-Limits` below)

## Off-Limits (ALL TRACKS — hard ban)

- `frontend/components/chat/slots/TVChartSlot.tsx`
- `frontend/components/narrative/SanctumChart.tsx`
- `frontend/components/RiskFlow*.tsx`
- `frontend/components/IV*` / `NothingFuse*` / `IVStack*`
- `frontend/components/SolvysLoader*.tsx` + `frontend/components/icons/*`
- `frontend/components/regimes/ConfidenceBar.tsx`
- `frontend/components/consilium/DAGProgressBar.tsx`
- Any `<iframe>` anywhere in `frontend/` or `mobile/`
- Any `*.css` token file outside `frontend/index.css`

## Reuse Inventory

- Solvys CSS vars at `frontend/index.css:42-54` — `--fintheon-accent`, `--fintheon-bg`, `--fintheon-surface`, `--fintheon-bullish`, `--fintheon-bearish`, `--chart-1`..`--chart-5`, `--font-body`. **Do not redefine.**
- Existing `cn()` helper at `frontend/lib/utils.ts` (or wherever `clsx` + `tailwind-merge` are wired) — use for className composition.
- Existing tabular-numeral typography from Doto / `--font-body`.

## Known Issues to Preserve

- S38 chart-mode pin-through (`frontend/components/narrative/Sanctum.tsx:213-219`) — wrappers must render fine inside a `w-1/2` container.
- "No glass effects" rule (memory `feedback_no_glass_effects.md`) — flat tooltip surfaces only.
- Charts must work when imported lazily (PerformanceJournal lazy-loads its surface).

## Implementation Steps

1. `cd frontend && bun add recharts@^2.13.0` → commit lockfile.
2. Create `frontend/lib/charts/tokens.ts`:
   ```ts
   export function useSolvysChartTokens() {
     const root =
       typeof window !== "undefined"
         ? getComputedStyle(document.documentElement)
         : null;
     return {
       accent: root?.getPropertyValue("--fintheon-accent").trim() || "#d4af37",
       bg: root?.getPropertyValue("--fintheon-bg").trim() || "#050402",
       surface:
         root?.getPropertyValue("--fintheon-surface").trim() || "#0a0a00",
       bullish:
         root?.getPropertyValue("--fintheon-bullish").trim() || "#34d399",
       bearish:
         root?.getPropertyValue("--fintheon-bearish").trim() || "#ef4444",
       series: [1, 2, 3, 4, 5]
         .map((i) => root?.getPropertyValue(`--chart-${i}`).trim())
         .filter(Boolean) as string[],
       font:
         root?.getPropertyValue("--font-body").trim() || "Inter, sans-serif",
     };
   }
   ```
3. Build `SolvysTooltip` (Recharts custom `<Tooltip content={...} />`) — flat `rgba(10,10,0,0.94)` background, 1px border `rgba(212,175,55,0.32)`, tabular numerals, NO blur.
4. Build `SolvysAxis` / `SolvysGrid` — thin 0.5px lines at `rgba(212,175,55,0.12)`, axis text in `--font-body` at 11px tabular.
5. Build each `Solvys{Type}` wrapper as a function component that:
   - Accepts a typed `data: T[]` prop + minimal config (height, accent override, valueFormatter)
   - Wraps Recharts' `<ResponsiveContainer>` + the type-specific composer
   - Composes `SolvysAxis` + `SolvysGrid` + `SolvysTooltip` by default
   - Exposes a `<Slot/>` slot for callers to inject reference lines / annotation layers
6. Add a top-of-file comment to each new file: `// [author 2026-04-29] S50-T1: …`
7. Add a single changelog entry in `src/lib/changelog.ts` (append-only).
8. Run validation block.

## Acceptance Criteria

- [ ] `recharts` appears in `frontend/package.json` dependencies; `bun.lock` committed.
- [ ] `frontend/components/charts/` contains 6 wrapper components, each ≤ 200 LOC.
- [ ] `frontend/lib/charts/` contains tokens hook + tooltip + axis + grid.
- [ ] No `linearGradient` / `<defs>` / `gradient` strings anywhere in T1 files.
- [ ] No `backdrop-blur` / `backdropFilter` in T1 files.
- [ ] No emoji, no Kanban side-stripe border, no generic `shadow-*` Tailwind utility.
- [ ] `tsc --noEmit` passes.
- [ ] `bun run build` produces a clean dist (no warnings about missing recharts types).
- [ ] Sandbox fixtures route renders all 6 wrappers with mock data.
- [ ] **TP screenshot review:** post a single screenshot collage of all 6 wrappers from the sandbox route before merging T1.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build (stale-bundle prevention is mandatory)
rm -rf frontend/dist && cd frontend && bun run build && cd ..
```

## Commit Format

```
[v5.36.0-alpha.1] feat: T1 Recharts foundation kit (Solvys-skinned wrappers)
```
