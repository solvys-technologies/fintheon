# S7-T3: Fintheon Backtest Strategy Harness

> **Sprint 7, Track 3** — Pine Script v6 backtestable strategy combining T1 + T2 signal logic
> **Depends on**: T1 and T2 must be complete (needs their finalized signal logic)
> **Output**: `docs/tradingview-pine/FINTHEON-Backtest.pine`

---

## Context

This is a `strategy()` that combines signals from both the Fintheon Oscillator (T1) and LQDelta Overlay (T2) into a backtestable format. It builds on the existing PBSR strategy (`PLAYBOOK-Strategy-Backtest.pine`) but adds the new signal layers.

TradingView strategies cannot reference other indicators, so the key signal logic from T1 and T2 must be reimplemented inline.

---

## Files to Read First

1. `docs/tradingview-pine/PLAYBOOK-Strategy-Backtest.pine` — the foundation strategy to extend (read COMPLETELY)
2. `docs/tradingview-pine/FINTHEON-Oscillator.pine` — T1 output (copy the core calculation logic)
3. `docs/tradingview-pine/LQDELTA-Overlay.pine` — T2 output (copy the sweep/staleness/HTF liquidity logic)
4. `docs/quantconnect/ANTILAG-SPEC.md` — ANTILAG specification
5. `docs/autopilot-strategies/STRATEGY-SPECS.md` — 9 strategy specs for session filters and entry rules
6. `backend-hono/src/types/execution-bridge.ts` — signal-ingest JSON schema

---

## File to Create

### `docs/tradingview-pine/FINTHEON-Backtest.pine` (~400 lines)

Pine Script v6 `strategy()`. Overlay = true.

---

## Architecture

This strategy is the PBSR strategy + 3 new confluence layers:

```
EXISTING (from PBSR):
├── Sweep/Reclaim detection (pivot zones, sweep window, reclaim bars)
├── RSI Divergence (Wilder's smoothing, pivot-based)
├── EMA Cross + Retest state machine (20/100 EMA)
├── Volume Delta (buyVol/sellVol)
├── HTF Candlestick Patterns (15m engulfing, hammer, shooting star)
├── Session Filters (morning flush, 40/40 club, lunch flush, power hour)
├── Confidence Scoring (70% base + bonuses)
└── Risk Management (ATR stops, R:R targets, max trades/day)

NEW (from T1 + T2):
├── SMI Ergodic Money Flow filter (from T1 oscillator core)
├── ANTILAG proxy confirmation (from T1 ANTILAG detection)
└── Dual-TF Liquidity Confluence scorer (from T2 HTF liquidity)
```

---

## Implementation Plan

### Section 1: Strategy Declaration (~20 lines)

```pine
//@version=6
strategy("Fintheon Backtest [Priced In Research]"
  , shorttitle = "FBT [PIR]"
  , overlay = true
  , max_lines_count = 500
  , max_labels_count = 500
  , max_boxes_count = 500
  , default_qty_type = strategy.fixed
  , default_qty_value = 1
  , initial_capital = 50000
  , commission_type = strategy.commission.cash_per_contract
  , commission_value = 0.62
  , slippage = 2)
```

### Section 2: Inputs (~60 lines)

Keep all PBSR inputs (core parameters, zone & sweep, risk management, session filters, HTF patterns, visuals).

Add new input groups:

```pine
grpOsc = "7. Oscillator Filter"
use_osc_filter   = input.bool(true, "Use SMI Ergodic Filter", group = grpOsc)
osc_mfi_len      = input.int(13, "MFI Length", group = grpOsc)
osc_smi_long     = input.int(13, "SMI Long Length", group = grpOsc)
osc_smi_short    = input.int(5, "SMI Short Length", group = grpOsc)
osc_signal_len   = input.int(5, "Signal Length", group = grpOsc)

grpAntilag = "8. ANTILAG Filter"
use_antilag      = input.bool(true, "Use ANTILAG Confirmation", group = grpAntilag)
secondary_sym    = input.string("ES1!", "Secondary Instrument", group = grpAntilag)
al_vol_surge     = input.float(1.5, "Volume Surge Threshold (x avg)", group = grpAntilag)
al_price_vel     = input.float(0.3, "Price Velocity Threshold (%)", group = grpAntilag)
al_atr_prox      = input.float(0.3, "EMA Proximity (x ATR)", group = grpAntilag)

grpHTFLQ = "9. HTF Liquidity Confluence"
use_htf_lq       = input.bool(true, "Use HTF Liquidity Confluence", group = grpHTFLQ)
htf_lq_tf        = input.timeframe("60", "HTF Liquidity TF", group = grpHTFLQ)
lq_confluence_tol = input.float(0.5, "Confluence ATR Tolerance", group = grpHTFLQ)
```

