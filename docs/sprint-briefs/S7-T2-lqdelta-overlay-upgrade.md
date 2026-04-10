# S7-T2: LQDelta Overlay Fixes & Upgrades

> **Sprint 7, Track 2** — Fix and upgrade existing Pine Script indicator
> **Depends on**: Nothing (runs in parallel with T1)
> **Input**: User's existing code (pasted below in full)
> **Output**: `docs/tradingview-pine/LQDELTA-Overlay.pine`

---

## Context

The "Liquidity + Delta Overlay (Priced In Research)" is an existing Pine v6 overlay indicator with 3 components:

1. **Liquidity Swings** — pivot-based swing high/low zones with volume labels
2. **Volume Delta Candles** — sub-bar volume delta visualization
3. **EMA Cross + Retest** — 20/100 EMA with retest signals

It currently works on standard timeframes but has bugs on 15m+ and doesn't support tick charts (1000T). There are 4 specific fixes + 4 new features.

---

## Files to Read First

1. The existing indicator code is provided IN FULL at the bottom of this brief — read it completely before making changes
2. `docs/tradingview-pine/PLAYBOOK-Strategy-Backtest.pine` — reference for sweep/reclaim detection and confidence scoring patterns
3. `docs/sprint-briefs/S7-T1-fintheon-oscillator.md` — the companion oscillator being built in parallel (for context only, do NOT build it)

---

## File to Create

### `docs/tradingview-pine/LQDELTA-Overlay.pine`

This is a NEW file containing the upgraded indicator. Do NOT modify the user's live TradingView indicator directly.

---

## Fixes (MANDATORY)

### Fix 1: Remove "Retest" Text — Use Label Up/Down

**Current code (lines ~213-214):**

```pine
plotshape(showSignals and bullRetest ? low : na, "Bull Retest", shape.triangleup, location.belowbar, colUpVD, size = size.small, text = "Retest", textcolor = colUpVD)
plotshape(showSignals and bearRetest ? high : na, "Bear Retest", shape.triangledown, location.abovebar, colDnVD, size = size.small, text = "Retest", textcolor = colDnVD)
```

**Change to:**

```pine
plotshape(showSignals and bullRetest ? low : na, "Bull Retest", shape.labelup, location.belowbar, colUpVD, size = size.normal)
plotshape(showSignals and bearRetest ? high : na, "Bear Retest", shape.labeldown, location.abovebar, colDnVD, size = size.normal)
```

Key changes:

- `shape.triangleup` → `shape.labelup`
- `shape.triangledown` → `shape.labeldown`
- Remove `text = "Retest"` and `textcolor` entirely
- `size.small` → `size.normal` (mid-sized)
- No text by default

### Fix 2: Tick Chart Support (1T, 100T, 500T, 1000T)

**Current bug:** `get_min_tf()` forces minimum "1" (1 minute). On tick charts, this breaks — `request.security_lower_tf()` with "1" minute on a 1000T chart doesn't make sense.

**Solution:**
Replace the `get_min_tf()` function and add a proper resolution selector:

```pine
// In inputs section, replace the LTF resolution inputs:
deltaRes = input.string("Auto", "Delta Resolution", options = ["Auto", "1T", "100T", "500T", "1000T", "1", "5", "15"], group = grp2, tooltip = "Resolution for volume delta calculation. 'Auto' uses chart timeframe on tick charts, 1m on time-based charts.")
lsRes = input.string("Auto", "LQ Intrabar Resolution", options = ["Auto", "1T", "100T", "500T", "1000T", "1", "5", "15"], group = grp1, tooltip = "Resolution for liquidity swing intrabar precision.")

// Replace get_min_tf():
get_resolved_tf(string user_tf) =>
    if user_tf == "Auto"
        // On tick/range/renko charts, use chart's own timeframe (bar data IS the granular data)
        // On time-based charts, default to "1" (1 minute)
        timeframe.isseconds or timeframe.isminutes or timeframe.isdaily ? "1" : timeframe.period
    else
        user_tf
```

For tick charts specifically: when the chart IS a tick chart (1000T) and the user selects "Auto", the delta should be computed directly from bar data since each bar already represents aggregated ticks. The `request.security_lower_tf()` call should be wrapped in a check:

