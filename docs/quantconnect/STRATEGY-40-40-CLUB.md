# Strategy Execution Profile: 40/40 Club
<!-- claude-code 2026-03-25 | MAJOR REWRITE: 13 corrections from video analysis of live trades (Sprint 0 model refinement) -->
<!-- claude-code 2026-03-03 | Resolved: Anchored VWAP (48h staleness, catalyst-only), footprint chart roadmap replaces DOM heuristic -->
<!-- claude-code 2026-02-28 | Updated with TP answers — scale-in, trailing, fib, PDPT, re-entry -->

## Overview
Liquidity sweep reversal targeting ~35–50 points (mean reversion to 100 EMA). Entry is contrarian against a completed sweep at a Fib retracement zone with Antilag (ATR spike + engulfing candle) confirmation. "40/40 Club" is the model name, not a literal target — actual points and time-in-trade vary.

**Instrument:** /MNQ (execution), /ES (directional bias — soft confirmation, NOT hard requirement)
**Timeframe:** 1000-tick chart (primary), 15-min/1H (context for HTF necklines + RSI divergence)
**Platform:** TopstepX (TradingView-based), Rithmic data/execution

---

## Entry Logic

### Prerequisites
1. Price completes a **sweep into a Fib retracement zone** on the 1000T chart — the sweep must reach the HTF pivot, not just touch the zone edge. An incomplete sweep (too early) leads to stop-outs; this is expected and the re-entry rule handles it.
2. Sweep occurs near **20 EMA or 100 EMA** (contrarian context)
3. **Antilag signal fires** — ATR spike + engulfing candle on the NQ 1000T at the fib/EMA level. ES provides directional bias via intuition (not a hard velocity check). See Antilag section below.
4. RSI (period 20, 15-min) is outside neutral zone (45-55), ideally showing **divergence** on the 15-min chart (price makes lower low, RSI makes higher low)

### Antilag Signal Definition (CORRECTED)
Antilag is **NOT** cross-instrument velocity synchronization. It is:
- **Primary (NQ 1000T):** A spike in ATR accompanied by an engulfing candle at a fib zone or EMA level. The ATR spike must be significantly above the recent average (the move is visually obvious).
- **ES (soft):** Directional bias only — ES is trending in the same direction. TP uses intuition for ES; the algo approximates with a simple trend direction check on ES 500T/1000T.
- **Alternate entry:** A pin bar (instead of engulfing candle) is valid when cross-instrument divergence exists — NQ shows a bearish EMA cross while ES remains bullish (or vice versa). The divergence IS the setup; NQ will play catch-up to ES.
- If the signal isn't visually obvious enough to circle on the chart, it's not Antilag.

### Entry Execution
- **Initial position:** 10 micro contracts (/MNQ)
- **Entry type:** Market order on Antilag confirmation
- **Stop:** Below the **butt of the engulfing candle** (long) / above the top of the engulfing candle (short). This is structural — NOT an ATR multiplier, NOT a fixed distance. If price comes back past the butt of that candle, it will sweep the liquidity that was just created.
- **Target (TP1):** 100 EMA (mean reversion) — primary target
- **Target (TP2/TP3):** Fib extensions (-0.756, -0.828, -0.844) — only if TP1 clears cleanly AND no even-level resistance blocks the path

### Re-Entry Rules
- **Max 3 executions per setup** (not 3 separate setups — same thesis must still be active)
- **First entry may fail** because the sweep wasn't complete (price hadn't reached the HTF pivot). This is expected, not a model failure.
- Re-entry occurs at a **LOWER price** (longs) / higher price (shorts) after the full sweep completes — not retrying the same level
- Fresh Antilag required on each re-entry attempt
- If stopped out 3 times on the same setup → done for the session on that setup

### Fibonacci Framework
- **Fib source:** 1000T context, exact Fib levels (not rounded)
- **Fib entry is a ZONE, not a line** — the area BETWEEN two adjacent fib levels. The sweep occurs at/below the zone floor. Entry is on the reversal back into/above the zone.
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

