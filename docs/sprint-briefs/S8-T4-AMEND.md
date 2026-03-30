# S8-T4 AMENDMENT: Aquarium — Remove IV Risk Bars

**Branch**: `v.8.28.1`
**Context**: T4 is 93% done. One item remains.

## THE GAP

### IV Risk Bars Still Rendering on Page 0 (NOT DONE)
File: `frontend/components/narrative/SanctumChart.tsx`
- Lines 42-44: `CATS` array still defined
- Lines 487-490: Canvas element for IV bars still renders
- Line 442: `drawBars()` still called

## FIX
In `SanctumChart.tsx`:
1. Remove the `<canvas>` element that renders IV risk bars (the small colored bars below the TradingView chart)
2. Remove `drawBars()` function and its call
3. Remove `CATS` array if no longer referenced
4. Keep the TradingView chart itself — only remove the bars overlay below/beside it

## VERIFICATION
1. Aquarium Page 0: TradingView chart renders, NO colored IV bars below it
2. Prediction cards still visible and centered
3. KPI cards still render
4. `npx vite build` — clean

## DO NOT
- Do NOT modify the TradingView chart integration
- Do NOT touch Page 1 or Page 2
- Do NOT modify backend
