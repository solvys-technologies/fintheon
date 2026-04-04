# S7-T1: Fintheon Oscillator [Priced In Research]

> **Sprint 7, Track 1** — New Pine Script v6 separate-panel oscillator indicator
> **Depends on**: Nothing (runs in parallel with T2)
> **Output**: `docs/tradingview-pine/FINTHEON-Oscillator.pine`

---

## Context

We're building a proprietary oscillator for TradingView that combines:
- **MarkitTick LFA Engine** logic for raw volume delta with efficiency multiplier
- **SMI Ergodic** double-smooth architecture for clean oscillator output
- **LuxAlgo Oscillator Matrix** visual layout (proximity maps, confluence bars, signal dots)
- **Fintheon ANTILAG** dual-instrument momentum detection

This is a **separate panel indicator** (overlay=false). It pairs with the LQDelta Overlay (T2) on the price chart.

The indicator must work on **all timeframes** including 1000-tick charts on NQ/ES futures.

---

## Files to Read First

These contain the reference logic and specifications:

1. `docs/tradingview-pine/PLAYBOOK-Strategy-Backtest.pine` — existing PBSR strategy with RSI divergence, EMA cross/retest, volume delta, HTF patterns, confidence scoring
2. `docs/quantconnect/ANTILAG-SPEC.md` — full ANTILAG specification (tick velocity + directional alignment + EMA extreme + volume)
3. `docs/quantconnect/STRATEGY-40-40-CLUB.md` — sweep zones, fib context, ANTILAG in practice
4. `docs/autopilot-strategies/STRATEGY-SPECS.md` — 9 strategy specs with ANTILAG usage
5. `backend-hono/src/services/algo-engine/indicators.ts` — EMA, RSI, ATR implementations (Wilder's smoothing)
6. `.firecrawl/tradingview-script.md` — LuxAlgo Oscillator Matrix documentation (visual reference)

---

## File to Create

### `docs/tradingview-pine/FINTHEON-Oscillator.pine` (~800 lines)

Pine Script v6 indicator. **No external library imports** — all logic inline.

---

## Architecture (top to bottom in panel)

```
┌── UPPER PROXIMITY MAP ──┐  dim heatmap bar, lights within 3 ATR of unswept pivot zone
├── SIGNAL DOTS ───────────┤  small circle=high-freq, mid label_up/down=strong reversal
├── MAIN OSCILLATOR ───────┤
│  • SMI Ergodic line (MarkitTick delta → double-EMA smoothed)
│  • Signal line (EMA of oscillator)
│  • Histogram (osc - signal, gradient colored)
│  • Dynamic Zones (percentile adaptive OB/OS)
│  • ANTILAG ribbon (dual-instrument momentum glow via bgcolor)
├── LOWER PROXIMITY MAP ──┤  mirror of upper
└── CONFLUENCE BAR ────────┘  overall bullish/bearish alignment of all components
```

---

## Section-by-Section Specification

### Section 1: Indicator Declaration + Constants (~30 lines)

```pine
//@version=6
indicator("Fintheon Oscillator [Priced In Research]"
  , shorttitle = "FO [PIR]"
  , overlay = false
  , max_lines_count = 500
  , max_labels_count = 500
  , max_boxes_count = 500
  , format = format.price
  , precision = 2)
```

Constants:
- `EPSILON = 1e-9`
- `GRADIENT_STDEV_LEN = 50`
- Solvys Gold hex: `ACCENT = #c79f4a`, `BG = #050402`, `TEXT = #f0ead6`

### Section 2: User Inputs (~120 lines)

Group these exactly as listed:

| Group | Inputs |
|-------|--------|
| **1. Instruments** | `secondary_symbol` input.string("ES1!", "Secondary Instrument"), `use_secondary` input.bool(true) |
| **2. MTF Settings** | `htf_mode` input.string("Fixed TF" / "Multiple of chart TF"), `fixed_tf` input.timeframe("15"), `tf_multiplier` input.int(1), `mtf_smoothed` input.bool(true), `repainting` input.string("On" / "Off") |
| **3. Core Oscillator** | `mfi_source` input.source(close), `mfi_length` input.int(13), `smi_long` input.int(13), `smi_short` input.int(5), `signal_length` input.int(5) |
| **4. Efficiency** | `efficiency_length` input.int(3), `eff_min_cap` input.float(0.2), `eff_max_cap` input.float(2.0), `momentum_threshold` input.float(0.5) |
| **5. ANTILAG** | `antilag_vol_surge` input.float(1.5), `antilag_price_velocity` input.float(0.3), `antilag_ema_fast` input.int(20), `antilag_ema_slow` input.int(100), `antilag_atr_proximity` input.float(0.3) |
| **6. Proximity Maps** | `show_maps` input.bool(true), `zone_atr_distance` input.float(3.0), `map_pivot_lookback` input.int(7), `map_max_zones` input.int(30) |
| **7. Dynamic Zones** | `dz_sample_length` input.int(50), `dz_pct_above` input.float(90), `dz_pct_below` input.float(90) |
| **8. Signals** | `show_reversal_dots` input.bool(true), `show_strong_signals` input.bool(true), `show_divergences` input.bool(true), `show_price_divs` input.bool(true), `div_confirm_bars` input.int(5), `labels_text_mode` input.string("Off" / "Symbols Only" / "Full") |
| **9. Visuals** | All `input.color` — accent `#c79f4a`, bull `#089981`, bear `#f23645`, osc_line `#c79f4a`, signal_line `color.gray`, histogram_bull `#089981`, histogram_bear `#f23645` |
| **10. Dashboard** | `show_dashboard` input.bool(true) |
| **11. Alerts** | Individual bool toggles per alert type |

### Section 3: Type Definitions (~60 lines)

Use Pine v6 `type` keyword:

```pine
type FintheonEngine
    float delta_current      = 0.0    // MarkitTick-style weighted volume delta
    float efficiency_mult    = 1.0    // body/volume efficiency ratio
    float osc_value          = 0.0    // SMI Ergodic smoothed output
    float signal_value       = 0.0    // Signal line (EMA of oscillator)
    float histogram          = 0.0    // osc - signal
    bool  is_strong_up       = false  // momentum threshold exceeded (bull)
    bool  is_strong_down     = false  // momentum threshold exceeded (bear)

type AntilagState
    float primary_velocity   = 0.0
    float secondary_velocity = 0.0
    float primary_vol_ratio  = 0.0
    float secondary_vol_ratio = 0.0
    bool  primary_at_ema_extreme = false
    bool  aligned            = false
    bool  fires              = false
    float strength           = 0.0    // 0.0-1.0 composite

type ProximityMap
    float nearest_bull_dist  = 100.0  // distance to nearest unswept low zone (ATR units)
    float nearest_bear_dist  = 100.0  // distance to nearest unswept high zone (ATR units)
    float bull_intensity     = 0.0    // 0.0-1.0 map brightness (lower map)
    float bear_intensity     = 0.0    // 0.0-1.0 map brightness (upper map)

type DivergenceState
    float last_price = na
    float last_val   = na
    int   last_idx   = na
```

### Section 4: Core Calculations (~100 lines)

**Step 1 — MarkitTick Delta Calculation:**
```pine
// Efficiency multiplier (body size relative to volume)
float typical_price = (high + low + close) / 3.0
float tv_base = typical_price * volume
float curr_body = math.abs(close - open)
float raw_eff = curr_body / math.max(volume, 1.0)
float exp_eff = avg_body / math.max(avg_vol, EPSILON)
float rel_eff = raw_eff / math.max(exp_eff, EPSILON)
engine.efficiency_mult := math.max(eff_min_cap, math.min(rel_eff, eff_max_cap))

// Momentum threshold gate
float close_change = close - close[1]
float threshold_val = math.abs(open[1] - close[1]) * momentum_threshold
engine.is_strong_up := close_change > threshold_val
engine.is_strong_down := close_change < -threshold_val

// Weighted delta
engine.delta_current := engine.is_strong_up ? tv_base * engine.efficiency_mult : engine.is_strong_down ? -tv_base * engine.efficiency_mult : 0.0
```

**Step 2 — SMI Ergodic Smoothing (inline, no library):**

Implement double-EMA smoothing of the delta:
```pine
// First smoothing: EMA of delta over smi_long period
float smooth1 = ta.ema(engine.delta_current, smi_long)
// Second smoothing: EMA of smooth1 over smi_short period  
float smooth2 = ta.ema(smooth1, smi_short)
// Absolute delta for normalization
float abs_smooth1 = ta.ema(math.abs(engine.delta_current), smi_long)
float abs_smooth2 = ta.ema(abs_smooth1, smi_short)
// SMI Ergodic = 100 * (double-smoothed delta / double-smoothed |delta|)
engine.osc_value := abs_smooth2 != 0 ? 100.0 * smooth2 / abs_smooth2 : 0.0
// Signal line
engine.signal_value := ta.ema(engine.osc_value, signal_length)
// Histogram
engine.histogram := engine.osc_value - engine.signal_value
```

**Step 3 — Dynamic Zones:**
```pine
float dz_above = ta.percentile_nearest_rank(engine.osc_value, dz_sample_length, dz_pct_above)
float dz_below = ta.percentile_nearest_rank(engine.osc_value, dz_sample_length, 100 - dz_pct_below)
float dz_center = ta.percentile_nearest_rank(engine.osc_value, dz_sample_length, 50)
```

**Step 4 — HTF Data:**
Use the same repainting-safe pattern from SME MFI:
```pine
string requestedTf = htf_mode == "Fixed TF" ? fixed_tf : timeframe.from_seconds(timeframe.in_seconds() * tf_multiplier)
int offset = repainting == "On" ? 0 : 1
lookahead = repainting == "On" ? barmerge.lookahead_off : barmerge.lookahead_on
```

### Section 5: ANTILAG Detection (~80 lines)

Approximation on time-based charts (true 1000-tick velocity needs tick charts):

```pine
// PRIMARY INSTRUMENT (chart symbol)
float pri_velocity = math.abs(close - close[1]) / close[1] * 100.0
float pri_vol_avg = ta.sma(volume, 20)
float pri_vol_ratio = volume / math.max(pri_vol_avg, EPSILON)
bool pri_bull = close > open

// EMA extreme detection
float ema_fast_val = ta.ema(close, antilag_ema_fast)
float ema_slow_val = ta.ema(close, antilag_ema_slow)
float atr_val = ta.atr(14)
bool near_ema_fast = math.abs(close - ema_fast_val) <= atr_val * antilag_atr_proximity
bool near_ema_slow = math.abs(close - ema_slow_val) <= atr_val * antilag_atr_proximity
bool at_extreme = near_ema_fast or near_ema_slow

// SECONDARY INSTRUMENT (via request.security)
[sec_close, sec_open, sec_volume, sec_vol_avg] = request.security(secondary_symbol, timeframe.period, [close, open, volume, ta.sma(volume, 20)])
float sec_velocity = math.abs(sec_close - sec_close[1]) / sec_close[1] * 100.0
float sec_vol_ratio = sec_volume / math.max(sec_vol_avg, EPSILON)
bool sec_bull = sec_close > sec_open

// ANTILAG composite
antilag.aligned := pri_bull == sec_bull
antilag.fires := use_secondary ?
    (pri_vol_ratio > antilag_vol_surge and sec_vol_ratio > antilag_vol_surge
     and pri_velocity > antilag_price_velocity and sec_velocity > antilag_price_velocity
     and antilag.aligned and at_extreme) :
    (pri_vol_ratio > antilag_vol_surge and pri_velocity > antilag_price_velocity and at_extreme)

// Strength: normalized 0-1
antilag.strength := antilag.fires ? math.min(1.0, (pri_vol_ratio + sec_vol_ratio) / (antilag_vol_surge * 4)) : 0.0
```

### Section 6: Proximity Map Logic (~80 lines)

Track pivot-based liquidity zones (same logic as PBSR but for oscillator panel):

```pine
// Track arrays of zone levels
var float[] zone_levels = array.new_float()
var bool[]  zone_is_high = array.new_bool()
var bool[]  zone_swept = array.new_bool()
var int[]   zone_bar = array.new_int()

// Add zones on pivots
float ph_map = ta.pivothigh(map_pivot_lookback, map_pivot_lookback)
float pl_map = ta.pivotlow(map_pivot_lookback, map_pivot_lookback)

if not na(ph_map)
    array.push(zone_levels, high[map_pivot_lookback])
    array.push(zone_is_high, true)
    array.push(zone_swept, false)
    array.push(zone_bar, bar_index - map_pivot_lookback)

if not na(pl_map)
    array.push(zone_levels, low[map_pivot_lookback])
    array.push(zone_is_high, false)
    array.push(zone_swept, false)
    array.push(zone_bar, bar_index - map_pivot_lookback)

// Trim to max zones
while array.size(zone_levels) > map_max_zones
    array.shift(zone_levels), array.shift(zone_is_high), array.shift(zone_swept), array.shift(zone_bar)

// Compute nearest unswept zone distance
float nearest_high_dist = 100.0
float nearest_low_dist = 100.0
if array.size(zone_levels) > 0 and atr_val > 0
    for i = 0 to array.size(zone_levels) - 1
        if not array.get(zone_swept, i)
            float dist = math.abs(close - array.get(zone_levels, i)) / atr_val
            if array.get(zone_is_high, i)
                nearest_high_dist := math.min(nearest_high_dist, dist)
            else
                nearest_low_dist := math.min(nearest_low_dist, dist)
        // Mark swept
        if array.get(zone_is_high, i) and high > array.get(zone_levels, i)
            array.set(zone_swept, i, true)
        if not array.get(zone_is_high, i) and low < array.get(zone_levels, i)
            array.set(zone_swept, i, true)

// Intensity: 1.0 at the zone, 0.0 at zone_atr_distance away
prox.bear_intensity := nearest_high_dist <= zone_atr_distance ? 1.0 - (nearest_high_dist / zone_atr_distance) : 0.0
prox.bull_intensity := nearest_low_dist <= zone_atr_distance ? 1.0 - (nearest_low_dist / zone_atr_distance) : 0.0
```

### Section 7: Divergence Detection (~80 lines)

Multi-pivot system (3 lookback levels: 5, 10, 20). Follow the MarkitTick pattern:

- Create `PivotState` instances: `ph_05`, `ph_10`, `ph_20`, `pl_05`, `pl_10`, `pl_20`
- For each pivot lookback, detect:
  - **Regular bullish**: price lower low + oscillator higher low
  - **Regular bearish**: price higher high + oscillator lower high
  - **Hidden bullish**: price higher low + oscillator lower low
  - **Hidden bearish**: price lower high + oscillator higher high
- Draw divergence lines on oscillator panel
- Optionally draw on price chart using `force_overlay=true`
- Use `div_confirm_bars` for delayed confirmation

### Section 8: Signal Generation (~50 lines)

**High-frequency reversal dots:**
```pine
// Small dots when oscillator crosses dynamic zone boundary
bool osc_exits_top = ta.crossunder(engine.osc_value, dz_above)
bool osc_exits_btm = ta.crossover(engine.osc_value, dz_below)
plotshape(show_reversal_dots and osc_exits_top ? dz_above : na, "Rev Dot Bear", shape.circle, location.absolute, bear_color, size = size.tiny)
plotshape(show_reversal_dots and osc_exits_btm ? dz_below : na, "Rev Dot Bull", shape.circle, location.absolute, bull_color, size = size.tiny)
```

**Strong reversal labels** (ANTILAG + divergence + DZ extreme):
```pine
bool strong_bull = antilag.fires and (div_bull or h_div_bull) and engine.osc_value < dz_below
bool strong_bear = antilag.fires and (div_bear or h_div_bear) and engine.osc_value > dz_above

if show_strong_signals and strong_bull
    label.new(bar_index, engine.osc_value, labels_text_mode == "Full" ? str.tostring(confluence_score) + "%" : "", style = label.style_label_up, color = bull_color, textcolor = color.white, size = size.normal)
if show_strong_signals and strong_bear
    label.new(bar_index, engine.osc_value, labels_text_mode == "Full" ? str.tostring(confluence_score) + "%" : "", style = label.style_label_down, color = bear_color, textcolor = color.white, size = size.normal)
```

### Section 9: Visualization (~100 lines)

**Plots:**
```pine
// Main oscillator + signal
p_osc = plot(engine.osc_value, "Oscillator", color = osc_gradient_color, linewidth = 2)
p_sig = plot(engine.signal_value, "Signal", color = color.new(signal_line_color, 50), linewidth = 1)
fill(p_osc, p_sig, color = color.new(osc_gradient_color, 85), title = "Cloud")

// Histogram
plot(engine.histogram, "Histogram", color = histo_color, style = plot.style_histogram, linewidth = 2)

// Dynamic Zones
plot(dz_above, "DZ Top", color = color.new(bear_color, 60), linewidth = 1)
plot(dz_below, "DZ Bottom", color = color.new(bull_color, 60), linewidth = 1)
plot(dz_center, "DZ Center", color = color.new(color.gray, 70), linewidth = 1, style = plot.style_line)
hline(0, "Zero", color = color.gray, linestyle = hline.style_dotted)

// Proximity Maps — rendered as columns at panel extremes
// Upper map: bear intensity (approaching swing high zone)
plot(show_maps ? 105 + prox.bear_intensity * 10 : na, "Upper Map", color = color.new(bear_color, math.round(100 - prox.bear_intensity * 80)), style = plot.style_columns, histbase = 105)
// Lower map: bull intensity (approaching swing low zone)
plot(show_maps ? -5 - prox.bull_intensity * 10 : na, "Lower Map", color = color.new(bull_color, math.round(100 - prox.bull_intensity * 80)), style = plot.style_columns, histbase = -5)

// ANTILAG highlight
bgcolor(antilag.fires ? color.new(ACCENT, math.round(100 - antilag.strength * 60)) : na, title = "ANTILAG Glow")
```

**Gradient coloring for oscillator line:**
```pine
float spread = engine.osc_value - engine.signal_value
float stdev_range = ta.stdev(spread, GRADIENT_STDEV_LEN) * 2.0
color osc_gradient_color = spread > 0 ? color.from_gradient(spread, 0, stdev_range, color.new(bull_color, 60), bull_color) : color.from_gradient(spread, -stdev_range, 0, bear_color, color.new(bear_color, 60))
```

### Section 10: Dashboard Table (~40 lines)

Top-right table with Solvys Gold theme:

| Row | Label | Value |
|-----|-------|-------|
| 0 | Mode | HTF timeframe display |
| 1 | Oscillator | Current value + colored |
| 2 | ANTILAG | "ACTIVE" (gold) / "—" (grey) |
| 3 | Confluence | Score % with color |
| 4 | Nearest Zone | Distance in ATR |
| 5 | Secondary | Symbol + aligned/diverged |

```pine
if barstate.islast and show_dashboard
    var table dash = table.new(position.top_right, 2, 6, bgcolor = color.new(BG, 20), border_width = 1, border_color = color.new(ACCENT, 60))
    // ... populate cells with Solvys Gold styling
```

### Section 11: Alert System (~60 lines)

```pine
// alertcondition() for TradingView alert creator
alertcondition(ta.crossover(engine.osc_value, 0), "FO: Zero Cross Up", "Oscillator crossed above zero")
alertcondition(ta.crossunder(engine.osc_value, 0), "FO: Zero Cross Down", "Oscillator crossed below zero")
alertcondition(ta.crossover(engine.osc_value, engine.signal_value), "FO: Signal Cross Bull", "Oscillator crossed above signal")
alertcondition(ta.crossunder(engine.osc_value, engine.signal_value), "FO: Signal Cross Bear", "Oscillator crossed below signal")
alertcondition(osc_exits_top, "FO: DZ Exit Top", "Oscillator exiting dynamic zone top")
alertcondition(osc_exits_btm, "FO: DZ Exit Bottom", "Oscillator exiting dynamic zone bottom")
alertcondition(antilag.fires and close > open, "FO: ANTILAG Bull", "ANTILAG firing bullish")
alertcondition(antilag.fires and close < open, "FO: ANTILAG Bear", "ANTILAG firing bearish")
alertcondition(div_bull, "FO: Bullish Divergence", "Regular bullish divergence detected")
alertcondition(div_bear, "FO: Bearish Divergence", "Regular bearish divergence detected")
alertcondition(strong_bull, "FO: Strong Bull Signal", "Strong bullish reversal (ANTILAG + div + DZ)")
alertcondition(strong_bear, "FO: Strong Bear Signal", "Strong bearish reversal (ANTILAG + div + DZ)")

// alert() with JSON for webhook → signal-ingest
if strong_bull
    alert('{"source":"tradingview","strategy":"fintheon_oscillator","direction":"long","instrument":"' + syminfo.ticker + '","confidence":' + str.tostring(confluence_score) + ',"signals":["antilag","divergence","dz_extreme"]}', alert.freq_once_per_bar_close)
if strong_bear
    alert('{"source":"tradingview","strategy":"fintheon_oscillator","direction":"short","instrument":"' + syminfo.ticker + '","confidence":' + str.tostring(confluence_score) + ',"signals":["antilag","divergence","dz_extreme"]}', alert.freq_once_per_bar_close)
```

---

## Key Rules

- **No external library imports** — all logic inline. Unlike the SME MFI reference which imports 5 libraries, this must be fully self-contained.
- **Pine v6** — use `type` keyword for state management.
- **Solvys Gold defaults** — accent `#c79f4a`, bg `#050402`, text `#f0ead6`. Every color exposed as `input.color`.
- **Labels use `label.style_label_up/down`** — NOT triangles. Mid-size (`size.normal`).
- **`labels_text_mode` controls all text** — "Off" (default) shows no text on any label, "Symbols Only" shows just the label shape, "Full" shows confidence % or divergence type.
- **ANTILAG is contrarian** — velocity spike INTO EMA = exhaustion, not continuation. The indicator should highlight this as a potential reversal, not a trend continuation.

---

## DO NOT

- Do NOT import external Pine libraries
- Do NOT use `strategy()` — this is an `indicator()`
- Do NOT modify any files outside `docs/tradingview-pine/`
- Do NOT touch the LQDelta Overlay (that's T2)
- Do NOT add VWAP to this indicator

---

## Verification

1. Paste into TradingView Pine Editor on a new chart → must compile with zero errors
2. Add to NQ 1000T chart → verify oscillator renders in separate panel
3. Oscillator line should show crossovers with signal line
4. Histogram should gradient-color based on spread
5. Dynamic zones should adapt to recent price action
6. Set secondary instrument to "ES1!" → verify ANTILAG highlights fire when both instruments surge
7. Proximity maps should light up when price approaches unswept pivot zones
8. Toggle every input off/on → no errors
9. Change all colors → verify full customization
10. Create a test alert → verify JSON appears in alert message

---

## Changelog Entry

```typescript
{ date: '2026-04-04T12:30:00', agent: 'claude-code', summary: 'S7-T1: Created Fintheon Oscillator Pine v6 indicator — SMI Ergodic of volume delta with ANTILAG, proximity maps, dynamic zones, and webhook alerts', files: ['docs/tradingview-pine/FINTHEON-Oscillator.pine'] }
```
