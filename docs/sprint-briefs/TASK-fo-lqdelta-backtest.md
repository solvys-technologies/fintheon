# Task Brief: Fintheon Oscillator + LQDelta Overlay Backtest
**Date:** 2026-04-04
**Scope:** Walk-forward backtest of the FO+LQDelta tandem signal system on NQ 1000T, documenting signal quality, win rates, and parameter recommendations.
**Estimated files:** 1 deliverable (`docs/backtest-reports/FO-LQDELTA-backtest-2026-04.md`)

## Context
The Fintheon Oscillator V4 was just rebuilt from scratch — LuxAlgo Oscillator Matrix-inspired architecture with Money Flow (MFI), Hyper Wave (QQE), Overflow, ANTILAG (dual-instrument NQ+ES exhaustion), and RSI-based reversal dots. It pairs with the LQDelta Overlay on the price chart. Both are Pine Script v6 indicators for TradingView.

This backtest validates whether the tandem system produces actionable signals aligned with the 40/40 Club strategy model before going live on TopStepX.

## Files to Read First
- `docs/tradingview-pine/FINTHEON-Oscillator.pine` — the oscillator (431 lines, full V4)
- `docs/tradingview-pine/LQDELTA-Overlay.pine` — the overlay (liquidity zones, delta candles, EMA cross)
- `docs/quantconnect/ANTILAG-SPEC.md` — ANTILAG signal definition (tick velocity + directional alignment + EMA extreme + volume)
- `docs/quantconnect/STRATEGY-40-40-CLUB.md` — primary strategy: liquidity sweep + fib retracement + ANTILAG confirmation, targeting 100 EMA mean reversion
- `docs/sprint-briefs/S7-T1-fintheon-oscillator.md` — oscillator architecture spec

## How the Two Indicators Work in Tandem

### LQDelta Overlay (WHERE to trade)
- **Liquidity Zones**: Pivot-based boxes on the price chart (chart-TF + HTF 60m). Zones auto-delete on sweep or after 200 bars staleness. Gold highlight when chart-TF and HTF zones overlap (confluence).
- **Volume Delta Candles**: Intrabar coloring showing real buy/sell pressure per candle. Positive delta on bearish candles = hidden buying.
- **EMA Cross**: 20/100 EMA with cross + retest signals. Slow EMA (gold, width 2) is the mean-reversion target. HTF 15m EMA cross alerts fire independently.
- **Sweep Labels**: Gold labels appear when price sweeps through a liquidity zone. The zone is immediately deleted.

### Fintheon Oscillator (WHEN to trade)
- **Money Flow (MFI)**: 0-100 raw, EMA(3) smoothed, displayed 35-65 scale centered at 50. Above 50 = buying pressure dominant. Below 50 = selling dominant. The fill from center tells you who's in control.
- **Overflow**: `EMA(mf,3) - EMA(mf,10)` clamped to 40-60 display. Sits inside MF fills. When overflow is visible and MF is at threshold extremes = excess participants, reversal imminent.
- **Hyper Wave (QQE)**: Weighted RSI (weight=2.0 when aligned with trend, 1.0 against) → double-smoothed → adaptive trailing stop (factor=4.236). HW above trail = bullish (gold line), below = bearish (grey line). Trail line is hidden; only the fill ribbon shows the boundary. Ribbon narrowing = "coiling" = breakout imminent.
- **ANTILAG**: Fires when PRIMARY (chart symbol) AND SECONDARY (ES1!) both show: volume ratio > 1.5× 20-bar average AND price velocity > 0.3% AND same direction AND price within 0.3 ATR of 20 or 100 EMA. This is **contrarian** — velocity spike INTO the EMA = exhaustion, not continuation. Gold triangle labels appear above/below the confluence bar at the bottom.
- **Reversal Dots**: Small dots (auto size) = RSI divergence (price HL + RSI LH, or vice versa) OR HW sentiment flip (HW crosses trailing stop while MF confirms). Medium gold dots (small size) = ANTILAG + any reversal condition. These are the highest-conviction signals.
- **Confluence Bar**: Gradient strip at bottom (y=-4 to 0). Scores MF direction + HW direction + threshold proximity. Gold = bullish, grey = bearish/neutral.