```pine
is_tick_chart = str.contains(timeframe.period, "T") or str.contains(timeframe.period, "S")

if is_tick_chart and (deltaRes == "Auto" or str.endswith(deltaRes, "T"))
    // Compute delta from bar data directly
    bullV := close > open ? volume : 0.0
    bearV := close < open ? volume : 0.0
else
    // Use request.security_lower_tf() as before
    [bV, sV, tV, aCl_vd] = request.security_lower_tf(syminfo.tickerid, resolved_vd_tf, [...])
    bullV := bV.sum()
    bearV := sV.sum()
```

### Fix 3: Adjustable EMA Thickness

**Current:** Hardcoded `linewidth = 1` (fast) and `linewidth = 2` (slow).

**Add inputs:**

```pine
widthFast = input.int(1, 'Fast EMA Width', minval = 1, maxval = 5, group = grp3)
widthSlow = input.int(2, 'Slow EMA Width', minval = 1, maxval = 5, group = grp3)
```

**Update plots:**

```pine
plot(showEMA ? fEMA : na, "Fast EMA", color = colFast, linewidth = widthFast)
plot(showEMA ? sEMA : na, "Slow EMA", color = colSlow, linewidth = widthSlow)
```

Default: Slow (2) is 2x thicker than Fast (1).

### Fix 4: Default Colors Match Current Config

Keep all current defaults exactly as they are in the code:

- Fast EMA: `color.white`
- Slow EMA: `#5b9cf6`
- Up: `#089981`
- Down: `#f23645`
- Swing High: `color.red` / area `#f2364580`
- Swing Low: `color.teal` / area `#00808080`

Do NOT change any default color values.

### Fix 5: Volume Labels Showing "0" (BUG)

**Root cause:** In `get_counts()`, when a new pivot fires (`not na(condition)`), it resets `count := 0.0, vol := 0.0`. The counting then only accumulates on SUBSEQUENT bars where `low[lengthLS] < top and high[lengthLS] > btm`. But the pivot bar itself — the bar that created the zone — is never counted because:

1. On the pivot confirmation bar, the condition is `not na(condition)` so it resets to 0
2. The `[lengthLS]` offset means it checks bars BEFORE the current bar, but the zone boundaries were just set from those same bars

**Fix approach:**
After setting the zone boundaries on a new pivot, seed the initial volume from the pivot bar itself:

```pine
get_counts(condition, top, btm) =>
    var float count = 0.0
    var float vol = 0.0
    if not na(condition)
        // Reset AND seed with the pivot bar's own volume
        count := 0.0
        vol := 0.0
        // The pivot bar at [lengthLS] created this zone — count it
        if low[lengthLS] < top and high[lengthLS] > btm
            count := 1.0
            vol := volume[lengthLS]
    else
        if intraPrecision
            if n > lengthLS and v_ltf.size() > 0
                for [idx, el] in v_ltf
                    vol += l_ltf.get(idx) < top and h_ltf.get(idx) > btm ? el : 0.0
        else
            vol += low[lengthLS] < top and high[lengthLS] > btm ? volume[lengthLS] : 0.0
        count += low[lengthLS] < top and high[lengthLS] > btm ? 1.0 : 0.0
    [count, vol]
```

Also verify: on higher timeframes (15m+), the zone width calculation `high[lengthLS] * zoneWidthPct / 100` might produce very narrow zones that few bars overlap with. Consider whether the zone width needs to scale with timeframe.

---

## New Features

### Feature 1: Dual-Timeframe Liquidity + Staleness

**New input group:**

```pine
grp_lq_adv     = "1b. Liquidity Advanced"
staleness_bars  = input.int(200, "Zone Staleness (bars)", group = grp_lq_adv, tooltip = "Zones older than this many bars are removed. Swept zones are removed immediately.")
use_htf_lq      = input.bool(true, "Show HTF Liquidity", group = grp_lq_adv)
htf_lq_tf       = input.timeframe("60", "HTF Liquidity Timeframe", group = grp_lq_adv)
htf_lq_color    = input.color(color.new(color.red, 60), "HTF Zone Color (dimmer)", group = grp_lq_adv)
confluence_color = input.color(#FF8C00, "Confluence Color (bright orange)", group = grp_lq_adv)
confluence_tol   = input.float(0.5, "Confluence ATR Tolerance", group = grp_lq_adv, tooltip = "How close (in ATR) chart-TF and HTF zones must be to highlight as confluence")
```

