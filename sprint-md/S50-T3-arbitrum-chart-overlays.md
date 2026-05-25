# Sprint Brief: S50-T3 — Arbitrum Chart Overlays

## Context

Arbitrum's chamber output is currently a text-only verdict card stack. T3 adds three NEW chart overlays inside the existing `ArbitrumChamber` component (rendered inside Sanctum chart-mode): confidence-over-time, weighted vote breakdown, and dissent radial. Overlays are gated by a master toggle (default OFF) plus per-chart toggles, and must coexist with the TradingView iframe + ArbitrumChamber side-by-side view at `Sanctum.tsx` chart-mode without disrupting the existing UX. **No iframes are removed. Sanctum.tsx is barely touched.**

## Orchestration Context

**Sprint:** S50 — Charts Refactor (Solvys-skinned Recharts). See `sprint-md/S50-ORCHESTRATION.md` for the full sprint plan.

**Your wave:** Wave 2 (consumer migration). You run **in parallel with T2** (Performance Tab migration). T2 touches `frontend/components/journal/`, you touch `frontend/components/arbitrum/` — disjoint, no coordination needed.

**Wave 1 must merge first.** You consume T1's wrappers (`@/components/charts/...`) and T1's tokens hook. Do not start until T1's PR is merged.

**Sibling tracks (do not modify their files):**

- T1 owns `frontend/components/charts/**` + `frontend/lib/charts/**` + `frontend/package.json`. Import only.
- T2 owns `frontend/components/journal/**` (the 5 hand-rolled chart files + 2 toggle hosts + new `ChartToggle.tsx`).
- T4 owns the backend endpoints. T3 may consume `/api/arbitrum/confidence-history` and `/api/arbitrum/vote-breakdown/:id` ONLY if T4 has merged; otherwise use the documented client-side fallback.
- T5 owns the mobile port (Performance Tab only — NO Arbitrum on mobile per TP) and unification.

**Gate to next wave:** T2 + T3 PRs both merged + screenshots posted + TP sign-off. Then T5 begins.

**Critical co-existence requirement:** Sanctum chart-mode renders ArbitrumChamber alongside the SanctumChart TradingView iframe in a `w-1/2` side-by-side layout (`Sanctum.tsx:213-219` left half, `:409` right half). Your overlays must fit the left half without disrupting the existing UX. Master toggle defaults OFF so first-paint is identical to pre-T3.

**Owner pool:** non-Claude-Code (Cursor / Codex / juniors). No inter-track messaging. File ownership is the only conflict-prevention layer.

## Branch Target

`s50-charts` (rebases on top of T1 commit)

**Wave:** 2 (parallel with T2, after T1 merges)
**Complexity:** High
**Estimated:** 3 new chart components + 1 overlays host + ArbitrumChamber wiring, ~450 LOC

## Scope — Included

