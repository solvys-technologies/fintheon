# Sprint Brief: S23-T1 — ArbitrumChamber UI Restructure + solvys-feels Polish

## Context

The ArbitrumChamber surface (Sanctum Page 0) currently leads with a large QQQ TradingView chart, then KPI cards, instrument cards, analysis, key findings, and a right-side MiroShark Deliberation panel with DEBATE and PROPOSALS buttons. A redundant TradingView iframe toggle also lives inside the Proposals panel. TP wants the top chart gone, the top region rebuilt as a side-by-side container matching the Dashboard brief/session-calendar pattern (Blended IV + Next Session Forecast on the left, Deliberation on the right), the DEBATE button replaced with a Chart button that toggles a full 50/50 split with a TradingView iframe, and the Proposals-panel iframe removed.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] Remove `<SanctumChart />` render at the top of [frontend/components/narrative/Sanctum.tsx](../../frontend/components/narrative/Sanctum.tsx) (Page 0)
- [ ] Build new top container replicating the pattern at [frontend/components/executive/MainDashboard.tsx:321-395](../../frontend/components/executive/MainDashboard.tsx): `flex-1 border border-[var(--fintheon-accent)]/12 rounded-xl min-h-[520px]`, flex-[55]/flex-[45], needle divider
- [ ] Left half: stacked `BlendedVIXCard` + `NextSessionForecastCard` (reuse existing hooks/data)
- [ ] Right half: `MiroSharkDebatePanel` promoted into this slot (remove any absolute/drawer positioning)
- [ ] Replace DEBATE button in panel header with CHART button (Lucide `LineChart` icon)
- [ ] Wire CHART toggle to page-level `chartOpen` state that renders a full-width TradingView iframe overlay, replacing all ArbitrumChamber content until toggled off
- [ ] Remove TradingView iframe toggle from the Proposals panel (locate via grep for `TradingView` / iframe refs under `frontend/components/`)
- [ ] Restack KPI cards, instrument cards (/NQ /ES /YM /CL /GC), Analysis paragraph, Key Findings, Harper Analysis below the new top container with unified feels polish

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/**` (T3 + T4 territory)
- `miroshark-service.ts` or any backend ArbitrumChamber service
- Theme files ([frontend/contexts/ThemeContext.tsx](../../frontend/contexts/ThemeContext.tsx), [frontend/lib/theme.ts](../../frontend/lib/theme.ts))
- Mobile PWA (`mobile/**`)
- Deliberation polling logic — T2 owns it

## Known Issues to Preserve

- Recent changelog (2026-04-17) — bulletin flush on close + PWA icons + toolbar feels pass. Do not revert.
- Deliberation state machine + 3s polling — T2 touches it, don't pre-optimize here.
- `SanctumChart.tsx` component file stays; it is re-rendered inside the new full-screen Chart overlay.

## Implementation Steps

1. Grep for every call site of `SanctumChart`, `MiroSharkDebatePanel`, Proposals-panel TradingView iframe to inventory affected imports.
2. Extract the new top container into a local subcomponent `ArbitrumChamberBriefBand` within `Sanctum.tsx` (or colocate under `frontend/components/narrative/`). Match Dashboard pattern exactly.
3. Remove the TradingView iframe toggle from the Proposals panel and delete the now-unused toggle button/state.
4. Update `MiroSharkDebatePanel` header: swap DEBATE label + icon for Chart (Lucide `LineChart`), rename onClick handler, thread `onToggleChart` prop up to `Sanctum.tsx`.
5. Add `chartOpen` state in `Sanctum.tsx`. When true, render a full-width TradingView overlay via the existing `SanctumChart` component; when false, render the new brief-band + stacked cards layout.
6. Apply feels polish to all ArbitrumChamber cards: `bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-md px-4 py-3`, monospace for numeric values, Inter for labels at 72% opacity, no emoji, no gradient, no shadow.
7. Verify no hex literals remain in touched components — all colors via CSS custom properties.
8. Theme smoke: cycle all 5 presets from [frontend/lib/theme.ts](../../frontend/lib/theme.ts) (solvys-gold, ios, project-x, dark-trading, miami-heat) and confirm no color regressions.
9. Add changelog entry in [src/lib/changelog.ts](../../src/lib/changelog.ts) + top-of-file `// [claude-code 2026-04-17]` comment on substantially modified files.

## Acceptance Criteria

- [ ] ArbitrumChamber loads with no top QQQ chart
- [ ] New top container matches Dashboard brief pattern (border, radius, needle divider, flex-[55]/[45])
- [ ] Blended IV card stacked above Next Session Forecast card on the left; Deliberation on the right
- [ ] CHART button present in Deliberation header; DEBATE button gone
- [ ] CHART toggle renders a full-width TradingView iframe; toggle-off restores ArbitrumChamber view
- [ ] Proposals panel contains no TradingView iframe toggle
- [ ] All new styling uses CSS custom properties, no hex literals
- [ ] All 5 theme presets render without color regressions
- [ ] Changelog entry added

## Validation Commands

```bash
cd frontend
npx tsc --noEmit
rm -rf dist
bun run build
```

## Commit Format

```
[v.04.17.1] feat: S23-T1 arbitrumChamber UI restructure + feels polish
```
