# Sprint 1 — Track 3: Intelligence Layer

**Branch:** `v.8.25.4` (same branch as T1, merge after T1 completes)
**Depends on:** T1 must be complete (types.ts, indicators.ts, rolling-window.ts exist)
**Scope:** Build Antilag detector, Fib engine, and Confluence scorer. These are the "brain" modules that T2's model calls.

---

## CONTEXT

Read these files FIRST:
- `docs/quantconnect/STRATEGY-40-40-CLUB.md` — the corrected spec with 13 video corrections
- `backend-hono/src/services/algo-engine/types.ts` — T1's types (AntilagSignal, FibZone, ConfluenceScore)
- `backend-hono/src/services/algo-engine/indicators.ts` — T1's EMA, RSI, ATR classes
- `backend-hono/src/services/algo-engine/rolling-window.ts` — T1's RollingWindow
- `quantconnect/FortyFortyClub/main.py` — OLD Python implementation (reference, but strategy doc overrides)
- `quantconnect/docs/PlaybookSweepReclaim.cs` — C# PivotDetector for fib engine port
- `CLAUDE.md` — project rules, changelog protocol

## KEY CORRECTIONS THAT AFFECT THIS TRACK

**Correction 1:** Antilag is ATR spike + engulfing candle on NQ 1000T. NOT cross-instrument velocity. ES is soft directional bias via intuition. The old code's rigid velocity check is WRONG.

**Correction 10:** Pin bar + cross-instrument divergence is an alternate entry. When NQ has bearish EMA cross but ES is bullish (or vice versa), the divergence IS the setup.

**Correction 11:** NQ/ES divergence = NQ plays catch-up to ES. This is a mean-reversion-to-correlation play.

---

## FILES TO CREATE

### 1. `backend-hono/src/services/algo-engine/antilag.ts`

The core signal detector. NQ-primary, ES-soft.

```typescript
import { Bar, AntilagSignal } from './types';
import { ATR } from './indicators';
import { RollingWindow } from './rolling-window';

class AntilagDetector {
  private nqBars: RollingWindow<Bar>;   // recent NQ 1000T bars
  private esBars: RollingWindow<Bar>;   // recent ES 500T bars
  private nqAtr: ATR;
  private spikeMultiplier: number = 1.5; // TBD — tune from more videos

  constructor(lookback: number = 10);

  // PRIMARY SIGNAL: NQ 1000T
  // 1. ATR spike: current bar range > spikeMultiplier * N-bar average range
  //    "The move should be visually obvious. If you have to squint, it is not Antilag."
  // 2. Engulfing candle: current bar body fully engulfs prior bar body
  //    - Bullish engulf: current close > prior open AND current open < prior close
  //    - Bearish engulf: current close < prior open AND current open > prior close
  // 3. Location: must be at or near a fib zone OR near 20/100 EMA
  //    (location check is done by caller using FibEngine — this just returns the signal)
  detectNQ(bar: Bar): AntilagSignal | null;

  // ALTERNATE: Pin bar detection (for cross-instrument divergence entry)
  // A pin bar has a long wick (>60% of total range) in one direction
  // Valid when NQ/ES diverge on EMA structure
  detectPinBar(bar: Bar): AntilagSignal | null;

  // ES CONFIRMATION (soft)
  // Just checks: is ES trending in the same direction as the NQ signal?
  // NOT a hard velocity check. TP uses intuition for ES.
  // Algo approximates: check 20 EMA slope on ES 500T
  checkESBias(esBar: Bar, esEma20: number, esEma20Prev: number, nqDirection: 'long' | 'short'): boolean;

  // CROSS-INSTRUMENT DIVERGENCE
  // NQ has bearish EMA cross (20 < 100) while ES has bullish (20 > 100), or vice versa
  // When divergence exists, NQ will play catch-up to ES
  // This IS the setup — pin bar at structural level is enough
  checkDivergence(nqEma20: number, nqEma100: number, esEma20: number, esEma100: number): { divergent: boolean; nqLagging: 'long' | 'short' | null };

  // Feed bars as they arrive
  updateNQ(bar: Bar): void;
  updateES(bar: Bar): void;
}
```

**ATR spike threshold:** Start at 1.5x average range. "Visually obvious" means the bar stands out on the chart — it's significantly larger than surrounding bars. If the spike is marginal (1.1-1.3x), reject it. Better to miss a signal than to false-fire.

**Engulfing candle detection:**
```
Bullish engulfing:
  bar.close > bar.open                    (current bar is green)
  bar.close > prevBar.open                (current close above prior open)
  bar.open < prevBar.close                (current open below prior close)
  bar.close - bar.open > prevBar range    (body fully engulfs)

Bearish engulfing:
  bar.open > bar.close                    (current bar is red)
  bar.open > prevBar.close                (current open above prior close)
  bar.close < prevBar.open                (current close below prior open)
  bar.open - bar.close > prevBar range    (body fully engulfs)
```

### 2. `backend-hono/src/services/algo-engine/fib-engine.ts`

Fibonacci zone detection, sweep detection, and VWAP anchoring.

