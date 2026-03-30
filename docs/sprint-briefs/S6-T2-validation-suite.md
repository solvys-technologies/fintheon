# S6-T2: Validation Suite — Walk-Forward + Monte Carlo

**Sprint:** S6 (Intelligence Layer)
**Track:** T2 — Validation & Backtesting
**Dependencies:** T1 complete (playbook engine provides enrichment context)

---

## Objective
Build the validation suite that gates autonomous execution. No model ships without passing: walk-forward Sharpe ≥ 1.2, positive out-of-sample equity curve, and Monte Carlo P(max drawdown > PDPT) < 5%. Per Eddie's methodology: "Humbling. Run it anyway."

---

## Files to Read First
- `backend-hono/src/services/algo-playbook.ts` — (created by T1) How enrichment works, what data is available per trade
- `backend-hono/src/config/hourly-sweep-table.json` — Statistical foundation for hour-based edge
- `backend-hono/src/config/playbook-models.json` — (created by T1) Model definitions with stat thresholds
- `backend-hono/src/types/execution-bridge.ts` — `TradeRun` interface (what a trade record looks like)
- `backend-hono/src/config/database.ts` — `sql()` helper and `isDatabaseAvailable()`
- `quantconnect/FortyFortyClub/main.py` — Strategy parameters: PDPT cap ($1,550), max contracts (25), initial size (10), scale-in (5), max re-entries (3)

---

## Files to Create

### 1. `backend-hono/src/services/validation/walk-forward.ts`

**Max 200 lines.** Sliding window train/test validation.

```typescript
// [claude-code 2026-03-28] Walk-forward validation harness

import type { TradeRun } from '../../types/execution-bridge.js';

interface WalkForwardConfig {
  trainWindowDays: number;   // e.g., 60
  testWindowDays: number;    // e.g., 20
  stepDays: number;          // e.g., 10 (how far to slide each iteration)
  minTradesPerWindow: number; // minimum trades to consider a window valid
}

interface WindowResult {
  windowStart: string;
  windowEnd: string;
  trainTrades: number;
  testTrades: number;
  sharpeRatio: number;
  winRate: number;
  avgPnl: number;
  maxDrawdown: number;
  passed: boolean;           // sharpe >= threshold
}

interface WalkForwardResult {
  windows: WindowResult[];
  overallSharpe: number;
  allWindowsPassed: boolean;
  passRate: number;          // % of windows that passed
  totalTrades: number;
}

/**
 * Run walk-forward validation on a set of trades.
 * Slides a train/test window forward through the data.
 * Each window: train on the first N days, test on the next M days.
 * The edge must hold across ALL test windows.
 */
export function walkForward(
  trades: TradeRun[],
  config: WalkForwardConfig,
  sharpeThreshold: number    // 1.2 default
): WalkForwardResult

/**
 * Calculate Sharpe ratio for a set of trades.
 * Sharpe = mean(daily returns) / stddev(daily returns) * sqrt(252)
 */
export function calculateSharpe(trades: TradeRun[]): number

/**
 * Calculate maximum drawdown from a sequence of trades.
 * Returns the largest peak-to-trough decline in cumulative PnL.
 */
export function calculateMaxDrawdown(trades: TradeRun[]): number
```

### 2. `backend-hono/src/services/validation/monte-carlo.ts`

**Max 200 lines.** Shuffle trade order N times, measure worst-case outcomes.

```typescript
// [claude-code 2026-03-28] Monte Carlo simulation for trade sequence risk

import type { TradeRun } from '../../types/execution-bridge.js';

interface MonteCarloConfig {
  nSimulations: number;      // 10,000 default
  pdptFloor: number;         // $1,500 (account minimum)
  startingBalance: number;   // $50,000 (TopStep account size)
  confidenceLevel: number;   // 0.95 (95th percentile)
}

interface MonteCarloResult {
  simulations: number;
  worstDrawdown: number;
  medianDrawdown: number;
  percentile95Drawdown: number;
  percentile99Drawdown: number;
  probabilityOfRuin: number;           // P(balance hits $0)
  probabilityOfPDPTBreach: number;     // P(drawdown > PDPT floor)
  probabilityOfPassingTopStep: number; // P(reaching profit target without PDPT breach)
  passed: boolean;                     // P(PDPT breach) < 5%
  equityCurveStats: {
    mean: number;
    stdDev: number;
    best: number;
    worst: number;
  };
}

/**
 * Run Monte Carlo simulation.
 * Shuffles the trade order N times.
 * For each shuffle: replay trades sequentially, track balance, record max drawdown.
 * Output: distribution of outcomes across all simulations.
 */
export function monteCarloSimulation(
  trades: TradeRun[],
  config: MonteCarloConfig
): MonteCarloResult

/**
 * Fisher-Yates shuffle (in-place, returns new array).
 */
function shuffleArray<T>(arr: T[]): T[]
```

### 3. `backend-hono/src/services/validation/out-of-sample.ts`

**Max 100 lines.** Final blind test — touched once, ever.

