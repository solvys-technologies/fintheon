# Strategy Execution Profile: 40/40 Club
<!-- claude-code 2026-03-03 | Resolved: Anchored VWAP (48h staleness, catalyst-only), footprint chart roadmap replaces DOM heuristic -->
<!-- claude-code 2026-02-28 | Updated with TP answers — scale-in, trailing, fib, PDPT, re-entry -->

## Overview
Liquidity sweep reversal targeting ~40 points, typically firing ~40 minutes into the hourly candle. Entry is contrarian against a sweep at a Fib retracement level with Antilag confirmation.

**Instrument:** /MNQ (execution), /ES (confirmation only)
**Timeframe:** 1000-tick chart (primary), 15-min/1H (context)
**Platform:** TopstepX (TradingView-based), Rithmic data/execution

---

## Entry Logic

### Prerequisites
1. Price sweeps a **Fibonacci retracement level** on the 1000T chart
2. Sweep occurs near **20 EMA or 100 EMA extreme** (contrarian setup)
3. **Antilag signal fires** (see ANTILAG-SPEC.md) — composite read on tick velocity + volume + directional alignment across NQ (1000T) and ES (500T)
4. RSI (period 20, MA 20, 15-min) is outside neutral zone (45-55) indicating mean-reversion potential

### Entry Execution
- **Initial position:** 10 micro contracts (/MNQ)
- **Entry type:** Market order on Antilag confirmation
- **Stop:** Below the sweep wick (long) / above the sweep wick (short)
- **Target (TP1):** 100 EMA — **always takes precedence** over aggressive extension targets
- **Target (TP2/TP3):** Fib extensions (-0.756, -0.828, -0.844) — optional, only if TP1 clears cleanly

### Re-Entry Rules
- **Max 3 executions per setup** (not 3 separate setups — same thesis must still be active)
- Re-entry criteria for attempts 2 and 3:
  1. Original setup thesis remains intact (same fib level, same directional bias)
  2. Price structure hasn't broken — no clean break through the fib zone
  3. Antilag re-confirms on the new approach (fresh signal required)
- If stopped out 3 times on the same setup → done for the session on that setup

### Fibonacci Framework
- **Fib source:** 1000T context, exact Fib levels (not rounded)
- **Zone classification** (determines conviction/sizing, NOT eligibility):
  - **Ripper zone (0.222–0.361):** Highest conviction, full size
  - **Strong zone (0.414–0.618):** Standard conviction
  - **Weak zone (0.757–0.85):** Lower conviction, reduced size or skip
- Any zone CAN fire — zone does not gate eligibility
- **Boundary rule:** Price landing exactly ON a fib level belongs to the zone below it

### Fib Invalidation
- Discard a fib level when:
  1. **Price disrespects it** — clean break through with follow-through, not just a wick
  2. **News event warrants a fresh fib** — fundamental catalyst shifts the regime
- When invalidated: the old fib level becomes a **TP target only** — do not enter new trades at it
- Rationale: avoid trading the clash between two competing fib regimes during a sentiment shift

### Fib Anchoring
- Hybrid: algo auto-detects large moves + Pulse/OpenClaw fundamental catalyst detection + manual override
- Fibs drawn from **fundamentally driven moves** (not random swings)
- Anchored VWAP co-plotted from same anchor point

### Anchored VWAP Specification
- **Calculation:** Plain anchored VWAP — no bands, no smoothing
- **Anchor points — catalyst-only:** Draw anchored VWAPs exclusively from major fundamental events:
  1. Hot market-moving commentary (e.g. Fed officials, geopolitical statements)
  2. Mag 7 earnings with extreme volatility
  3. Economic data prints that surprise or disappoint expectations
- **Staleness rule:** VWAPs go stale after **48 hours** and are discarded
- **No other anchors:** Do NOT anchor VWAPs to random swings, technical levels, or session opens — only the fundamental catalysts above

---

## Scale-In Logic

### Trigger (same for all three models)
- First 1000T candle closure **≥55% of 3-candle lookback ATR distance from 100 EMA**
- Then requires its own mini-setup:
  - **"Overtaking candle at a contested price"** — the engulfing candle that clears the 20 EMA
  - Scale-in entry placed at the overtaking candle's confirmation close
  - Scale-in stop placed **3–5 points below the overtaking candle's low** (long) / above the high (short)

### Sizing
- **+5 micros per scale-in**
- **Max total: 25 contracts** (20 max after 12:30 ET)

### Break-Even Logic
- After scale-in, stop moves to break-even when:
  1. Price **retests the EMA** after overtaking it
  2. Then **closes above the contested price** (the level that was overtaken)
- This is structure-based, NOT a fixed point offset

---

## Trailing Stop — 4 Phases (Chunky, Not Granular)

**Core principle:** Stop moves in chunks at structural levels, NOT tick-by-tick. Each move requires a structural event (overtaking a contested price, clearing a fib, passing a quarter-point/cycle level).

1. **Phase 1:** Below sweep wick (initial)
2. **Phase 2:** Break-even after scale-in — triggered by EMA retest + close above contested price (see Break-Even Logic above)
3. **Phase 3:** 5–7 points below the 20 EMA, snapped to cycle levels, on 1000T candle closures
   - Stop moves **only when** price clears a quarter-price point or cycle level AND retests past the fib AND overtakes a contested price
   - Do NOT move stop on every candle close — wait for structural confirmation
4. **Phase 4:** 100 EMA trail when ATR > 17 on 3-candle lookback

### Cycle Levels
- **25-pt increments** when ATR ≤ 15
- **50-pt increments** when ATR > 15
- 20-candle lookback for ATR calculation

---

## Exit Logic

### TP1 (Primary)
- 100 EMA — **always takes precedence** over extension targets

### TP2/TP3 (Optional)
- Fib extensions: -0.756, -0.828, -0.844
- Only valid if TP1 clears with momentum

### PDPT (Personal Daily Profit Target)

**Combine mode ($50K account):**
- **Hard cap: $1,550** → lockout, no more trades
- When $50–$100 remaining to PDPT: tighten limit orders to lock in

**Funded mode:**
- **Trailing target averaging ~$1,500/day**
- Acceptable daily range: **$1,300–$2,000**
- No hard lockout — uses trailing stops to protect gains
- Algo should have a `mode` flag: `combine` vs `funded` that switches behavior

---

## ORB Filter
- Open Range Breakout context from first 15 minutes
- Not a trade signal — used to calibrate directional bias for the session

---

## Exit Enhancement — Footprint Chart (Roadmap)

> **DOM heuristic: SKIPPED.** TP's visual DOM reads cannot be replicated without real-time order book data.
>
> **Future enhancement:** Rithmic's TICKER_PLANT WebSocket exposes raw tick-by-tick data (trade price, volume, BBO) that Harper can use to construct:
> - **Footprint charts** — classify each trade as buyer/seller-initiated via BBO comparison, aggregate delta per price level per bar
> - **Anchored volume profile** — aggregate volume at each price level, anchor to the same VWAP catalyst points
>
> This is a **build** (custom aggregation from raw tick stream), not a plug-in. The `async_rithmic` Python library (MIT, production-stable) wraps the Protocol Buffer API. Bandwidth caveat: Rithmic standard plans cap at ~40GB/week; DOM/depth data is significantly heavier than price-only feeds.
>
> **Priority:** Post-MVP. Ship 40/40 Club with price-action exits first, add footprint chart data as a V2 enhancement.