### Section 3: Existing PBSR Logic (~200 lines)

Copy sections 2-9 from `PLAYBOOK-Strategy-Backtest.pine` verbatim:
- Indicators (RSI, EMA, ATR)
- Session windows
- Pivot detection & liquidity zones
- Sweep & reclaim detection
- RSI divergence
- EMA cross + retest state machine
- Volume delta
- HTF candlestick patterns
- Daily trade counter

### Section 4: New — SMI Ergodic Filter (~30 lines)

Inline the core oscillator calculation from T1:

```pine
// MarkitTick-style delta
float avg_body_bt = ta.sma(math.abs(close - open), 3)
float avg_vol_bt = ta.sma(volume, 3)
float tp_bt = (high + low + close) / 3.0
float tv_base_bt = tp_bt * volume
float raw_eff = math.abs(close - open) / math.max(volume, 1.0)
float exp_eff = avg_body_bt / math.max(avg_vol_bt, 1e-9)
float eff_mult = math.max(0.2, math.min(raw_eff / math.max(exp_eff, 1e-9), 2.0))

float close_chg = close - close[1]
float thresh = math.abs(open[1] - close[1]) * 0.5
float delta_bt = close_chg > thresh ? tv_base_bt * eff_mult : close_chg < -thresh ? -tv_base_bt * eff_mult : 0.0

// SMI Ergodic smoothing
float sm1 = ta.ema(delta_bt, osc_smi_long)
float sm2 = ta.ema(sm1, osc_smi_short)
float abs1 = ta.ema(math.abs(delta_bt), osc_smi_long)
float abs2 = ta.ema(abs1, osc_smi_short)
float osc_val = abs2 != 0 ? 100.0 * sm2 / abs2 : 0.0
float osc_sig = ta.ema(osc_val, osc_signal_len)

// Filter: oscillator must align with sweep direction
bool osc_bull_ok = not use_osc_filter or osc_val > osc_sig  // oscillator above signal = bullish
bool osc_bear_ok = not use_osc_filter or osc_val < osc_sig  // oscillator below signal = bearish
```

### Section 5: New — ANTILAG Proxy (~30 lines)

```pine
// Primary instrument
float pri_vel = math.abs(close - close[1]) / close[1] * 100.0
float pri_vol_avg = ta.sma(volume, 20)
float pri_vol_ratio = volume / math.max(pri_vol_avg, 1e-9)

// Secondary instrument
[sec_cl, sec_op, sec_vol, sec_vol_avg] = request.security(secondary_sym, timeframe.period, [close, open, volume, ta.sma(volume, 20)])
float sec_vel = math.abs(sec_cl - sec_cl[1]) / sec_cl[1] * 100.0
float sec_vol_ratio = sec_vol / math.max(sec_vol_avg, 1e-9)

// EMA extreme
float ema20_al = ta.ema(close, 20)
float ema100_al = ta.ema(close, 100)
float atr_al = ta.atr(14)
bool at_extreme = math.abs(close - ema20_al) <= atr_al * al_atr_prox or math.abs(close - ema100_al) <= atr_al * al_atr_prox

// Alignment
bool al_aligned = (close > open) == (sec_cl > sec_op)

// ANTILAG fires
bool antilag_fires = use_antilag ? (pri_vol_ratio > al_vol_surge and sec_vol_ratio > al_vol_surge and pri_vel > al_price_vel and sec_vel > al_price_vel and al_aligned and at_extreme) : true
```

### Section 6: New — HTF Liquidity Confluence (~20 lines)