**Staleness logic:**

- When `ph_crossed` or `pl_crossed` flips true → **immediately delete** the line AND box for that zone. Gone. No fading.
- Zones older than `staleness_bars` → delete line + box on that bar.
- Check zone age: `bar_index - zone_creation_bar > staleness_bars`

**HTF Liquidity layer:**

```pine
// Fetch HTF pivots
[htf_ph, htf_pl, htf_high, htf_low] = request.security(syminfo.tickerid, htf_lq_tf, [ta.pivothigh(lengthLS, lengthLS), ta.pivotlow(lengthLS, lengthLS), high, low])
```

- Render HTF zones as dimmer red boxes/lines (same visual structure as chart-TF zones but with `htf_lq_color`)
- HTF zones also obey staleness and sweep-deletion rules

**Confluence detection:**
When a chart-TF zone level is within `confluence_tol * ATR` of an HTF zone level:

```pine
float atr_val = ta.atr(14)
bool is_confluence = math.abs(chart_zone_level - htf_zone_level) <= atr_val * confluence_tol
```

- Both the chart-TF and HTF zone turn **bright orange** (`confluence_color`)
- This is the highest-conviction signal — two timeframes of liquidity stacking at the same level

### Feature 2: Swept Zone Labels

When a zone gets swept (price breaks through and `ph_crossed`/`pl_crossed` flips true):

- Place a small gold (`#c79f4a`) label icon at the sweep point
- Swing high swept → `label.style_label_down` at the high
- Swing low swept → `label.style_label_up` at the low
- No text (just the label shape)
- Then delete the zone's line + box (per staleness rule)

```pine
show_sweep_labels = input.bool(true, "Show Sweep Labels", group = grp_lq_adv)
sweep_label_color = input.color(#c79f4a, "Sweep Label Color", group = grp_lq_adv)
```

### Feature 3: HTF EMA Cross Alerts (Always-On)

**This fires regardless of chart timeframe or the user's EMA settings.**

```pine
grp_htf_ema      = "3b. HTF EMA Cross Alert"
htf_ema_tf       = input.timeframe("15", "HTF EMA Monitor TF", group = grp_htf_ema, tooltip = "Always monitors this TF for 20/100 EMA crosses, independent of chart settings")
htf_cross_color  = input.color(color.red, "HTF Cross Label Color", group = grp_htf_ema)
show_htf_cross   = input.bool(true, "Show HTF EMA Cross Labels", group = grp_htf_ema)
```

**Logic:**

```pine
// Separate request.security for HTF EMA monitoring (independent of user's chart EMA settings)
htf_ema_func() => [ta.ema(close, 20), ta.ema(close, 100)]
[htf_fast, htf_slow] = request.security(syminfo.tickerid, htf_ema_tf, htf_ema_func())

bool htf_bull_cross = ta.crossover(htf_fast, htf_slow)
bool htf_bear_cross = ta.crossunder(htf_fast, htf_slow)

// Bright red labels (default color, user can change)
if show_htf_cross and htf_bull_cross
    label.new(bar_index, low, "", style = label.style_label_up, color = htf_cross_color, size = size.large)
if show_htf_cross and htf_bear_cross
    label.new(bar_index, high, "", style = label.style_label_down, color = htf_cross_color, size = size.large)
```

Key: `size.large` — these are the most important structural signals. They should be visually prominent. Bright red default, configurable.

### Feature 4: Full Alert System

