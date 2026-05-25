# S50 — Charts Refactor (Solvys-skinned Recharts) — Orchestration

## Sprint Summary

Hand-rolled SVG charts across the Performance Tab ship one-off coordinate math, no shared tokens, no toggleable subsection model, and zero composition primitives. S47-T6 deferred Evil Charts because Recharts wasn't installed and Evil Charts' gradient aesthetic violates the Solvys ban list. **S50 lands the missing primitive layer**: install Recharts, ship a Solvys-skinned wrapper kit, migrate the five hand-rolled charts to use it, and add NEW Arbitrum chart overlays inside Sanctum chart-mode. Charts are toggleable subsection overlays that coexist with the TradingView iframe + ArbitrumChamber side-by-side view. **NO iframes are removed.** Mobile gets a Performance Tab port only — no Arbitrum on mobile.

**Branch:** `s50-charts` (single shared branch — file ownership is the conflict-prevention layer)
**Owners:** non-Claude-Code (Cursor / Codex / juniors). Briefs are airtight; no inter-track messaging.
**Deadline:** this week, next `/solvys-deploy`.

## Wave Sequence

### Wave 1 (parallel)

```
@sprint-md/S50-T1-recharts-foundation-kit.md
```

```
@sprint-md/S50-T4-backend-chart-data-endpoints.md
```

### Wave 2 (after Wave 1 merges)

```
@sprint-md/S50-T2-performance-tab-migration.md
```

```
@sprint-md/S50-T3-arbitrum-chart-overlays.md
```

### Wave 3 (after Wave 2 merges)

```
@sprint-md/S50-T5-unification-mobile-deploy.md
```

## What Each Wave Accomplishes

**Wave 1** lays the foundation. T1 installs Recharts, builds the Solvys-skinned `<SolvysLine>` / `<SolvysBar>` / `<SolvysArea>` / `<SolvysScatter>` / `<SolvysDualAxis>` / `<SolvysRadial>` wrapper kit with shared tokens, axis, grid, and tooltip primitives. T4 lands three new backend endpoints (`/api/journal/pnl-series`, `/api/arbitrum/confidence-history`, `/api/arbitrum/vote-breakdown/:id`) that the frontend tracks will consume. T1 and T4 touch disjoint files, so they run in parallel safely.

**Wave 2** consumes the foundation. T2 migrates the five hand-rolled Performance Tab charts (BloombergChart, PnLChart, HybridChart, ERTrendChart, EquityCurveDrawer) to T1's wrappers without changing public prop signatures, and adds subsection-level show/hide toggles. T3 builds three NEW Arbitrum chart overlays (confidence-over-time, vote breakdown, dissent radial) inside ArbitrumChamber, gated by a master toggle (default OFF). T2 owns Performance Tab files, T3 owns Arbitrum files — disjoint, parallel-safe.

**Wave 3** unifies and ships. T5 resolves any merge conflicts, ports the Performance Tab charts to the Mobile PWA (no Arbitrum on mobile), runs end-to-end smoke across desktop + mobile + backend, verifies the off-limits list is untouched, and bundles screenshots for TP sign-off. TP fires `/solvys-deploy` after approval.

## Critical Cross-Cutting Rules

