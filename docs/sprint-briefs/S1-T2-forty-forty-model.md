# Sprint 1 — Track 2: 40/40 Club Model

**Branch:** `v.8.25.4` (same branch as T1, merge after T1 completes)
**Depends on:** T1 must be complete (types.ts, indicators.ts, rolling-window.ts exist)
**Scope:** Build the complete 40/40 Club trading model — entry, trailing stop, Access Denied, scale-in, exit logic, PDPT tracker.

---

## CONTEXT

Read these files FIRST — they are your source of truth:
- `docs/quantconnect/STRATEGY-40-40-CLUB.md` — THE corrected spec. 13 corrections from video analysis. Every rule in your code must match this document.
- `backend-hono/src/services/algo-engine/types.ts` — T1 created these types. Import everything from here.
- `backend-hono/src/services/algo-engine/indicators.ts` — T1 created EMA, RSI, ATR. Use them.
- `backend-hono/src/services/algo-engine/rolling-window.ts` — T1 created this. Use it.
- `quantconnect/FortyFortyClub/main.py` — OLD Python implementation. Reference for logic flow, but the STRATEGY doc overrides where they conflict.
- `CLAUDE.md` — project rules, changelog protocol

## KEY CORRECTIONS FROM VIDEO ANALYSIS (baked into the strategy doc)

These are non-negotiable — the old QC code gets these wrong:

1. **Antilag = ATR spike + engulfing candle on NQ** (not cross-instrument velocity). ES is soft bias.
2. **Stop = butt of the engulfing candle** (not fixed points or ATR multiplier). Structural.
3. **Trailing = EMA defense** (price bounces off 20 EMA, resumes trend → move stop to below bounce). NOT fixed distance.
4. **Access Denied** = first bearish candle in bullish impulse (or vice versa). Means retest coming, NOT reversal. 1-2 candles.
5. **Scale-in** = Antilag fires again mid-trade while EMA holds. Same signal as entry. Simple.
6. **Even-price exit** = if round number between price and 100 EMA, and price stalls → close.
7. **Reverse trailing TP** = bring TP closer (not further) when market is aggressive but risky.
8. **Mid-trade news** = expect retest. Apply Access Denied. If holds, stay in.
9. **Re-entry** = first entry may fail (incomplete sweep). Re-enter at LOWER price after full sweep. Max 3 attempts.

---

## FILES TO CREATE

### 1. `backend-hono/src/services/algo-engine/forty-forty-club.ts`

The main model. Orchestrates entry decisions.

```typescript
import { Bar, Position, FibZone, AntilagSignal, ConfluenceScore, StrategyModel } from './types';

interface FortyFortyDependencies {
  // These come from T3 (Intelligence Layer) — code against the interface
  checkAntilag(nqBar: Bar, nqBars: Bar[], esBar: Bar | null): AntilagSignal | null;
  checkFibZone(price: number): FibZone | null;
  checkSweepComplete(price: number, fibZone: FibZone): boolean;
  scoreConfluence(signal: AntilagSignal, fibZone: FibZone, rsi: number, esAligned: boolean, nearVwap: boolean): ConfluenceScore;
}

class FortyFortyClub {
  private attempts: number = 0;     // max 3 per setup
  private maxAttempts: number = 3;
  private cutoffHour: number = 11;
  private cutoffMinute: number = 55;
  private position: Position | null = null;

  constructor(private deps: FortyFortyDependencies);

  // Core entry logic:
  // 1. Check time filter (before 11:55 ET)
  // 2. Check fib zone sweep is COMPLETE (into HTF pivot)
  // 3. Check Antilag fires on NQ (ATR spike + engulfing)
  // 4. Check RSI outside 45-55 on 15-min
  // 5. Score confluence (must be >= 8)
  // 6. Check attempts < 3
  // 7. Check PDPT not locked
  checkEntry(nqBar: Bar, nqBars: Bar[], esBar: Bar | null, rsi15m: number, pdptLocked: boolean, currentTime: Date): EntrySignal | null;

  // Re-entry after stop-out:
  // - Must be at a LOWER price (longs) or HIGHER price (shorts) than previous attempt
  // - Fresh Antilag required
  // - Sweep must now be complete (this is why re-entry works when first entry didn't)
  checkReEntry(nqBar: Bar, nqBars: Bar[], esBar: Bar | null, previousEntryPrice: number, rsi15m: number, currentTime: Date): EntrySignal | null;

  // Alternate entry: cross-instrument divergence
  // - NQ bearish EMA cross while ES bullish (or vice versa)
  // - Pin bar at structural level is valid (no full Antilag needed)
  // - NQ plays catch-up to ES
  checkDivergenceEntry(nqBar: Bar, esBar: Bar, nqEma20: number, nqEma100: number, esEma20: number, esEma100: number): EntrySignal | null;

  resetDaily(): void;  // reset attempts, position state at RTH open
}

interface EntrySignal {
  direction: 'long' | 'short';
  entryPrice: number;
  stopPrice: number;         // butt of engulfing candle
  targetPrice: number;       // 100 EMA
  confluenceScore: ConfluenceScore;
  contracts: number;         // initial: 10
  model: '40-40-club';
  attemptNumber: number;
}
```