- [ ] Create `frontend/components/arbitrum/ConfidenceHistoryChart.tsx`:
  - Props: `{ verdicts: Verdict[] }`
  - Renders `<SolvysLine>` of last N verdicts' `consensus_probability` over time.
  - Data: try fetch `/api/arbitrum/confidence-history?limit=50` (T4's endpoint); on 404 or pre-T4-merge, fall back to a `getConfidenceHistory(verdicts: Verdict[])` helper that maps from the `verdicts` prop.
- [ ] Create `frontend/components/arbitrum/VoteBreakdownChart.tsx`:
  - Props: `{ verdict: Verdict | null }`
  - Renders `<SolvysBar>` (horizontal, stacked) — 5 bars labeled Lead / Forecaster / Risk / Quant / Bear, weighted by seat.
- [ ] Create `frontend/components/arbitrum/DissentRadial.tsx`:
  - Props: `{ verdict: Verdict | null }`
  - Renders `<SolvysRadial>` showing dissent magnitude per seat as radial bars around a center confidence number (Doto numeral, tabular).
- [ ] Create `frontend/components/arbitrum/ArbitrumChartOverlays.tsx`:
  - Props: `{ verdicts: Verdict[]; latest: Verdict | null }`
  - Renders a thin header strip with three independent toggle buttons (Confidence / Votes / Dissent), all OFF by default.
  - Stacks the three charts vertically below the toggles, each gated by its own toggle.
  - Persist toggles to `localStorage` keys `s50.arbitrum.overlay.confidence`, `…vote`, `…dissent`.
- [ ] Wire `<ArbitrumChartOverlays>` into `frontend/components/arbitrum/ArbitrumChamber.tsx`:
  - Render below the existing `VerdictCard` block.
  - Add a single "Overlays" text button in the chamber header gating the entire `<ArbitrumChartOverlays>` block (master toggle, OFF by default, persists to `s50.arbitrum.overlays.master`).
- [ ] **Do NOT modify `frontend/components/narrative/Sanctum.tsx` beyond confirming it passes existing props through.** If Sanctum.tsx:266 already passes everything ArbitrumChamber needs, do not touch Sanctum.tsx at all. Overlay toggle is fully internal to ArbitrumChamber.
- [ ] **Do NOT touch SanctumChart.tsx.**
- [ ] **Do NOT remove or modify any `<iframe>`.**
- [ ] **Do NOT change ArbitrumChamber's existing render order** above the new overlay slot.
- [ ] Append one changelog entry to `src/lib/changelog.ts`.

## Scope — Excluded (DO NOT TOUCH)

- T1 wrappers (consume only).
- T2 files (Performance Tab — different track).
- T4 endpoints — define a fallback so T3 ships even if T4 slips.
- Backend changes.
- Mobile (Arbitrum overlays are desktop-only per TP).
- Engine logic in `backend-hono/src/services/arbitrum/`.
- Anything in the global off-limits list.

## Off-Limits (hard ban)

- `frontend/components/chat/slots/TVChartSlot.tsx`
- `frontend/components/narrative/SanctumChart.tsx`
- `frontend/components/RiskFlow*.tsx`
- `frontend/components/IV*` / `NothingFuse*` / `IVStack*`
- `frontend/components/SolvysLoader*.tsx` + `frontend/components/icons/*`
- `frontend/components/regimes/ConfidenceBar.tsx`
- Any `<iframe>` in `frontend/` or `mobile/`
- `frontend/components/narrative/Sanctum.tsx:213-219` (chartMode left-half wrapper) and `:409` (chart-pane right-half block) — DO NOT TOUCH
- `frontend/index.css` (read-only)

## Reuse Inventory

- T1 wrappers at `frontend/components/charts/` — `SolvysLine`, `SolvysBar`, `SolvysRadial`. Import as `@/components/charts/...`.
- Existing `useArbitrumLatest()` hook — search `frontend/hooks/` for it.
- `frontend/components/arbitrum/types.ts` — Verdict / SeatVote / Dissent type defs. Use as-is.
- `frontend/components/arbitrum/VerdictCard.tsx` + `DissentBadge.tsx` — read-only references for color palette / text styling.
- `Sanctum.tsx:213` chartMode prop wiring — model new toggle on the same pattern (but inside ArbitrumChamber, not Sanctum).

## Known Issues to Preserve

- ArbitrumChamber lives inside Sanctum chart-mode at `Sanctum.tsx:266` within a snap-y scrollable left column when `chartMode=true`. Overlays must not break scroll/snap.
- `Sanctum.tsx:409` is the right-half chart-pane (`{chartMode && (…)}`) — DO NOT TOUCH this block.
- "Sanctum header ≠ chamber data" pitfall (memory `feedback_sanctum_button_data_dual_source.md`): SanctumHeader has its own data source. Do NOT wire the overlay toggle through SanctumHeader. Wire it inside ArbitrumChamber locally.
- When `chartMode=true` and Arbitrum is rendered alongside SanctumChart, ArbitrumChamber lives in `w-1/2`. Overlays must fit within the left half without horizontal scroll.

## Implementation Steps

1. **Pull T1 first.** Confirm wrappers exist.
2. Read `frontend/components/arbitrum/ArbitrumChamber.tsx` end-to-end. Note where verdict data is consumed and where to insert the overlay slot (immediately after the VerdictCard render).
3. Read `frontend/components/arbitrum/types.ts`. Use `Verdict`, `SeatVote`, `Dissent` types verbatim. Do NOT redefine.
4. Build `ConfidenceHistoryChart.tsx` with the documented data path + fallback.
5. Build `VoteBreakdownChart.tsx`.
6. Build `DissentRadial.tsx`.
7. Build `ArbitrumChartOverlays.tsx` with the three independent toggles.
8. In `ArbitrumChamber.tsx`, add the overlay slot below VerdictCard. Add the master "Overlays" toggle in the chamber header.
9. **Verify Sanctum.tsx is untouched.** If you find it must change, stop and post to TP — do NOT improvise.
10. Append one changelog entry.
11. Run validation.

## Acceptance Criteria

- [ ] 3 new chart components + 1 overlays host exist under `frontend/components/arbitrum/`.
- [ ] `ArbitrumChamber.tsx` imports `ArbitrumChartOverlays` and renders it gated by master toggle (default OFF).
- [ ] All 4 toggle states (master + 3 per-chart) persist to `localStorage`.
- [ ] `Sanctum.tsx` is either UNTOUCHED or only had whitespace/import changes (verify with `git diff Sanctum.tsx`).
- [ ] No `<iframe>` was modified (`grep -rn iframe frontend/components/arbitrum/ frontend/components/narrative/`).
- [ ] `SanctumChart.tsx` was not modified (`git diff` shows no changes).
- [ ] Master toggle OFF state: ArbitrumChamber visually identical to pre-T3 (TP screenshot).
- [ ] Master toggle ON state: 3 charts available; each independently toggleable.
- [ ] When `chartMode=true` and Arbitrum is rendered alongside SanctumChart, overlays still fit within the left half (`w-1/2`) without horizontal scroll.
- [ ] `tsc --noEmit` passes.
- [ ] `bun run build` clean.
- [ ] **TP screenshot review:** Sanctum chart-mode with overlays OFF, then ON, then each chart toggled.

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && cd frontend && bun run build && cd ..
```

## Commit Format

```
[v5.36.0-alpha.3] feat: T3 Arbitrum chart overlays (confidence/vote/dissent, gated)
```