```pine
// Alert conditions
alertcondition(bullRetest, "LQ: Bull Retest", "Bullish EMA retest confirmed")
alertcondition(bearRetest, "LQ: Bear Retest", "Bearish EMA retest confirmed")
alertcondition(htf_bull_cross, "LQ: HTF Bull EMA Cross", "HTF bullish EMA cross detected")
alertcondition(htf_bear_cross, "LQ: HTF Bear EMA Cross", "HTF bearish EMA cross detected")

// Swept zone alerts (need to track sweep events as booleans)
// swept_high = when ph_crossed flips from false to true
// swept_low = when pl_crossed flips from false to true
alertcondition(swept_high_event, "LQ: Zone Swept High", "Swing high liquidity zone swept")
alertcondition(swept_low_event, "LQ: Zone Swept Low", "Swing low liquidity zone swept")

// Confluence alert
alertcondition(confluence_detected, "LQ: Confluence", "Chart-TF and HTF liquidity zones overlapping")

// JSON webhook alerts for signal-ingest
if bullRetest
    alert('{"source":"tradingview","strategy":"lqdelta_overlay","direction":"long","instrument":"' + syminfo.ticker + '","confidence":70,"signals":["ema_retest"],"sessionWindow":"' + (session.ismarket ? "rth" : "eth") + '"}', alert.freq_once_per_bar_close)
if bearRetest
    alert('{"source":"tradingview","strategy":"lqdelta_overlay","direction":"short","instrument":"' + syminfo.ticker + '","confidence":70,"signals":["ema_retest"],"sessionWindow":"' + (session.ismarket ? "rth" : "eth") + '"}', alert.freq_once_per_bar_close)
```

---

## Key Rules

- **Keep ALL existing functionality working** — this is an upgrade, not a rewrite. Every feature that works today must still work.
- **Default colors stay exactly as they are in the current code.** Do not change any default color values.
- **Labels use `label.style_label_up/down`** — NOT triangles. No text by default on retest signals.
- **Swept zones disappear immediately** — line + box deleted on the same bar the sweep is detected.
- **HTF EMA cross labels are bright red, `size.large`** — these are the most prominent signals on the chart.
- **Solvys Gold (`#c79f4a`) for sweep labels only** — not for zone colors or EMAs.

---

## DO NOT

- Do NOT modify T1 files (Fintheon Oscillator)
- Do NOT add VWAP
- Do NOT change the indicator from overlay=true to overlay=false
- Do NOT import external Pine libraries
- Do NOT change existing default color values

---

## Verification

1. Paste into TradingView Pine Editor → must compile with zero errors
2. Add to NQ 1000T chart → verify no errors on tick charts
3. Add to NQ 15m chart → verify all zones show non-zero volume labels
4. Verify retest signals show as `label_up/down` with NO text (not triangles, not "Retest")
5. Verify EMAs render with configurable thickness — change Fast to 3, Slow to 5 → confirm visual change
6. Verify HTF liquidity zones render as dim red, below chart-TF zones in visual priority
7. Verify zones turn bright orange when chart-TF and HTF zones overlap within tolerance
8. Verify swept zones disappear immediately (line + box deleted)
9. Verify old zones disappear after staleness threshold
10. Verify HTF EMA cross fires bright red `size.large` labels on 15m EMA crosses even when chart is on 1000T
11. Create test alert → verify JSON payload in alert message
12. Toggle all new inputs off → verify indicator works exactly like the original

---

## Changelog Entry

```typescript
{ date: '2026-04-04T13:00:00', agent: 'claude-code', summary: 'S7-T2: Upgraded LQDelta Overlay — removed Retest text, tick chart support, adjustable EMA thickness, fixed 0-volume bug, dual-TF liquidity with staleness, sweep labels, HTF EMA cross alerts, full alert system', files: ['docs/tradingview-pine/LQDELTA-Overlay.pine'] }
```

---

## EXISTING CODE (FULL — Read this completely before making changes)