### 2. `backend-hono/src/services/algo-engine/trailing-stop.ts`

4-phase trailing stop system.

```typescript
import { Bar, Position, TrailingPhase } from './types';

class TrailingStop {
  private phase: TrailingPhase = 'engulfing-anchor';
  private stopPrice: number;
  private lastEmaBounceLevel: number | null = null;

  constructor(initialStop: number, private direction: 'long' | 'short');

  // Phase 1: engulfing-anchor
  // Stop is at the butt (low for longs, high for shorts) of the engulfing candle that confirmed entry.
  // "Less than 10% chance price returns without sweeping" — right or right out.

  // Phase 2: break-even
  // After scale-in, move stop to break-even. Triggered by EMA retest + close above contested.

  // Phase 3: ema-defense
  // Stop moves to below the most recent EMA BOUNCE.
  // "EMA confirms defense of the move" = price tested 20 EMA, held, resumed trend.
  // NOT fixed distance. NOT cycle snapping. The EMA defended → trail to just below.
  // Do NOT trail during straight-line moves near 15-min necklines (give breathing room).

  // Phase 4: ema-100-trail
  // When ATR > 17 (extended move), trail below 100 EMA.

  update(bar: Bar, ema20: number, ema100: number, atr: number, nearNeckline: boolean): number;

  // Returns the new stop price after evaluating the current bar
  // Stop NEVER moves against position direction

  get currentPhase(): TrailingPhase;
  get currentStop(): number;

  // Advance phase based on conditions
  advanceToBreakEven(breakEvenPrice: number): void;
  advanceToEmaDefense(): void;
  advanceToEma100Trail(): void;
}
```

