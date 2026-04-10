# Antilag Indicator Specification

<!-- claude-code 2026-02-28 | Full spec from TP walkthrough session -->

## Critical: Antilag is NOT a Plotted Indicator

Antilag is a **composite human read** on tick velocity, volume, and directional alignment across two instruments. It is NOT a line, oscillator, or overlay plotted on any chart. The algo must synthesize multiple data streams to approximate what TP reads visually.

---

## Signal Definition

Antilag fires when **ALL** of the following are true simultaneously:

### 1. Tick Velocity (Both Instruments)

- /NQ (1000-tick chart) and /ES (500-tick chart) are both printing candles
- Current candle completes **≥2× faster** than the previous candle
- Absolute time range: **2–30 seconds per candle**
- Below 2s = noise/glitch, above 30s = normal market, not antilag

### 2. Directional Alignment

- Both /NQ and /ES candles are printing in the **same direction**
- Both must be moving toward the same EMA extreme

### 3. EMA Extreme (Contrarian Context)

- The velocity spike occurs **at an EMA extreme** — near 20 EMA or 100 EMA
- The signal is **contrarian**: velocity spike into the EMA suggests exhaustion, not continuation
- This is the key insight: the speed itself is the exhaustion signal

### 4. Volume Confirmation

- Candles during antilag show elevated volume (SIZE on T&S)
- Example from video: SIZE 24 during antilag spike (10pts in 5 seconds)

---

## Codification Approach

Since this is a human-visual read, the algo must approximate via:

```
antilag_signal = (
    nq_candle_time <= nq_prev_candle_time * 0.5    # 2× faster
    AND es_candle_time <= es_prev_candle_time * 0.5  # 2× faster
    AND 2s <= nq_candle_time <= 30s                  # valid range
    AND 2s <= es_candle_time <= 30s                  # valid range
    AND nq_direction == es_direction                  # same direction
    AND price_near_ema_extreme                        # at 20 or 100 EMA
)
```

### EMA Extreme Detection

- Price within **ATR × 0.3** of 20 EMA or 100 EMA
- ATR calculated on 3-candle lookback of 1000T chart

### Direction Detection

- Candle close > open = bullish
- Candle close < open = bearish
- Both instruments must agree

---

## What Antilag Looks Like (from Video Analysis)

### Antilag example.mov — Frame 12 (8:43:39)

- Price jumps from 24,808 to 24,818.25 in ~5 seconds (10 pts)
- T&S shows SIZE 24 (large institutional order)
- 1000T candles completing in rapid succession
- ES confirming same direction
- Occurred at 20 EMA after pullback — contrarian context
- Result: 15-pt move to 100 EMA in next 45 seconds

---

## Signal Usage Across Models

| Model      | Antilag Role                                                                      |
| ---------- | --------------------------------------------------------------------------------- |
| 40/40 Club | Entry confirmation after sweep at Fib level                                       |
| Flush      | Exhaustion confirmation at session extreme                                        |
| Ripper     | Entry confirmation OR pre-staged fill validation                                  |
| All models | Scale-in trigger prerequisite (overtaking candle must show antilag-like velocity) |

---

## Edge Cases

### Blackout Window (9:20-9:35 ET)

- Antilag can override the blackout ONLY if "undeniable" — both instruments, extreme velocity, clear directional alignment, obvious EMA extreme

### News Events

- Antilag during first 120 seconds of news release is unreliable — velocity is noise
- After 120-second blackout, antilag readings resume normal validity

### Re-Entry Context

- After stop-out, antilag sync BEFORE EMA overtake = valid re-entry signal (optional)

---

## Open Questions (TBD)

- Exact ATR multiplier for "near EMA extreme" threshold
- Volume threshold for SIZE confirmation (raw tick count vs relative)
- Minimum candle body size during antilag (filter out dojis)