1. **Never start `vite dev`.** Verify via `tsc --noEmit` + `vite build` only.
2. **`rm -rf dist` before every vite build** (frontend AND mobile) — stale-bundle prevention.
3. **Restart launchd backend after backend changes:** `launchctl unload && load io.solvys.fintheon-backend.plist`.
4. **No gradients, no emojis, no Kanban borders, no AI sparkles, no generic shadows, no backdrop-blur.**
5. **Solvys Gold (#d4af37 / `--fintheon-accent`) is the only accent color.**
6. **No iframe is touched.**
7. **Every modified file gets a `// [author 2026-04-29] S50-T{N}: …` header comment.**
8. **Each track appends ONE entry to `src/lib/changelog.ts`.** Append-only — do not edit other entries.
9. **No file > 300 LOC. Split on growth.**
10. **TypeScript strict mode. Zod at route boundaries.**
11. **No new dependencies beyond `recharts`. No paid APIs. No new env vars.**
12. **No new test runner / Storybook / Playwright setup.** Visual verification via screenshot.
13. **If a track owner gets stuck, post to TP with the specific blocker. Do NOT improvise scope.**

## Off-Limits (ALL TRACKS — hard ban)

- `frontend/components/chat/slots/TVChartSlot.tsx`
- `frontend/components/narrative/SanctumChart.tsx`
- `frontend/components/RiskFlow*.tsx`
- `frontend/components/IV*` / `NothingFuse*` / `IVStack*`
- `frontend/components/SolvysLoader*.tsx` + `frontend/components/icons/*`
- `frontend/components/regimes/ConfidenceBar.tsx`
- `frontend/components/consilium/DAGProgressBar.tsx`
- `backend-hono/src/services/arbitrum/engine.ts` + `seats.ts` + `event-trigger.ts`
- News pollers (per memory `feedback_news_pollers_locked.md`)
- `frontend/index.css` and `mobile/index.css` (read-only — no new tokens)
- Any `<iframe>` anywhere in `frontend/` or `mobile/`

## File-Ownership Matrix

| Path                                                                        | Owner                                  |
| --------------------------------------------------------------------------- | -------------------------------------- |
| `frontend/components/charts/**` (NEW)                                       | T1                                     |
| `frontend/lib/charts/**` (NEW)                                              | T1                                     |
| `frontend/package.json` (add `recharts` + lock)                             | T1                                     |
| `mobile/components/charts/**` (NEW)                                         | T5                                     |
| `mobile/components/journal/**` (NEW)                                        | T5                                     |
| `mobile/package.json` (add `recharts` + lock)                               | T5                                     |
| `backend-hono/src/routes/journal/handlers.ts`                               | T4                                     |
| `backend-hono/src/routes/journal/index.ts`                                  | T4                                     |
| `backend-hono/src/routes/arbitrum/index.ts`                                 | T4                                     |
| `backend-hono/src/services/arbitrum/verdict-store.ts` (read-extension only) | T4                                     |
| `frontend/components/journal/BloombergChart.tsx`                            | T2                                     |
| `frontend/components/journal/PnLChart.tsx`                                  | T2                                     |
| `frontend/components/journal/HybridChart.tsx`                               | T2                                     |
| `frontend/components/journal/HybridChartDropdown.tsx`                       | T2                                     |
| `frontend/components/journal/ERTrendChart.tsx`                              | T2                                     |
| `frontend/components/journal/TradingCalendar/EquityCurveDrawer.tsx`         | T2                                     |
| `frontend/components/journal/AgentPerformanceTab.tsx` (toggle wiring)       | T2                                     |
| `frontend/components/journal/PerformanceJournal.tsx` (toggle wiring)        | T2                                     |
| `frontend/components/journal/ChartToggle.tsx` (NEW)                         | T2                                     |
| `frontend/components/arbitrum/ArbitrumChamber.tsx` (overlay slot only)      | T3                                     |
| `frontend/components/arbitrum/ArbitrumChartOverlays.tsx` (NEW)              | T3                                     |
| `frontend/components/arbitrum/ConfidenceHistoryChart.tsx` (NEW)             | T3                                     |
| `frontend/components/arbitrum/VoteBreakdownChart.tsx` (NEW)                 | T3                                     |
| `frontend/components/arbitrum/DissentRadial.tsx` (NEW)                      | T3                                     |
| `src/lib/changelog.ts`                                                      | All — append-only, one entry per track |

If a track needs a file not on its row, it stops and posts to TP — does NOT improvise.

## Unification Pass

T5 (Wave 3, dedicated track) handles unification: merge resolution, mobile port, end-to-end smoke, off-limits regression check, screenshot bundle for TP. The orchestrator Claude does NOT merge — T5 is the merge owner.