```pine
// Fetch HTF pivots
[htf_ph_val, htf_pl_val] = request.security(syminfo.tickerid, htf_lq_tf, [ta.pivothigh(lengthLS, lengthLS), ta.pivotlow(lengthLS, lengthLS)])
var float htf_high_level = na
var float htf_low_level = na
if not na(htf_ph_val)
    htf_high_level := htf_ph_val
if not na(htf_pl_val)
    htf_low_level := htf_pl_val

// Check confluence: chart-TF sweep zone near HTF zone
bool htf_confluence = false
if use_htf_lq and not na(reclaimedZoneHi) and not na(htf_high_level)
    htf_confluence := math.abs(reclaimedZoneHi - htf_high_level) <= atr * lq_confluence_tol
if use_htf_lq and not na(reclaimedZoneLo) and not na(htf_low_level)
    htf_confluence := htf_confluence or math.abs(reclaimedZoneLo - htf_low_level) <= atr * lq_confluence_tol
```

### Section 7: Enhanced Confidence Scoring (~30 lines)

Replace the PBSR confidence scoring with enhanced version:

```pine
if canTrade
    confidence = 70  // base from sweep + reclaim

    signals = "sweep"

    if rsiDivDir == sweepDir
        confidence += 15
        signals += "+rsiDiv"

    if emaRetestDir == sweepDir
        confidence += 10
        signals += "+emaRetest"

    if htfDirPersist == sweepDir
        confidence += 10
        signals += "+htf(" + htfNamePersist + ")"

    if volDir == sweepDir
        confidence += 5
        signals += "+volDelta"

    // NEW: Oscillator alignment
    if (sweepDir == 1 and osc_bull_ok) or (sweepDir == -1 and osc_bear_ok)
        confidence += 5
        signals += "+oscFlow"

    // NEW: ANTILAG firing
    if antilag_fires
        confidence += 5
        signals += "+antilag"

    // NEW: HTF liquidity confluence
    if htf_confluence
        confidence += 5
        signals += "+htfLQ"

    confidence := math.min(confidence, 100)
```

### Section 8: Entry + Alert Execution (~30 lines)

Same as PBSR for entries/exits, but add alert() for webhook:

```pine
    if sweepDir == 1
        strategy.entry("Long", strategy.long)
        strategy.exit("Long TP/SL", "Long", stop = stopPrice, limit = targetPrice)
        tradesToday += 1
        alert('{"source":"tradingview","strategy":"fintheon_backtest","direction":"long","instrument":"' + syminfo.ticker + '","confidence":' + str.tostring(confidence) + ',"entryPrice":' + str.tostring(close) + ',"stopLoss":' + str.tostring(stopPrice) + ',"takeProfit":[' + str.tostring(targetPrice) + '],"signals":["' + str.replace_all(signals, "+", '","') + '"]}', alert.freq_once_per_bar_close)
```

### Section 9: Visuals + Info Table (~30 lines)

Same as PBSR but updated table to show new confluence sources.

---

## Key Rules

- **This is a `strategy()`, not an `indicator()`** — it must produce tradeable backtests
- **No external library imports** — all logic inline
- **The PBSR logic is the foundation** — do not change its core behavior, only add new filters
- **New filters are additive** — they add to confidence score, they don't gate entries (the base sweep+reclaim is always required)
- **All new filters are toggleable** — `use_osc_filter`, `use_antilag`, `use_htf_lq` can all be turned off to match pure PBSR performance
- **Alert JSON must match the signal-ingest schema** — see `backend-hono/src/types/execution-bridge.ts`

---

## DO NOT

- Do NOT modify T1 or T2 files
- Do NOT create this file until T1 and T2 are complete (you need their finalized calculation logic)
- Do NOT change PBSR's core sweep/reclaim detection logic
- Do NOT add VWAP
- Do NOT import external Pine libraries

---

## Verification

1. Paste into TradingView Pine Editor → must compile with zero errors
2. Add as strategy to NQ 5m chart → verify trades appear in strategy tester
3. Run backtest over 3+ months → capture: net profit, win rate, profit factor, max drawdown
4. Turn OFF all new filters (osc, antilag, htf_lq) → results should match PBSR baseline
5. Turn ON each filter individually → compare improvement
6. Test on 1000T chart → verify no errors
7. Test on 15m chart → verify no errors
8. Create test alert → verify JSON payload matches signal-ingest schema format
9. Verify info table shows all confluence sources

---

## Changelog Entry

```typescript
{ date: '2026-04-04T14:00:00', agent: 'claude-code', summary: 'S7-T3: Created Fintheon Backtest strategy — PBSR + SMI Ergodic filter + ANTILAG proxy + HTF liquidity confluence, enhanced 115-point confidence scoring, webhook alerts', files: ['docs/tradingview-pine/FINTHEON-Backtest.pine'] }
```
