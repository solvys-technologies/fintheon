# S5-T1: Foundation — Types + Migration + Config

**Sprint:** S5 (Execution Bridge — Safety-Critical Path)
**Track:** T1 — Foundation
**Dependencies:** None (runs first; T2/T3/T4 depend on this)

---

## Objective
Define all shared types for the execution bridge, reconciler, and trade runs system. Deploy the `trade_runs` migration. Add environment variable stubs. After T1, every other track can import stable interfaces and build against them.

---

## Files to Read First
- `backend-hono/src/types/projectx.ts` — Existing ProjectX types (OrderStatus, OrderType, OrderSide, ProjectXAccount, ProjectXContract, ProjectXPosition, ProjectXOrder, ProjectXCredentials)
- `backend-hono/src/types/trading.ts` — Existing Position, AlgoStatus, ToggleAlgoResponse types
- `backend-hono/src/services/rithmic-service.ts` — Gateway interface shape (GatewayStatus, GatewayOrderResponse) to replicate for bridge
- `backend-hono/migrations/006_trading_proposals.sql` — Existing trading_proposals + execution_log schema
- `backend-hono/src/config/scoring-weights.json` — Current scoring config structure
- `backend-hono/.env.example` — Current env var inventory (198 vars)

---

## Files to Create

### 1. `backend-hono/src/types/execution-bridge.ts`

All types shared between the reconciler, projectx-service, and bridge.

```typescript
// ── Bridge HTTP Interface Types ──

export interface BridgeHealthResponse {
  connected: boolean;
  system: string;
  account: string;
  message: string;
}

export interface BridgeExecuteRequest {
  model: string;              // 'flush' | 'ripper' | '40_40_club'
  direction: 'long' | 'short';
  symbol: string;             // 'MNQ', 'ES', etc.
  confluence_score: number;
  position_size: number;
  entry_price: number | null; // null = market order
  stop_loss_ticks: number;
  take_profit_ticks: number;
  hour_fib_context?: HourFibContext;
  signal_metadata?: SignalMetadata;
}

export interface BridgeExecuteResponse {
  status: 'filled' | 'rejected' | 'pending' | 'error';
  order_id: string;
  fill_price: number | null;
  timestamp: string;
  message: string;
}

export interface BridgePositionResponse {
  positions: BridgePosition[];
  account_id: string;
}

export interface BridgePosition {
  contract_id: string;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  average_price: number;
  unrealized_pnl: number;
}

export interface BridgeAccountResponse {
  account_id: string;
  balance: number;
  buying_power: number;
  can_trade: boolean;
  pdpt_remaining: number;
}

// ── Algo Playbook Types ──

export interface HourFibContext {
  hour: number;
  sweep_occurred: 'high' | 'low' | 'none';
  fib_1_41_probability: number;
  fib_1_68_probability: number;
  post_sweep_retrace_probability: number;
}

export interface SignalMetadata {
  pmi_chain_active: boolean;
  narrative_bias: 'bullish' | 'bearish' | 'neutral';
  session: 'premarket' | 'NY_open' | 'lunch' | 'PM' | 'after_hours';
}

// ── Reconciler Types ──

export enum ReconcilerState {
  IDLE = 'IDLE',
  ORDER_SENT = 'ORDER_SENT',
  PENDING_CONFIRM = 'PENDING_CONFIRM',
  FILLED = 'FILLED',
  REJECTED = 'REJECTED',
  TIMEOUT = 'TIMEOUT',
  RECONCILING = 'RECONCILING',
  CORRECTED = 'CORRECTED',
  ALERT = 'ALERT',
}

export interface ReconcilerRules {
  maxOrdersPerMinute: number;        // 2
  confirmationTimeoutSec: number;    // 8
  duplicateWindowSec: number;        // 30
  hardStopTime: string;              // '11:30' ET
  maxConcurrentPositions: number;    // 1
  pdptBufferUsd: number;             // 50 ($1,550 - $50 = $1,500 actual floor)
  reconnectBackoffSec: number[];     // [2, 4, 8, 16, 32]
}

export interface ReconcilerOrder {
  id: string;
  state: ReconcilerState;
  symbol: string;
  direction: 'long' | 'short';
  bridgeOrderId?: string;
  sentAt: number;
  confirmedAt?: number;
  retryCount: number;
  lastError?: string;
}

// ── Trade Run Types ──

export interface TradeRun {
  id: string;
  timestamp: string;
  model: string;
  symbol: string;
  direction: 'long' | 'short';
  confluenceScore: number;
  entryPrice: number | null;
  fillPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  exitPrice: number | null;
  pnl: number | null;
  hourOfDay: number;
  session: string;
  fibContext: HourFibContext | null;
  signalMetadata: SignalMetadata | null;
  reconcilerStatus: ReconcilerState;
  featuresFired: Record<string, unknown> | null;
  modelPrediction: Record<string, unknown> | null;
  proposalId?: string;
}
```