```typescript
import { Bar, FibZone } from './types';
import { RollingWindow } from './rolling-window';

// Standard fib levels
const FIB_LEVELS = [0, 0.222, 0.361, 0.414, 0.5, 0.618, 0.757, 0.828, 0.844, 1.0];

// Extension levels for TP2/TP3
const FIB_EXTENSIONS = [-0.222, -0.361, -0.5, -0.618, -0.756, -0.828, -0.844];

class FibEngine {
  private swingHigh: number | null = null;
  private swingLow: number | null = null;
  private zones: FibZone[] = [];
  private catalystAnchor: { price: number; timestamp: number } | null = null;

  constructor();

  // Set swing points (from 1000T or 15-min, depending on context)
  setSwingPoints(high: number, low: number): void;

  // Calculate all fib levels and ZONES between adjacent levels
  // Zone = area BETWEEN two adjacent fib levels, not a single line
  calculateZones(): FibZone[];

  // Classify zone by location:
  // Ripper: 0.222-0.361 (shallow — strong trend continuation)
  // Strong: 0.414-0.618 (standard pullback — bread and butter)
  // Weak:   0.757-0.85  (deep — trend may be failing)
  classifyZone(zone: FibZone): 'ripper' | 'strong' | 'weak';

  // Check if price is IN a fib zone
  isInZone(price: number): FibZone | null;

  // Sweep detection:
  // Price wicks below zone floor (for longs) or above zone ceiling (for shorts)
  // then closes back inside the zone
  checkSweep(bar: Bar, direction: 'long' | 'short'): { swept: boolean; zone: FibZone | null };

  // Sweep completion check:
  // Did price reach the HTF pivot? (not just touch the zone edge)
  // An incomplete sweep = too early, first entry may fail
  checkSweepComplete(price: number, htfPivot: number, direction: 'long' | 'short'): boolean;

  // Zone invalidation:
  // Clean break through (not a wick — a CLOSE beyond the zone)
  // Old zone becomes TP target only, not entry zone
  checkInvalidation(bar: Bar, zone: FibZone): boolean;

  // Extension levels for targets (TP2, TP3)
  getExtensionLevels(): number[];

  // Anchored VWAP from catalyst point
  // Plain, no bands, 48h staleness (expires after 48h)
  setVwapAnchor(price: number, timestamp: number): void;
  updateVwap(bar: Bar): number | null;
  get vwapValue(): number | null;

  // Neckline tracking (15-min swing highs/lows from prior sessions)
  // These act as targets AND gravity points
  addNeckline(price: number, type: 'high' | 'low'): void;
  getNearestNeckline(price: number, direction: 'long' | 'short'): number | null;
  isNearNeckline(price: number, threshold: number): boolean;
}
```

**PivotDetector port:** Reference `quantconnect/docs/PlaybookSweepReclaim.cs` for the swing point detection logic. Port the algorithm but adapt to Bar type from T1.

### 3. `backend-hono/src/services/algo-engine/confluence.ts`

15-point scoring system that gates execution.

```typescript
import { AntilagSignal, FibZone, ConfluenceScore } from './types';

class ConfluenceScorer {
  // Scoring breakdown:
  // Fib zone location:  +3 (Ripper zone), +2 (Strong), +1 (Weak)
  // Antilag strength:   +3 (obvious — ATR spike > 2x avg), +1 (marginal — 1.5-2x)
  // EMA proximity:      +2 (at 20 EMA), +2 (at 100 EMA) — can get both if EMAs are close
  // RSI extremity:      +2 (outside 35-65), +1 (outside 45-55)
  // ES confirmation:    +2 (aligned — ES trending same direction), +0 (divergent)
  // VWAP confluence:    +1 (price near anchored VWAP)
  //
  // Total possible: 15
  // Auto-execute threshold: >= 8
  // Manual review: 5-7
  // Reject: < 5

  score(
    fibZone: FibZone | null,
    antilagSignal: AntilagSignal | null,
    ema20Distance: number,
    ema100Distance: number,
    rsi: number,
    esAligned: boolean,
    nearVwap: boolean
  ): ConfluenceScore;

  get autoExecuteThreshold(): number;  // 8
}
```

---

## VERIFICATION

1. All imports resolve against T1's types
2. `npx tsc --noEmit` passes
3. FibEngine produces correct zones from known swing points (manually verify a few)
4. AntilagDetector correctly identifies engulfing candles (the math must be right)
5. ConfluenceScorer produces correct totals

## CHANGELOG

```typescript
{ date: '2026-03-26T...', agent: 'claude-code', summary: '[S1-T3] Intelligence layer: Antilag detector (NQ-primary), Fib engine (zones not lines), Confluence scorer (15pt)', files: ['backend-hono/src/services/algo-engine/antilag.ts', 'backend-hono/src/services/algo-engine/fib-engine.ts', 'backend-hono/src/services/algo-engine/confluence.ts'] }
```

## DO NOT

- Touch the 40/40 Club model file (that's T2)
- Wire to Rithmic or real data (T4 / Sprint 3)
- Create test files (Sprint 2)
- Touch frontend files
- Implement any cross-instrument VELOCITY matching (the old way was wrong)
