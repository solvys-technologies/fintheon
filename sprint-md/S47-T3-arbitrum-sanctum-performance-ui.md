# Sprint Brief: T3 -- Arbitrum, Sanctum, Performance, and Proposal UI

## Context

Arbitrum currently has naming drift, duplicate/imbalanced layout, stale PMDB presentation, incorrect score formats, and proposal/performance confusion. This track owns the desktop UI side after T2 stabilizes backend contracts.

## Branch Target

`s47-wave2-arbitrum-ui`

## Scope -- Included

- [ ] Fix Arbitrum visible naming and role labels.
- [ ] Rename Desk Theme to Desk Plan in frontend surfaces.
- [ ] Align Volatility Read and Arbitrum Chamber hero headers and enforce 50/50 desktop split.
- [ ] Remove duplicate chart/analysis rendering when TradingView iframe is off.
- [ ] Remove upload button from Arbitrum toolbar.
- [ ] Replace lightning Update icon with refresh icon plus `Update`.
- [ ] Convert confidence/health/fuse values to 0.0-10.0 where required.
- [ ] Remove crowd fuse and Agent Performance section from Arbitrum.
- [ ] Move proposal/paper-trade progress to Performance > Agents and Proposals side pane.
- [ ] Add market resolve countdown column to Trade Ledger.
- [ ] Remove category pill from Active Narratives and add time-ago stamp to Risk Signal related headlines.

## Scope -- Excluded (DO NOT TOUCH)

- Backend Arbitrum/PMDB/proposal logic owned by T2.
- Shared fuse/icon primitives owned by T6; this track may consume existing components only.
- Chat/Agentic Forum UI owned by T4.
- RiskFlow expanded card redesign owned by T6.

## Reuse Inventory

- `ArbitrumChamber` at `frontend/components/arbitrum/ArbitrumChamber.tsx:178` -- current five-seat chamber rendering.
- `VerdictCard` at `frontend/components/arbitrum/VerdictCard.tsx:15` -- consensus/confidence card.
- `ArbitrumPeek` at `frontend/components/arbitrum/ArbitrumPeek.tsx` -- hover/peek surface.
- `Sanctum` at `frontend/components/narrative/Sanctum.tsx` -- hosts Aquarium/Arbitrum surface.
- `AquariumPredictionCards` at `frontend/components/narrative/AquariumPredictionCards.tsx` -- instrument cards/fuses.
- `InstrumentCardsRow` at `frontend/components/narrative/InstrumentCardsRow.tsx` -- instrument card row.
- `NothingFuse` at `frontend/components/shared/NothingFuse.tsx:46` -- consume only; do not edit unless coordinated with T6.
- `DigitGroup` at `frontend/components/shared/DigitGroup.tsx` -- Doto numeric animation.
- Existing proposal/performance components under `frontend/components/proposals/` and `frontend/components/performance/`.

## Known Issues to Preserve

- The underlying Sanctum subview id may remain `aquarium` for route/backend compatibility.
- Do not use gradients, emoji, Kanban borders, or AI-sparkle/shimmer ornamentation.
- Use Solvys Gold palette and existing Fintheon visual language.

## Implementation Steps

1. Read current Arbitrum/Sanctum components and identify all user-visible `Desk Theme`, old seat labels, `Neutral`, percent-confidence strings, upload buttons, and lightning icons.
2. Change visible seat labels to Harper, Oracle, Feucht, Consul, Herald while keeping subtitles from T2 backend contract.
3. Rename visible `Desk Theme` strings to `Desk Plan`; avoid DB/API renames unless T2 confirms safe contract changes.
4. Update hero layout with equal flex/grid columns at desktop and stacked mobile. Align headers optically, not just via fixed heights.
5. Remove duplicate chart/analysis section when TradingView iframe is disabled. Place analysis under consensus card.
6. Remove the upload button and replace Update icon with `RefreshCw` plus Update label.
7. Remove the explanatory VIX component score sentence from Volatility Read.
8. Convert confidence displays from percent to 0.0-10.0 in visible Arbitrum UI. Keep backend raw 0-1 contract if present.
9. Replace Crowd Fuse with IV score and Health Fuse with Confidence Rating.
10. Remove Arbitrum Agent Performance section and wire a clear route/link to Performance > Agents if needed.
11. Update Proposals pane styling if it is visibly not theme-sensitive; use existing Solvys surface styles.
12. Add Trade Ledger market-resolve countdown column using existing close/resolution timestamp if available. If backend field is missing, show `Pending backend` only in development comments, not UI.
13. Remove category display from Active Narratives and right-align time-ago on related headlines.
14. Add/update changelog entry.

## Acceptance Criteria

- [ ] Arbitrum UI shows correct seat names and roles.
- [ ] Desk Plan replaces Desk Theme in visible UI.
- [ ] Volatility Read and Arbitrum Chamber are aligned and equal width on desktop.
- [ ] Confidence reads as 0.0-10.0, not percent, where requested.
- [ ] Arbitrum no longer shows duplicate chart/analysis, upload button, crowd fuse, or Agent Performance.
- [ ] Trade Ledger shows resolve countdown when data exists.

## Validation Commands

```bash
# Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build
```

## Commit Format

```bash
[v5.34.0] fix: T3 repair Arbitrum and proposal UI
```