```typescript
// [claude-code 2026-03-28] Out-of-sample vault — final blind test

import type { TradeRun } from '../../types/execution-bridge.js';
import { calculateSharpe, calculateMaxDrawdown } from './walk-forward.js';

interface OOSResult {
  trades: number;
  sharpeRatio: number;
  winRate: number;
  totalPnl: number;
  maxDrawdown: number;
  equityCurvePositive: boolean;
  passed: boolean;
}

/**
 * Run out-of-sample validation on held-out data.
 * This data must NEVER have been used in walk-forward training.
 * Equity curve must be positive (net profitable).
 */
export function outOfSampleTest(heldOutTrades: TradeRun[]): OOSResult
```

### 4. `backend-hono/src/services/validation/index.ts`

**Max 150 lines.** Orchestrator that runs all three validators and produces a pass/fail gate.

```typescript
// [claude-code 2026-03-28] Validation suite — gates autonomous execution

import type { TradeRun } from '../../types/execution-bridge.js';
import { walkForward } from './walk-forward.js';
import { monteCarloSimulation } from './monte-carlo.js';
import { outOfSampleTest } from './out-of-sample.js';
import { sql, isDatabaseAvailable } from '../../config/database.js';

interface ValidationResult {
  timestamp: string;
  model: string;
  walkForward: { passed: boolean; overallSharpe: number; passRate: number };
  monteCarlo: { passed: boolean; pdptBreachProb: number; ruinProb: number };
  outOfSample: { passed: boolean; equityCurvePositive: boolean; sharpe: number };
  overallPassed: boolean;  // ALL three must pass
  gateStatus: 'approved' | 'rejected';
}

/**
 * Run the full validation suite for a given model.
 * Fetches trade_runs from DB, splits into train/test/holdout,
 * runs all three validators.
 *
 * Acceptance criteria:
 * 1. Walk-forward Sharpe >= 1.2 across all windows
 * 2. Out-of-sample equity curve positive
 * 3. Monte Carlo P(max drawdown > PDPT) < 5%
 */
export async function runValidationSuite(
  model: string,
  options?: {
    sharpeThreshold?: number;
    pdptBreachThreshold?: number;
    simulations?: number;
  }
): Promise<ValidationResult>

/**
 * Fetch trade runs for a model from the database.
 */
async function fetchTradeRuns(model: string): Promise<TradeRun[]>

/**
 * Get the most recent validation result for a model.
 */
export async function getValidationResult(model: string): Promise<ValidationResult | null>
```

### 5. `backend-hono/src/routes/validation/index.ts`

API routes for running and querying validation.

```typescript
import { Hono } from 'hono';
import { runValidationSuite, getValidationResult } from '../../services/validation/index.js';

export function createValidationRoutes(): Hono {
  const router = new Hono();

  // POST /api/validation/run — run full suite for a model
  // Body: { model: string, sharpeThreshold?: number }
  // Returns: ValidationResult
  router.post('/run', async (c) => {
    const { model, sharpeThreshold, simulations } = await c.req.json();
    if (!model) return c.json({ error: 'model required' }, 400);
    const result = await runValidationSuite(model, { sharpeThreshold, simulations });
    return c.json(result);
  });

  // GET /api/validation/result/:model — get latest result
  router.get('/result/:model', async (c) => {
    const model = c.req.param('model');
    const result = await getValidationResult(model);
    if (!result) return c.json({ error: 'No validation results found' }, 404);
    return c.json(result);
  });

  return router;
}
```

**Also modify `backend-hono/src/index.ts`** (or wherever routes are mounted) to add:
```typescript
import { createValidationRoutes } from './routes/validation/index.js';
app.route('/api/validation', createValidationRoutes());
```

---

## Verification
1. `npx tsc --noEmit` — zero errors
2. `bun run build` — passes
3. Seed trade_runs with test data, then: `curl -X POST localhost:8080/api/validation/run -H 'Content-Type: application/json' -d '{"model":"40_40_club"}'`
4. Verify response includes walkForward, monteCarlo, outOfSample results with pass/fail
5. `curl localhost:8080/api/validation/result/40_40_club` → returns cached result

---

## Changelog Entry
```typescript
{ date: '2026-03-28T16:00:00', agent: 'claude-code', summary: 'S6-T2: Validation Suite — walk-forward (Sharpe >= 1.2), Monte Carlo (P(PDPT breach) < 5%), OOS equity curve gate', files: ['backend-hono/src/services/validation/walk-forward.ts', 'backend-hono/src/services/validation/monte-carlo.ts', 'backend-hono/src/services/validation/out-of-sample.ts', 'backend-hono/src/services/validation/index.ts', 'backend-hono/src/routes/validation/index.ts'] }
```

---

## DO NOT
- Do NOT modify the algo playbook engine (T1 owns that)
- Do NOT create frontend components (T3 owns those)
- Do NOT modify the reconciler or bridge (S5 scope)
- Do NOT modify hourly-sweep-table.json
- Do NOT run validation against live trading — test data only