### 2. `backend-hono/migrations/023_trade_runs.sql`

```sql
-- Migration 023: Trade runs table for enriched execution tracking
-- Extends beyond execution_log with algo playbook context

CREATE TABLE IF NOT EXISTS trade_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Strategy context
  model VARCHAR(20) NOT NULL,              -- flush, ripper, 40_40_club
  symbol VARCHAR(10) NOT NULL,             -- MNQ, ES, etc.
  direction VARCHAR(5) NOT NULL,           -- long, short

  -- Scoring
  confluence_score INT NOT NULL,

  -- Price data
  entry_price DECIMAL(10,2),
  fill_price DECIMAL(10,2),
  stop_loss DECIMAL(10,2),
  take_profit DECIMAL(10,2),
  exit_price DECIMAL(10,2),
  pnl DECIMAL(10,2),

  -- Time context
  hour_of_day INT NOT NULL,
  session VARCHAR(20) NOT NULL,

  -- Algo playbook enrichment
  fib_context JSONB,                       -- HourFibContext
  signal_metadata JSONB,                   -- SignalMetadata

  -- Reconciler
  reconciler_status VARCHAR(20) NOT NULL,

  -- ML / confluence breakdown
  features_fired JSONB,                    -- every confluence point that contributed
  model_prediction JSONB,                  -- ML output if applicable

  -- Link to proposal system
  proposal_id UUID REFERENCES trading_proposals(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trade_runs_timestamp ON trade_runs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trade_runs_model ON trade_runs(model);
CREATE INDEX IF NOT EXISTS idx_trade_runs_symbol ON trade_runs(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_runs_session ON trade_runs(session);
CREATE INDEX IF NOT EXISTS idx_trade_runs_proposal ON trade_runs(proposal_id);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_trade_run_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_trade_run_updated ON trade_runs;
CREATE TRIGGER trigger_trade_run_updated
  BEFORE UPDATE ON trade_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_trade_run_timestamp();
```

---

## Files to Modify

### 3. `backend-hono/src/types/projectx.ts`

**Add** request/response types for order placement that the bridge will use:

```typescript
// Add at end of file:

export interface PlaceOrderRequest {
  accountId: number;
  contractId: string;
  type: OrderType;
  side: OrderSide;
  size: number;
  limitPrice?: number;
  stopPrice?: number;
  customTag?: string;
}

export interface PlaceOrderResponse {
  success: boolean;
  orderId?: number;
  errorCode?: number;
  errorMessage?: string;
}
```

### 4. `backend-hono/.env.example`

**Add** these vars in the "Trading Infrastructure" section:

```bash
# Execution Bridge (ProjectX via project-x-py)
BRIDGE_URL=http://localhost:8001
PROJECTX_API_KEY=
PROJECTX_USERNAME=

# Reconciler
HARD_STOP_TIME=11:30
PDPT_FLOOR=1500
MAX_CONCURRENT_POSITIONS=1
MAX_ORDERS_PER_MINUTE=2
CONFIRMATION_TIMEOUT_SEC=8
DUPLICATE_WINDOW_SEC=30
```

---

## Verification
1. `npx tsc --noEmit` — zero errors after adding types
2. `grep -r 'execution-bridge' backend-hono/src/types/` — confirms new type file is importable
3. Migration SQL is valid: `psql $NEON_DATABASE_URL -f backend-hono/migrations/023_trade_runs.sql` (or verify syntax manually)
4. `.env.example` contains all new vars

---

## Changelog Entry
```typescript
{ date: '2026-03-28T14:00:00', agent: 'claude-code', summary: 'S5-T1: Foundation types for execution bridge, reconciler state machine, trade_runs migration, env vars', files: ['backend-hono/src/types/execution-bridge.ts', 'backend-hono/migrations/023_trade_runs.sql', 'backend-hono/src/types/projectx.ts', 'backend-hono/.env.example'] }
```

---

## DO NOT
- Do NOT create any service implementations (T2/T3/T4 own those)
- Do NOT modify proposal-service.ts or trading-service.ts (T3/T4 own those)
- Do NOT create the Python bridge (T2 owns that)
- Do NOT write route handlers (T4 owns those)
- Do NOT add anything to boot/index.ts (T4 owns that)