### Fib Anchoring
- Hybrid: algo auto-detects large moves + Fintheon/RiskFlow fundamental catalyst detection + manual override
- Fibs drawn from **fundamentally driven moves** (not random swings)
- Anchored VWAP co-plotted from same anchor point

### Anchored VWAP Specification
- **Calculation:** Plain anchored VWAP — no bands, no smoothing
- **Anchor points — catalyst-only:** Draw anchored VWAPs exclusively from major fundamental events:
  1. Hot market-moving commentary (e.g. Fed officials, geopolitical statements)
  2. Mag 7 earnings with extreme volatility
  3. Economic data prints that surprise or disappoint expectations
- **Staleness rule:** VWAPs go stale after **48 hours** and are discarded
- **No other anchors:** Do NOT anchor VWAPs to random swings, technical levels, or session opens

---

## Scale-In Logic

### Trigger
- **Antilag fires again mid-trade** while price is respecting the EMA
- Any ATR spike that confirms the trend is still alive and the EMA is holding = scale-in trigger
- This is the same signal as the original entry, just happening again mid-move. No separate "overtaking candle at contested price" ritual needed.

### Sizing
- **+5 micros per scale-in**
- **Max total: 25 contracts** (20 max after 12:30 ET)

### Scale-In Stop
- Same rule as entry stop: **butt of the new engulfing candle** that triggered the scale-in
- If this is higher than the current trailing stop, the trailing stop moves up to this level

---

## Trailing Stop — Structural, Not Mechanical

**Core principle:** The stop anchors to the **butt of engulfing candles** that spike the ATR and respect the EMA. "Right or right out" — if price comes back past the butt of the engulfing candle, it will sweep the liquidity. Get out before that.

### Stop Movement Rules

1. **Initial stop:** Below the butt of the entry engulfing candle (structural)
2. **After retest holds (break-even):** Once price retests the EMA and the EMA defends the move (price bounces off EMA, next candle closes back in trend direction), move stop to break-even or to butt of the engulfing candle — whichever is higher (longs) / lower (shorts)
3. **Subsequent trails:** Each new ATR spike + engulfing candle that respects the EMA → move stop to the butt of that new candle. Creates a "ladder" of stop levels moving in your favor.
4. **100 EMA trail:** When price is extended and ATR > 17 on 3-candle lookback, trail below the 100 EMA

### "EMA Confirms Defense of the Move"
- The trailing stop moves when the 20 EMA **acts as support/resistance** — price tests the EMA, the EMA holds, and price resumes the trend
- "Defense" = the EMA bounced price. THAT is the trigger to trail.
- The stop moves to just below the EMA bounce, NOT a fixed distance below the EMA

### When NOT to Move the Stop
- **During straight-line moves near HTF necklines:** If there's a 15-min neckline to the left that hasn't been retested, give breathing room. Price may need to come back to test that neckline.
- **During news-driven retests:** If a scheduled print fires mid-trade, expect a volatility-driven retest of the impulse origin. Apply Access Denied logic (see below). Do NOT panic-exit — tighten stop after the retest holds.

---

## Access Denied Pattern

**Definition:** In a bullish impulse on the 1000T, the first bearish candle (sometimes 2 candles) = "Access Denied." This does NOT signal reversal — it signals a retest is incoming.

**How it works:**
1. Price is moving in your favor (bullish impulse after entry)
2. The first bearish candle appears (or a pair of bearish candles)
3. This creates a pullback — typically to the 20 EMA or a prior structural level
4. If the retest holds (EMA defends, price closes back in trend direction) → **the move is confirmed**
5. The trade becomes "crystal clear" when price **instantly rejects off the Fast (20) or Slow (100) EMA**

**Trade management response:**
- After Access Denied retest holds → tighten trailing stop to below the retest low
- If price closes above the short-term resistance that caused the Access Denied → move confirmed, stay in
- If the retest DOESN'T hold (EMA breaks) → the stop at the butt of the engulfing candle protects you

---

## Exit Logic

### TP1 (Primary) — 100 EMA Mean Reversion
- Target the 100 EMA as a mean reversion play
- This is the primary exit on most trades

