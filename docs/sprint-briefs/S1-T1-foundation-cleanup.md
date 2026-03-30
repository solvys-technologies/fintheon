# Sprint 1 — Track 1: Foundation + Strategy Cleanup

**Branch:** `v.8.25.4` (from `v.8.25.3`)
**Priority:** RUNS FIRST — all other tracks depend on this completing.
**Scope:** Create algo engine foundation types + indicators, delete all non-core strategy references.

---

## CONTEXT

Read these files before starting:
- `docs/quantconnect/STRATEGY-40-40-CLUB.md` — the corrected 40/40 Club spec (13 corrections from video analysis)
- `CLAUDE.md` — project rules, changelog protocol, build commands
- `src/lib/changelog.ts` — add entries after changes
- `backend-hono/src/types/trading.ts` — existing trading types (modify, don't replace)
- `backend-hono/src/types/agents.ts` — MarketDataReport, TechnicalReport, TradingProposal (REUSE)
- `backend-hono/src/services/autopilot/autopilot-scheduler.ts` — session windows (modify)
- `quantconnect/FortyFortyClub/main.py` — reference for RollingWindow, EMA, RSI, ATR implementations

## PART 1: Create Foundation (new files)

### `backend-hono/src/services/algo-engine/types.ts`
Core types for the entire engine. Every other track imports from here.

```typescript
// Bar types
interface Tick { timestamp: number; price: number; volume: number; instrument: 'MNQ' | 'ES'; bid: number; ask: number; }
interface Bar { open: number; high: number; low: number; close: number; volume: number; timestamp: number; duration: number; tickCount: number; }
type TickBar = Bar; // alias for clarity

// Position
interface Position { instrument: 'MNQ' | 'ES'; direction: 'long' | 'short'; entryPrice: number; contracts: number; stopPrice: number; targetPrice: number; entryTime: number; }

// Trailing stop phases (from video corrections)
type TrailingPhase = 'engulfing-anchor' | 'break-even' | 'ema-defense' | 'ema-100-trail';

// Fib
interface FibZone { highLevel: number; lowLevel: number; highPrice: number; lowPrice: number; classification: 'ripper' | 'strong' | 'weak'; }
// Zone is BETWEEN two adjacent fib levels, not a single line

// Antilag
interface AntilagSignal { timestamp: number; instrument: 'MNQ' | 'ES'; atrSpike: number; isEngulfing: boolean; barRange: number; averageRange: number; nearFibZone: boolean; nearEma: boolean; direction: 'long' | 'short'; }

// Strategy
type StrategyModel = '40-40-club' | 'flush' | 'ripper';

// Session
interface SessionWindow { name: string; startHour: number; startMinute: number; endHour: number; endMinute: number; timezone: string; }

// Regime + Day Type
type RegimeType = 'TRENDING' | 'RANGE_BOUND' | 'BINARY_EVENT' | 'RISK_OFF' | 'UNKNOWN';
type DayType = 'base-hit' | 'home-run';

// Confluence scoring (15-point system)
interface ConfluenceScore { fibZone: number; antilagStrength: number; emaProximity: number; rsiExtremity: number; esConfirmation: number; vwapConfluence: number; total: number; }

// Access Denied pattern
interface AccessDeniedSignal { timestamp: number; candleCount: number; retestLevel: number; emaDefended: boolean; confirmed: boolean; }
```

### `backend-hono/src/services/algo-engine/rolling-window.ts`
Generic typed rolling window. Port from QC's Python `RollingWindow`.

```typescript
class RollingWindow<T> {
  private items: T[];
  private capacity: number;
  private count: number;

  constructor(capacity: number);
  add(item: T): void;
  get(index: number): T;        // 0 = most recent
  get isReady(): boolean;        // count >= capacity
  get mostRecent(): T;
  get length(): number;
  toArray(): T[];
  reset(): void;
}
```

### `backend-hono/src/services/algo-engine/tick-consolidator.ts`
Aggregates raw ticks into bars.

```typescript
class TickConsolidator {
  private tickCount: number;      // 1000 for NQ, 500 for ES
  private currentBar: Partial<Bar> | null;
  private onBarComplete: (bar: Bar) => void;

  constructor(tickCount: number, onBarComplete: (bar: Bar) => void);
  update(tick: Tick): void;       // feed each tick, emits bar via callback when complete
  get currentPartialBar(): Partial<Bar> | null;
  reset(): void;
}
```

### `backend-hono/src/services/algo-engine/indicators.ts`
Stateful indicator classes. Each has `.update(bar)` that returns the current value.

```typescript
class EMA {
  constructor(period: number);
  update(bar: Bar): number;
  get value(): number;
  get isReady(): boolean;
}

class RSI {
  // Wilder's smoothing method
  constructor(period: number);
  update(bar: Bar): number;
  get value(): number;
  get isReady(): boolean;
}

class ATR {
  constructor(period: number);
  update(bar: Bar): number;
  get value(): number;
  get isReady(): boolean;
}
```

Reference `quantconnect/FortyFortyClub/main.py` for the math — port the exact calculations to TypeScript. EMA uses Wilder's smoothing for RSI. ATR is true range averaged.

---

## PART 2: Strategy Cleanup (modify existing files)

Delete ALL references to these non-core strategies across the codebase:
- AWV (Aggressive Volatility Wave)
- Snipe
- Scalp
- Fade
- Momentum Burst
- Opening Range Break
- VWAP Bounce
- Any other strategy name that is NOT: `40-40-club`, `flush`, `ripper`

### Files to modify:

1. **`backend-hono/src/types/trading.ts`** — Change StrategyModel to only allow `'40-40-club' | 'flush' | 'ripper'`

2. **`backend-hono/src/services/autopilot/autopilot-scheduler.ts`** — Remove session windows for non-core strats. Keep only the `forty_forty` window and any shared RTH detection logic.

3. **`backend-hono/src/services/agents/trader-agent.ts`** — Remove non-core strategy names from enum/switch. Keep FORTY_FORTY_CLUB, FLUSH, RIPPER only + DISCRETIONARY as fallback.

4. **`frontend/components/AutopilotControls.tsx`** — Remove non-core strategy items from any lists/dropdowns.

5. **`frontend/components/mission-control/AlgoStatusWidget.tsx`** — Remove non-core strategy categories/displays.

6. **`docs/autopilot-strategies/STRATEGY-INDEX.md`** — Strip to core 3 only.

7. **`docs/autopilot-strategies/STRATEGY-SPECS.md`** — Strip to core 3 only.

8. **`backend-hono/src/services/ai/agent-instructions/philosophy-blocks.ts`** — Keep Feucht's 40/40/Flush/Ripper refs, remove others.

### How to find them:
```bash
grep -rn "AWV\|Snipe\|Scalp\|Fade\|Momentum.Burst\|Opening.Range\|VWAP.Bounce\|aggressive.volatility" backend-hono/ frontend/ docs/ --include="*.ts" --include="*.tsx" --include="*.md"
```

Delete or replace every hit. If a switch/case or enum has these values, remove them. If a file is ONLY about a non-core strategy, delete the file.

---

## VERIFICATION

After completing both parts:
1. `npx tsc --noEmit` — zero errors
2. `bun run build` — clean
3. `cd backend-hono && bun run dev` — starts without crash
4. Grep for removed strategy names returns 0 hits (outside docs/archive or git history)
5. All new files under 300 lines

## CHANGELOG

Add entry to `src/lib/changelog.ts`:
```typescript
{ date: '2026-03-26T...', agent: 'claude-code', summary: '[S1-T1] Algo engine foundation types + indicators + strategy cleanup (core 3 only)', files: ['backend-hono/src/services/algo-engine/types.ts', 'backend-hono/src/services/algo-engine/rolling-window.ts', 'backend-hono/src/services/algo-engine/tick-consolidator.ts', 'backend-hono/src/services/algo-engine/indicators.ts', '...modified files...'] }
```

Also add comment at top of each new file:
```typescript
// [claude-code 2026-03-26] S1-T1: Algo engine foundation — types/indicators/consolidator
```

## DO NOT

- Touch any files outside the listed scope
- Add Flush or Ripper model logic (Sprint 1 is 40/40 Club only)
- Create test files (that's Sprint 2)
- Wire anything to the Rithmic service (that's T4)
- Add frontend components (that's Sprint 3)
