# S6-T1: Algo Playbook Engine

**Sprint:** S6 (Intelligence Layer)
**Track:** T1 — Playbook Engine
**Dependencies:** None (runs first; T2/T3 depend on this)

---

## Objective
Build the HourlyFibContext class that loads `hourly-sweep-table.json`, scores the current hour's statistical edge, and injects +0/+1/+2 confluence points into every trade signal before execution. Wire it into the proposal execution path so every trade_runs record includes fib_context.

---

## Files to Read First
- `backend-hono/src/config/hourly-sweep-table.json` — The research data. Study the schema: each hour has `high_sweep_pct`, `low_sweep_pct`, `post_sweep_fib_141`, `post_sweep_fib_168`, `retrace_to_open`, `retrace_to_swept_level`, plus NY session hours have `breach_events`, `segment_00_20/20_40/40_60`, `mfe_mae_ratio`. The `_aln_patterns` key has overnight session pattern data.
- `backend-hono/src/types/execution-bridge.ts` — `HourFibContext`, `SignalMetadata`, `TradeRun` types you must use
- `backend-hono/src/services/reconciler-service.ts` — How `executeWithReconciliation` works. Your enrichment runs BEFORE the reconciler call.
- `backend-hono/src/services/autopilot/proposal-service.ts` — The `executeProposal()` function where you wire in enrichment (the projectx broker path around line 280+)
- `backend-hono/src/services/autopilot/autopilot-scheduler.ts` — `getSessionWindow()` returns session names you can reuse
- `backend-hono/src/config/scoring-weights.json` — Current scoring config for reference

---

## Files to Create

### 1. `backend-hono/src/services/algo-playbook.ts`

**Max 250 lines.** The core intelligence module.

```typescript
// [claude-code 2026-03-28] Algo Playbook Engine — hourly fib context scoring

import type { HourFibContext, SignalMetadata } from '../types/execution-bridge.js';
import { getSessionWindow } from './autopilot/autopilot-scheduler.js';
import sweepTableRaw from '../config/hourly-sweep-table.json' with { type: 'json' };

// Type the sweep table entries
interface HourStats {
  high_sweep_pct: number;
  low_sweep_pct: number;
  post_sweep_fib_141: number;
  post_sweep_fib_168: number;
  retrace_to_open: number;
  retrace_to_swept_level: number;
  session?: string;
  breach_events?: number;
  mfe_mae_ratio?: number;
  segment_00_20?: number;
  segment_20_40?: number;
  segment_40_60?: number;
  notes?: string;
}

// Parse sweep table (skip _meta and _aln_patterns keys)
const SWEEP_TABLE: Record<number, HourStats> = {};
for (let h = 0; h < 24; h++) {
  const key = `hour_${h}`;
  if (key in sweepTableRaw) {
    SWEEP_TABLE[h] = (sweepTableRaw as Record<string, HourStats>)[key];
  }
}
```

**Core methods to implement:**

```typescript
/**
 * Score the current hour's statistical edge.
 * Returns confluence points to add (0, 1, or 2) plus full probability context.
 *
 * Rules:
 *   +1 if post_sweep_fib_141 >= 0.60 (strong hour for fib extension)
 *   +1 if retrace_to_open >= 0.70 (high-probability reversion hour)
 *   +1 if mfe_mae_ratio >= 1.40 (favorable risk/reward after reversion)
 *   Cap at +2 max
 */
export function scoreHour(currentHour: number, sweepType: 'high' | 'low' | 'none'): {
  confluenceAdd: number;
  fibContext: HourFibContext;
}

/**
 * Get the current session name for SignalMetadata.
 * Maps autopilot-scheduler's session windows to our session enum.
 */
export function getCurrentSession(): SignalMetadata['session']

/**
 * Enrich a trade signal with full playbook context.
 * Called before reconciler — injects fib_context and signal_metadata.
 */
export function enrichTradeSignal(params: {
  symbol: string;
  direction: 'long' | 'short';
  confluenceScore: number;
  narrativeBias?: 'bullish' | 'bearish' | 'neutral';
}): {
  enrichedConfluence: number;
  fibContext: HourFibContext;
  signalMetadata: SignalMetadata;
}

/**
 * Get the full stats for a given hour (for frontend display).
 */
export function getHourStats(hour: number): HourStats | null

/**
 * Get all hours summary (for frontend dashboard).
 */
export function getAllHourStats(): Record<number, HourStats>
```

**Implementation notes:**
- `scoreHour`: Get current ET hour, look up in SWEEP_TABLE, apply the 3 rules, cap at +2
- `getCurrentSession`: Map `getSessionWindow()` output ('morning_flush' → 'NY_open', 'forty_forty' → 'NY_open', 'lunch_flush' → 'lunch', 'power_hour' → 'PM', null → detect from hour)
- `enrichTradeSignal`: Calls `scoreHour`, builds `HourFibContext` and `SignalMetadata`, returns enriched confluence score (original + confluenceAdd)
- For sweep detection: the caller passes `sweepType` based on whether price has swept the prior hour's high/low. Default to `'none'` if unknown.

### 2. `backend-hono/src/config/playbook-models.json`