### The Tandem Read (40/40 Club Entry)
1. **LQDelta**: Price sweeps a low zone near 20 or 100 EMA → sweep label fires, zone deleted
2. **FO Money Flow**: Below 50 (selling territory) but NOT at lower threshold extreme (= weak sellers, not real selling pressure)
3. **FO Hyper Wave**: Crosses above trailing stop (gold line appears, sentiment flips bullish)
4. **FO ANTILAG**: Fires (both NQ and ES show velocity exhaustion at EMA) → gold triangle appears
5. **FO Reversal Dot**: Medium gold dot appears (ANTILAG + RSI divergence or HW flip)
6. **Entry**: Long. Stop below engulfing candle butt. Target: 100 EMA mean reversion.

## What to Build

### `docs/backtest-reports/FO-LQDELTA-backtest-2026-04.md`
- **Path:** `docs/backtest-reports/FO-LQDELTA-backtest-2026-04.md`
- **Action:** Create
- **Max lines:** 300

Walk through the last 5 RTH sessions on NQ1! 1000T with both indicators applied. For each session:

#### Signal Log Table
| # | Time (ET) | Price | Direction | LQDelta Signal | FO Signal(s) | Confluence | Outcome | Points | Bars to Target |
|---|-----------|-------|-----------|----------------|-------------|------------|---------|--------|----------------|

#### Per-Signal Analysis
For each signal in the log:
1. What fired on LQDelta? (sweep, EMA retest, confluence zone, delta divergence)
2. What fired on FO? (MF position, HW state, overflow, ANTILAG, reversal dot type)
3. Did both indicators agree? Which component was the deciding factor?
4. Outcome: reversal? How many points? How long?
5. If the signal failed — why? What was missing?

#### Edge Cases to Document
- ANTILAG during news events (first 120s after econ print = unreliable per spec)
- Stale liquidity zones (do they auto-delete at 200 bars?)
- HW coiling (narrow ribbon) — does it predict breakout direction?
- Overflow excess at MF threshold extreme — does it precede reversals?
- False ANTILAG fires — when velocity spikes but no reversal follows

#### Summary Statistics
- Total signals per type (standard reversal, ANTILAG reversal, ANTILAG only)
- Win rate per type (reversal happened within 20 bars)
- Average points gained on winners
- Average points lost on losers
- Best signal combination (which LQDelta + FO component pairing has highest win rate)

#### Parameter Sensitivity Notes
Test if changing these defaults improves signals:
- MF Length: 14 (default) vs 10, 20
- HW QQE Factor: 4.236 (default) vs 3.0, 5.0
- HW Smoothing: 5 (default) vs 3, 8
- ANTILAG Velocity: 0.3% (default) vs 0.2%, 0.5%
- ANTILAG Volume Surge: 1.5× (default) vs 1.2×, 2.0×

## Key Rules
- **Chart setup**: NQ1! 1000T, RTH only (8:00-16:00 ET), ES1! as ANTILAG secondary
- **Both indicators must be applied simultaneously** — the tandem read is the point
- **ANTILAG is contrarian** — velocity spike INTO EMA = exhaustion, NOT continuation. If price is flying away from the EMA, that's momentum, not ANTILAG.
- **Entry model is 40/40 Club** — liquidity sweep at fib zone + ANTILAG + mean reversion to 100 EMA
- **Stop is structural** — below the butt of the engulfing candle, not an ATR multiplier
- **The gold palette is intentional** — bull = `#c79f4a`, bear = `#6b6b6b`. No green/red.
- **Max 3 re-entries per setup** — same thesis must still be active

## DO NOT
- Modify either Pine Script file — this is a read-only backtest
- Change chart settings or indicator parameters during the walkthrough (document recommendations separately)
- Add features or suggest code changes — the deliverable is a signal quality report
- Touch any files outside `docs/backtest-reports/`

## Verification
```bash
# Verify the report file was created
ls docs/backtest-reports/FO-LQDELTA-backtest-2026-04.md

# Verify it's under 300 lines
wc -l docs/backtest-reports/FO-LQDELTA-backtest-2026-04.md
```

## Changelog Entry
```typescript
{
  date: '2026-04-04T18:00:00',
  agent: 'claude-code',
  summary: 'Backtest report: FO+LQDelta tandem signal system on NQ 1000T — signal log, win rates, parameter sensitivity',
  files: ['docs/backtest-reports/FO-LQDELTA-backtest-2026-04.md']
}
```

## Post-Push Memory Update
After completing the backtest, log any discovered bugs, false signal patterns, or parameter insights to memory:
1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/project_fo_backtest_findings.md`
2. Add pointer to `MEMORY.md` under "Active Projects"
3. Skip if no actionable findings.