```pine
// This Pine Script® code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © Priced In Research — Suite 1: Liquidity Swings + Volume Delta Candles (Standard TFs Only)

//@version=6
indicator("Liquidity + Delta Overlay (Priced In Research)"
  , shorttitle = "LQDelta Overlay (Priced In)"
  , overlay = true
  , max_lines_count = 500
  , max_labels_count = 500
  , max_boxes_count = 500)

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Liquidity Swings Settings
// ═══════════════════════════════════════════════════════════════════════════════
grp1           = '1. Liquidity Swings'
lengthLS       = input.int(14, 'Pivot Lookback', group = grp1)
areaLS         = input.string('Wick Extremity', 'Swing Area', options = ['Wick Extremity', 'Full Range'], group = grp1)
intraPrecision = input.bool(false, 'Intrabar Precision', inline = 'ls1', group = grp1)
intrabarTf     = input.timeframe('1', 'LTF Res', inline = 'ls1', group = grp1, tooltip = "Minimum 1 minute timeframe.")
filterOptions  = input.string('Count', 'Filter Areas By', options = ['Count', 'Volume'], inline = 'ls2', group = grp1)
filterValueLS  = input.float(0, '', inline = 'ls2', group = grp1)
showTop        = input.bool(true, 'Swing High', inline = 'top', group = grp1)
topCss         = input.color(color.red, '', inline = 'top', group = grp1)
topAreaCss     = input.color(#f2364580, 'Area', inline = 'top', group = grp1)
showBtm        = input.bool(true, 'Swing Low', inline = 'btm', group = grp1)
btmCss         = input.color(color.teal, '', inline = 'btm', group = grp1)
btmAreaCss     = input.color(#00808080, 'Area', inline = 'btm', group = grp1)
labelSizeLS    = input.string('Tiny', 'Labels Size', options = ['Tiny', 'Small', 'Normal'], group = grp1)

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Volume Delta Candles Settings
// ═══════════════════════════════════════════════════════════════════════════════
grp2       = '2. Volume Delta Candles'
showVD     = input.bool(true, 'Show Delta Candles', group = grp2)
resVD      = input.timeframe('1', 'LTF Resolution', group = grp2, tooltip = "Minimum 1 minute timeframe. Defaults to 1m if lower is selected.")
colUpVD    = input.color(#089981, 'Up ', inline = 'vdu', group = grp2)
colUp_VD   = input.color(#f23645, 'Up - ', inline = 'vdu', group = grp2, tooltip = "Bullish Candle + Negative Delta")
colDnVD    = input.color(#f23645, 'Down', inline = 'vdd', group = grp2)
colDn_VD   = input.color(#089981, 'Down +', inline = 'vdd', group = grp2, tooltip = "Bearish Candle + Positive Delta")
optionVD   = input.string('full bar', 'Display', options = ['half bar', 'full bar'], group = grp2)
showDotVD  = input.bool(false, 'Show Max Volume Price Point', group = grp2)
showTabVD  = input.bool(true, 'Show TF Table', group = grp2)
tabColVD   = input.color(#b2b5beaa, 'Table Text Color', group = grp2)

// ─────────────────────────────────────────────────────────────────────────────
// Logic Helpers
// ─────────────────────────────────────────────────────────────────────────────
n = bar_index

// Force minimum 1 minute timeframe
get_min_tf(string tf) =>
    tf_secs = timeframe.in_seconds(tf)
    tf_secs < 60 ? "1" : tf

ls_tf = get_min_tf(intrabarTf)
vd_tf = get_min_tf(resVD)

// ─────────────────────────────────────────────────────────────────────────────
// LIQUIDITY SWINGS — Logic
// ─────────────────────────────────────────────────────────────────────────────
get_data_ls() => [high, low, volume]
[h_ltf, l_ltf, v_ltf] = request.security_lower_tf(syminfo.tickerid, ls_tf, get_data_ls())

get_counts(condition, top, btm) =>
    var float count = 0.0
    var float vol = 0.0
    if not na(condition)
        count := 0.0, vol := 0.0
    else
        if intraPrecision
            if n > lengthLS and v_ltf.size() > 0
                for [idx, el] in v_ltf
                    vol += l_ltf.get(idx) < top and h_ltf.get(idx) > btm ? el : 0.0
        else
            vol += low[lengthLS] < top and high[lengthLS] > btm ? volume[lengthLS] : 0.0
        count += low[lengthLS] < top and high[lengthLS] > btm ? 1.0 : 0.0
    [count, vol]

set_label_ls(count, vol, x, y, css, lbl_style) =>
    var label lbl = na
    label_size = switch labelSizeLS
        'Tiny' => size.tiny
        'Small' => size.small
        'Normal' => size.normal
    target = filterOptions == 'Count' ? count : vol
    if ta.crossover(target, filterValueLS)
        lbl := label.new(x, y, str.tostring(vol, format.volume), style = lbl_style, size = label_size, color = #00000000, textcolor = css)
    if target > filterValueLS
        label.set_text(lbl, str.tostring(vol, format.volume))

set_level_ls(condition, crossed, value, count, vol, css) =>
    var line lvl = na
    target = filterOptions == 'Count' ? count : vol
    if not na(condition)
        if target[1] < filterValueLS[1]
            line.delete(lvl[1])
        else if not crossed[1]
            line.set_x2(lvl, n - lengthLS)
        lvl := line.new(n - lengthLS, value, n, value, color = na)
    if not crossed[1]
        line.set_x2(lvl, n + 3)
    if crossed and not crossed[1]
        line.set_x2(lvl, n), line.set_style(lvl, line.style_dashed)
    if target > filterValueLS
        line.set_color(lvl, css)

set_zone_ls(condition, x, top, btm, count, vol, css) =>
    var box bx = na
    target = filterOptions == 'Count' ? count : vol
    if ta.crossover(target, filterValueLS)
        bx := box.new(x, top, x + int(count), btm, border_color = na, bgcolor = css)
    if target > filterValueLS
        box.set_right(bx, x + int(count))

var float ph_top = na, var float ph_btm = na, var bool ph_crossed = false, var int ph_x1 = 0
var box ph_bx = box.new(na, na, na, na, bgcolor = topAreaCss, border_color = na)
var float pl_top = na, var float pl_btm = na, var bool pl_crossed = false, var int pl_x1 = 0
var box pl_bx = box.new(na, na, na, na, bgcolor = btmAreaCss, border_color = na)

ph = ta.pivothigh(lengthLS, lengthLS)
[ph_count, ph_vol] = get_counts(ph, ph_top, ph_btm)
if not na(ph) and showTop
    ph_top := high[lengthLS], ph_btm := areaLS == 'Wick Extremity' ? math.max(close[lengthLS], open[lengthLS]) : low[lengthLS]
    ph_x1 := n - lengthLS, ph_crossed := false
    box.set_lefttop(ph_bx, ph_x1, ph_top), box.set_rightbottom(ph_bx, ph_x1, ph_btm)
else
    ph_crossed := close > ph_top ? true : ph_crossed
    box.set_right(ph_bx, ph_crossed ? ph_x1 : n + 3)

if showTop
    set_zone_ls(ph, ph_x1, ph_top, ph_btm, ph_count, ph_vol, topAreaCss)
    set_level_ls(ph, ph_crossed, ph_top, ph_count, ph_vol, topCss)
    set_label_ls(ph_count, ph_vol, ph_x1, ph_top, topCss, label.style_label_down)

pl = ta.pivotlow(lengthLS, lengthLS)
[pl_count, pl_vol] = get_counts(pl, pl_top, pl_btm)
if not na(pl) and showBtm
    pl_top := areaLS == 'Wick Extremity' ? math.min(close[lengthLS], open[lengthLS]) : high[lengthLS], pl_btm := low[lengthLS]
    pl_x1 := n - lengthLS, pl_crossed := false
    box.set_lefttop(pl_bx, pl_x1, pl_top), box.set_rightbottom(pl_bx, pl_x1, pl_btm)
else
    pl_crossed := close < pl_btm ? true : pl_crossed
    box.set_right(pl_bx, pl_crossed ? pl_x1 : n + 3)

if showBtm
    set_zone_ls(pl, pl_x1, pl_top, pl_btm, pl_count, pl_vol, btmAreaCss)
    set_level_ls(pl, pl_crossed, pl_btm, pl_count, pl_vol, btmCss)
    set_label_ls(pl_count, pl_vol, pl_x1, pl_btm, btmCss, label.style_label_up)

// ─────────────────────────────────────────────────────────────────────────────
// VOLUME DELTA — Logic
// ─────────────────────────────────────────────────────────────────────────────
[bV, sV, tV, aCl_vd] = request.security_lower_tf(syminfo.tickerid, vd_tf, [close > open ? volume : 0.0, close < open ? volume : 0.0, volume, close])

float maxV_vd = na
if tV.size() > 0
    indices = (bV.max() > sV.max() ? bV : sV).sort_indices(order.descending)
    maxV_vd := indices.size() > 0 ? aCl_vd.get(indices.first()) : na

bullV = bV.sum()
bearV = sV.sum()
abs_vd = math.abs(open - close), min_vd = math.min(open, close), max_vd = math.max(open, close), avg_vd = math.avg(open, close)
delta_vd = bullV - bearV
norm_vd = volume != 0 ? delta_vd / volume : 0.0
pos_vd = norm_vd >= 0
value_vd = optionVD == 'half bar' ? avg_vd + norm_vd * abs_vd / 2 : pos_vd ? min_vd + math.abs(norm_vd) * abs_vd : max_vd - math.abs(norm_vd) * abs_vd
base_vd = optionVD == 'half bar' ? avg_vd : pos_vd ? min_vd : max_vd
css_vd = close > open ? colUpVD : close < open ? colDnVD : chart.fg_color
cssD_vd = color.new(norm_vd > 0 ? (close > open ? colUpVD : colDn_VD) : (close < open ? colDnVD : colUp_VD), 50)

barcolor(color.new(na, 100))
plotcandle(showVD ? base_vd : na, showVD ? base_vd : na, showVD ? value_vd : na, showVD ? value_vd : na, color = cssD_vd, wickcolor = na, bordercolor = na)
plotcandle(showVD ? open : na, showVD ? high : na, showVD ? low : na, showVD ? close : na, color = na, wickcolor = css_vd, bordercolor = css_vd)
plot(showVD and showDotVD ? maxV_vd : na, color = chart.fg_color, style = plot.style_circles, offset = 1)

if showTabVD and barstate.islast
    var table tab_vd = table.new(position.top_right, 1, 1, bgcolor = color.new(na, 100))
    table.cell(tab_vd, 0, 0, "TF: " + vd_tf, text_color = tabColVD)

// ═══════════════════════════════════════════════════════════════════════════════
// 3. EMA Cross Settings
// ═══════════════════════════════════════════════════════════════════════════════
grp3           = '3. EMA Cross'
useMTF         = input.bool(false, 'Use Custom Timeframe', group = grp3)
tfEMA          = input.timeframe('60', 'EMA Timeframe', group = grp3, tooltip = "Only used if 'Use Custom Timeframe' is checked.")
lenFast        = input.int(20, 'Fast EMA Length', minval = 1, group = grp3)
lenSlow        = input.int(100, 'Slow EMA Length', minval = 1, group = grp3)
showEMA        = input.bool(true, 'Show EMA Lines', group = grp3)
colFast        = input.color(color.white, 'Fast EMA', inline = 'ema_c', group = grp3)
colSlow        = input.color(#5b9cf6, 'Slow EMA', inline = 'ema_c', group = grp3)
showSignals    = input.bool(true, 'Show Cross + Retest Signals', group = grp3)

// ─────────────────────────────────────────────────────────────────────────────
// EMA CROSS + RETEST — Logic
// ─────────────────────────────────────────────────────────────────────────────
ema_func() => [ta.ema(close, lenFast), ta.ema(close, lenSlow)]
[fEMA, sEMA] = request.security(syminfo.tickerid, useMTF ? tfEMA : timeframe.period, ema_func(), gaps = barmerge.gaps_off)

var bool pendingBull = false
var bool pendingBear = false

if ta.crossover(fEMA, sEMA)
    pendingBull := true
    pendingBear := false
if ta.crossunder(fEMA, sEMA)
    pendingBear := true
    pendingBull := false

bullRetest = pendingBull and low <= fEMA and close > sEMA
bearRetest = pendingBear and high >= fEMA and close < sEMA

if bullRetest
    pendingBull := false
if bearRetest
    pendingBear := false

plot(showEMA ? fEMA : na, "Fast EMA", color = colFast, linewidth = 1)
plot(showEMA ? sEMA : na, "Slow EMA", color = colSlow, linewidth = 2)

plotshape(showSignals and bullRetest ? low : na, "Bull Retest", shape.triangleup, location.belowbar, colUpVD, size = size.small, text = "Retest", textcolor = colUpVD)
plotshape(showSignals and bearRetest ? high : na, "Bear Retest", shape.triangledown, location.abovebar, colDnVD, size = size.small, text = "Retest", textcolor = colDnVD)
```