Static model definitions referencing the research data.

```json
{
  "models": {
    "sweep_retrace": {
      "description": "Previous hour high swept → short targeting 1.0 hourly open",
      "hourFilter": null,
      "fibTarget": "retrace_to_open",
      "statThreshold": 0.85,
      "confluenceAdd": 1
    },
    "fib_extension": {
      "description": "Sweep + momentum → target 1.41/1.68 fib extension",
      "hourFilter": [3, 9, 15],
      "fibTarget": "post_sweep_fib_141",
      "statThreshold": 0.60,
      "confluenceAdd": 2
    },
    "flush_hook": {
      "description": "AM flush + 9:40 ORB → 0.618 retracement",
      "hourFilter": [9, 10],
      "fibTarget": "segment_00_20",
      "statThreshold": 0.80,
      "confluenceAdd": 1
    },
    "forty_forty_setup": {
      "description": "Existing 40/40 Club model enriched with hourly context",
      "hourFilter": null,
      "fibTarget": null,
      "statThreshold": null,
      "confluenceAdd": 0,
      "notes": "Uses enrichTradeSignal() — hour context adds +0/+1/+2 on top of existing confluence"
    }
  }
}
```

---

## Files to Modify

### 3. `backend-hono/src/services/autopilot/proposal-service.ts`

**Where:** In the `projectx` broker path inside `executeProposal()` (the block T3 added in S5).

**What:** Before the `executeWithReconciliation` call, add playbook enrichment:

```typescript
// Add import at top:
import { enrichTradeSignal } from '../algo-playbook.js';

// Inside the projectx broker block, BEFORE the reconciler call:
const enrichment = enrichTradeSignal({
  symbol: proposal.instrument,
  direction: proposal.direction as 'long' | 'short',
  confluenceScore: Math.round(proposal.confidenceScore * 15),
  narrativeBias: 'neutral', // TODO: wire from Hermes narrative
});

// Pass enriched data to reconciler:
const result = await executeWithReconciliation(
  {
    model: proposal.setupType || '40_40_club',
    direction: proposal.direction as 'long' | 'short',
    symbol: proposal.instrument,
    confluence_score: enrichment.enrichedConfluence, // <-- enriched, not raw
    position_size: proposal.positionSize,
    entry_price: proposal.entryPrice ?? null,
    stop_loss_ticks: 12,
    take_profit_ticks: 24,
    hour_fib_context: enrichment.fibContext,          // <-- NEW
    signal_metadata: enrichment.signalMetadata,       // <-- NEW
  },
  bridgeCall,
  positionQuery,
  accountQuery,
);
```

### 4. `backend-hono/src/routes/trading/index.ts`

**Add** playbook API routes:

```typescript
// GET /api/trading/playbook/hour/:hour — stats for a specific hour
router.get('/playbook/hour/:hour', handleGetHourStats);

// GET /api/trading/playbook/current — current hour enrichment preview
router.get('/playbook/current', handleGetCurrentPlaybook);

// GET /api/trading/playbook/all — all 24 hours summary
router.get('/playbook/all', handleGetAllHourStats);
```

Add matching handlers in `handlers.ts`:
```typescript
import { getHourStats, getAllHourStats, enrichTradeSignal, getCurrentSession } from '../../services/algo-playbook.js';

export async function handleGetHourStats(c: Context) {
  const hour = Number(c.req.param('hour'));
  const stats = getHourStats(hour);
  if (!stats) return c.json({ error: 'Invalid hour' }, 400);
  return c.json(stats);
}

export async function handleGetCurrentPlaybook(c: Context) {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = et.getHours();
  const enrichment = enrichTradeSignal({
    symbol: 'MNQ',
    direction: 'long',
    confluenceScore: 8,
  });
  return c.json({ hour, session: getCurrentSession(), ...enrichment });
}

export async function handleGetAllHourStats(c: Context) {
  return c.json(getAllHourStats());
}
```

---

## Verification
1. `npx tsc --noEmit` — zero errors
2. `bun run build` — passes
3. `curl localhost:8080/api/trading/playbook/current` → returns enriched data with fib_context
4. `curl localhost:8080/api/trading/playbook/hour/9` → returns hour 9 stats (75.2% reversion, 1.51x MFE/MAE)
5. `curl localhost:8080/api/trading/playbook/all` → returns all 24 hours

---

## Changelog Entry
```typescript
{ date: '2026-03-28T16:00:00', agent: 'claude-code', summary: 'S6-T1: Algo Playbook Engine — hourly fib context scoring, trade signal enrichment, playbook API routes', files: ['backend-hono/src/services/algo-playbook.ts', 'backend-hono/src/config/playbook-models.json', 'backend-hono/src/services/autopilot/proposal-service.ts', 'backend-hono/src/routes/trading/index.ts', 'backend-hono/src/routes/trading/handlers.ts'] }
```

---

## DO NOT
- Do NOT modify the reconciler (S5 owns that)
- Do NOT modify the bridge Python code (S5 owns that)
- Do NOT create validation/backtesting code (T2 owns that)
- Do NOT create frontend components (T3 owns that)
- Do NOT modify hourly-sweep-table.json (research data is frozen)