### Even-Price-Level Awareness
- If a round number / even handle (xx,000 / xx,025 / xx,050 / xx,075) sits between current price and the 100 EMA target:
  - Watch for price to stall at the level (2+ small-body / doji candles)
  - If stalling → close the trade. Don't hold through round-number resistance hoping to reach the 100 EMA
  - Example: targeting 100 EMA at 24,280 but price stalls at 24,225 → close at 24,225

### Reverse Trailing TP
- When the market is moving aggressively but you sense risk → **bring the TP closer** (not further)
- Take what the market gives rather than holding for maximum extension
- This is a risk-off exit — guaranteed profit over theoretical maximum
- The TP can trail DOWN toward price, just as the stop trails UP

### TP2/TP3 (Optional)
- Fib extensions: -0.756, -0.828, -0.844
- Only valid if TP1 clears with momentum and no even-level resistance blocks

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

## Cross-Instrument Divergence (Alternate Setup)

When NQ and ES **diverge** (e.g., NQ shows bearish EMA cross while ES remains bullish), the divergence IS the setup:
- NQ will play catch-up to ES (or vice versa)
- Entry: Pin bar at structural level on the lagging instrument
- No full Antilag (engulfing + ATR spike) required — the divergence provides conviction
- Once the lagging instrument catches up and EMAs realign, normal trailing rules apply
- Example from video: NQ bearish 20/100 cross, ES bullish → NQ bounces off EMA, plays catch-up → 100+ point move

---

## Mid-Trade News Handling

If a scheduled economic print releases **during** an active 40/40 Club trade:
1. **Expect** a volatility-driven retest of the impulse origin ("someone didn't want to get left behind, price comes back for their order")
2. **Apply Access Denied logic:** The retest is confirmation, not a threat
3. **If the first bearish candle holds** (EMA defends) → stay in the trade, it's confirmed stronger
4. **Tighten stop** after the retest holds — move to below the retest low
5. **Do NOT exit** on the volatility spike alone

---

## HTF Neckline Awareness

- **15-min swing highs/lows** from prior sessions act as necklines — both targets and gravity points
- The algo must track these and factor them into:
  - **Stop placement:** Don't trail aggressively when a neckline is nearby (give breathing room for retest)
  - **TP targeting:** Necklines can act as resistance before the 100 EMA — apply even-level exit logic
  - **Context:** A bounce off a 15-min neckline on the 1000T is a high-conviction signal

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

---

## Corrections Log (Sprint 0 — Video Analysis)

| # | Correction | Source | Date |
|---|-----------|--------|------|
| 1 | Antilag = ATR spike + engulfing on NQ (not cross-instrument velocity) | Video 2: 40/40 Club Explained NEW | 2026-03-25 |
| 2 | First entry failure = incomplete sweep (expected, re-enter lower) | Video 2 | 2026-03-25 |
| 3 | Access Denied pattern — first bearish candle = retest, not reversal | Video 2 | 2026-03-25 |
| 4 | Trailing stop = EMA defense (bounce off EMA), not fixed distance | Video 2 | 2026-03-25 |
| 5 | Even-price-level exit (close if stalling at round numbers) | Video 2 | 2026-03-25 |
| 6 | Mid-trade news = retest catalyst, stay in if Access Denied holds | Video 2 | 2026-03-25 |
| 7 | Stop trails to butt of engulfing candle (structural anchor) | Video 3: When to move the stop | 2026-03-25 |
| 8 | Don't trail during straight-line moves near HTF necklines | Video 4: 003 CPI Ripper | 2026-03-25 |
| 9 | TP can trail DOWN (reverse trailing — bring TP closer when aggressive) | Video 4: 003 | 2026-03-25 |
| 10 | Pin bar valid entry when cross-instrument divergence exists | Video 5: 004 Divergence | 2026-03-25 |
| 11 | NQ/ES divergence IS the setup (catch-up play), not just confirmation | Video 5: 004 | 2026-03-25 |
| 12 | Scale-in = any mid-trade ATR spike respecting EMA (simplified) | TP narration | 2026-03-25 |
| 13 | Blackout: limit orders only, stop tight (5pts) under wick at 50% reclaim | TP narration | 2026-03-25 |