**Critical rules from the videos:**
- Phase 3 trigger: price bounces off 20 EMA → next candle resumes trend → stop moves to below the bounce low
- Do NOT trail when nearNeckline is true (15-min swing high/low nearby that hasn't been retested)
- Each new ATR spike + engulfing mid-trade also creates a new anchor (update stop to butt of new engulfing)

### 3. `backend-hono/src/services/algo-engine/access-denied.ts`

Detects the "first bearish candle in a bullish impulse" pattern.

```typescript
import { Bar, AccessDeniedSignal } from './types';

class AccessDeniedDetector {
  // In a bullish move on 1000T, detect the first bearish candle (sometimes 2 candles).
  // This is NOT a reversal signal — it means a retest is coming.
  // The retest pulls back to 20 EMA or prior structural level.
  // If retest holds and price rejects off Fast/Slow EMA → trade is confirmed crystal clear.

  detect(bars: Bar[], ema20: number, ema100: number, trendDirection: 'long' | 'short'): AccessDeniedSignal | null;

  // After detection:
  // 1. Expect retest to EMA or structural level
  // 2. If retest holds → tighten trailing stop to below retest low
  // 3. If price closes above short-term resistance that caused rejection → move confirmed stronger
  // 4. Mid-trade news that causes a retest → apply same logic

  confirmRetest(retestBar: Bar, ema20: number, originalResistance: number): boolean;
}
```

### 4. `backend-hono/src/services/algo-engine/scale-in.ts`

Simplified from the old "overtaking candle" logic.

```typescript
import { Bar, Position, AntilagSignal } from './types';

class ScaleInManager {
  private scaleCount: number = 0;
  private maxContracts: number = 25;       // 20 after 12:30 ET
  private contractsPerAdd: number = 5;

  constructor(private position: Position);

  // Scale-in trigger: Antilag fires again mid-trade while EMA holds.
  // Same signal as entry, just happening again during the move.
  // Any ATR spike confirming trend is alive = scale-in trigger.
  checkScaleIn(antilagSignal: AntilagSignal | null, ema20: number, currentTime: Date): ScaleInSignal | null;

  get canScaleIn(): boolean;   // contracts not maxed, position exists
  get totalContracts(): number;

  reset(): void;
}

interface ScaleInSignal {
  addContracts: number;        // always 5
  newStopPrice: number;        // butt of the new engulfing candle
  totalContracts: number;
}
```

### 5. `backend-hono/src/services/algo-engine/pdpt-tracker.ts`

Profit/drawdown tracking for TopStepX compliance.

```typescript
class PDPTTracker {
  private dailyPnL: number = 0;
  private mode: 'combine' | 'funded';
  private combineLimit: number = 1550;      // $1,550 hard cap
  private fundedDailyTarget: number = 1500; // trailing avg ~$1,500/day

  constructor(mode: 'combine' | 'funded');

  update(pnl: number): void;
  get isLocked(): boolean;          // exceeded daily limit
  get remaining(): number;          // dollars remaining before lockout
  get shouldTighten(): boolean;     // $50-100 remaining → tighten limit orders
  resetDaily(): void;
}
```

### 6. `backend-hono/src/services/algo-engine/exit-logic.ts`

Handles all exit conditions.

```typescript
import { Bar, Position } from './types';

class ExitLogic {
  // Primary target: 100 EMA (mean reversion)
  // Even-price-level check: round number between price and 100 EMA, price stalls → close
  // Reverse trailing TP: bring TP closer when market is aggressive but risky
  // Mid-trade news: expect retest, apply Access Denied, stay if holds
  // TP2/TP3 fib extensions: -0.756, -0.828, -0.844

  checkExit(bar: Bar, position: Position, ema100: number, fibExtensions: number[], newsEventActive: boolean): ExitSignal | null;

  // Even-price stall detection
  private isStalling(bars: Bar[], roundLevel: number): boolean;
  // 2+ doji/small-body candles near the round number

  // Round number detection (xx,000 / xx,025 / xx,050 / xx,075)
  private nearestRoundLevel(price: number): number;
}

interface ExitSignal {
  reason: 'target-hit' | 'even-level-stall' | 'reverse-trail-tp' | 'thesis-broken' | 'pdpt-lock';
  exitPrice: number;
}
```

---

## VERIFICATION

1. All imports resolve against T1's types.ts and indicators.ts
2. `npx tsc --noEmit` passes
3. Every method signature matches the strategy doc
4. No hardcoded magic numbers without a comment explaining the source (video correction #)

## CHANGELOG

```typescript
{ date: '2026-03-26T...', agent: 'claude-code', summary: '[S1-T2] 40/40 Club model: entry, trailing stop (4-phase), Access Denied, scale-in, exit logic, PDPT', files: ['backend-hono/src/services/algo-engine/forty-forty-club.ts', 'backend-hono/src/services/algo-engine/trailing-stop.ts', 'backend-hono/src/services/algo-engine/access-denied.ts', 'backend-hono/src/services/algo-engine/scale-in.ts', 'backend-hono/src/services/algo-engine/pdpt-tracker.ts', 'backend-hono/src/services/algo-engine/exit-logic.ts'] }
```

## DO NOT

- Implement the Antilag or FibEngine logic (that's T3) — code against their INTERFACES only
- Create test files (Sprint 2)
- Wire to Rithmic or real data (T4 / Sprint 3)
- Touch frontend files
- Implement Flush or Ripper models
