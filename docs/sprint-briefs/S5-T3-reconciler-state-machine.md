# S5-T3: Reconciler — TypeScript State Machine

**Sprint:** S5 (Execution Bridge — Safety-Critical Path)
**Track:** T3 — Reconciler
**Dependencies:** T1 complete (imports ReconcilerState, ReconcilerRules, ReconcilerOrder, TradeRun types)

---

## Objective
Build the reconciler service — the safety gatekeeper between the Hermes proposal system and the execution bridge. Every order passes through the reconciler. It enforces duplicate prevention, PDPT floor, hard stop time, rate limits, max concurrent positions, and handles dropped confirmations. Based on Eddie's article: *"Without something like this you're not running a trading bot. You're running a prayer."*

---

## Files to Read First
- `backend-hono/src/types/execution-bridge.ts` — (created by T1) ReconcilerState enum, ReconcilerRules, ReconcilerOrder, TradeRun, BridgeExecuteResponse, BridgeAccountResponse, BridgePositionResponse
- `backend-hono/src/services/autopilot/proposal-service.ts` — Full file. Understand the `executeProposal()` flow (lines 262-391). You'll add the reconciler gate before the broker call.
- `backend-hono/src/services/autopilot/autopilot-scheduler.ts` — `isRTHActive()`, `getSessionWindow()` — reuse these, don't reinvent.
- `backend-hono/src/services/rithmic-service.ts` — HTTP sidecar call pattern. The reconciler calls the bridge via the same pattern (but through projectx-service, which T4 builds). For reconciler testing, you can call the bridge directly as a fallback.
- `backend-hono/src/config/database.ts` — `sql()` template function, `isDatabaseAvailable()`. Use these for all DB operations.
- `backend-hono/migrations/023_trade_runs.sql` — (created by T1) Table schema you'll insert into.

---

## Files to Create

### 1. `backend-hono/src/services/reconciler-service.ts`

**Max 300 lines.** This is the core safety module.

#### State Machine

```
IDLE → ORDER_SENT → PENDING_CONFIRM → FILLED
                                    → REJECTED
                                    → TIMEOUT → RECONCILING → CORRECTED
                                                            → ALERT
```

#### Implementation Spec

```typescript
import { ReconcilerState, ReconcilerRules, ReconcilerOrder, type TradeRun, type BridgeExecuteResponse } from '../types/execution-bridge.js';
import { sql, isDatabaseAvailable } from '../config/database.js';
import { isRTHActive, getSessionWindow } from './autopilot/autopilot-scheduler.js';

// ── Configuration (from env) ──

const RULES: ReconcilerRules = {
  maxOrdersPerMinute: Number(process.env.MAX_ORDERS_PER_MINUTE ?? 2),
  confirmationTimeoutSec: Number(process.env.CONFIRMATION_TIMEOUT_SEC ?? 8),
  duplicateWindowSec: Number(process.env.DUPLICATE_WINDOW_SEC ?? 30),
  hardStopTime: process.env.HARD_STOP_TIME ?? '11:30',
  maxConcurrentPositions: Number(process.env.MAX_CONCURRENT_POSITIONS ?? 1),
  pdptBufferUsd: 50,
  reconnectBackoffSec: [2, 4, 8, 16, 32],
};

// ── In-Memory State ──
// Recent orders for duplicate detection + rate limiting
// Active reconciler orders for confirmation tracking

// ── Pre-flight Guards (all must pass before ORDER_SENT) ──

// 1. duplicateGuard(symbol, direction) → checks if same symbol+direction
//    was sent within RULES.duplicateWindowSec. Throws DuplicateOrderError.

// 2. pdptGuard(bridgeAccountBalance) → calls bridge GET /account,
//    checks balance > RULES.pdptBufferUsd + 1500. Throws PDPTBreachError.

// 3. hardStopGuard() → parses RULES.hardStopTime as ET,
//    compares to current ET time. Throws HardStopError.

// 4. concurrentPositionGuard(bridgePositions) → calls bridge GET /position,
//    checks positions.length < RULES.maxConcurrentPositions.
//    Throws MaxPositionsError.

// 5. rateLimitGuard() → counts orders in last 60s,
//    checks < RULES.maxOrdersPerMinute. Throws RateLimitError.

// ── Core Execute Method ──

// async executeWithReconciliation(
//   request: BridgeExecuteRequest,
//   bridgeCall: (req) => Promise<BridgeExecuteResponse>,
//   positionQuery: () => Promise<BridgePositionResponse>,
//   accountQuery: () => Promise<BridgeAccountResponse>,
// ): Promise<{ success: boolean; order: ReconcilerOrder; tradeRun: TradeRun }>
//
// Flow:
// 1. Run all 5 guards (any failure → reject, log, return)
// 2. Create ReconcilerOrder in ORDER_SENT state
// 3. Call bridgeCall(request) → BridgeExecuteResponse
// 4. If response.status === 'filled' → transition to FILLED
// 5. If response.status === 'rejected' → transition to REJECTED
// 6. If response.status === 'pending' → transition to PENDING_CONFIRM
//    → Start confirmation timeout (RULES.confirmationTimeoutSec)
//    → On timeout: transition to TIMEOUT → RECONCILING
//      → Call positionQuery() to check if position actually exists
//      → If position exists: transition to CORRECTED (order went through, confirm was lost)
//      → If no position: transition to ALERT (order truly failed)
// 7. Log TradeRun to database
// 8. Return result

// ── Database Logging ──

// async logTradeRun(run: TradeRun): Promise<void>
// Inserts into trade_runs table using sql() helper.
// Falls back to console.log if DB unavailable.

// ── State Getters (for frontend/API) ──

// getReconcilerStatus(): { state, activeOrders, recentRuns, rules }
// getRecentTradeRuns(limit): TradeRun[]
```

#### Error Types

Define these as simple classes (not a separate file — keep in same module):

```typescript
class DuplicateOrderError extends Error { code = 'DUPLICATE_ORDER' }
class PDPTBreachError extends Error { code = 'PDPT_BREACH' }
class HardStopError extends Error { code = 'HARD_STOP' }
class MaxPositionsError extends Error { code = 'MAX_POSITIONS' }
class RateLimitError extends Error { code = 'RATE_LIMIT' }
```

---

## Files to Modify

### 2. `backend-hono/src/services/autopilot/proposal-service.ts`

**What:** Add the reconciler gate in the `executeProposal()` function for the `projectx` broker path.

**Where:** After line 280 (`const primaryBroker = ...`), add a new `if (primaryBroker === 'projectx')` block BEFORE the existing rithmic/hyperliquid blocks.

**Pattern:**
```typescript
if (primaryBroker === 'projectx') {
  // Import reconciler
  const { executeWithReconciliation } = await import('../reconciler-service.js');
  // Import bridge client (T4 builds this, but define the interface here)
  const bridgeUrl = process.env.BRIDGE_URL ?? 'http://localhost:8001';

  // Build bridge call functions
  const bridgeCall = async (req) => {
    const res = await fetch(`${bridgeUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return res.json();
  };
  const positionQuery = async () => {
    const res = await fetch(`${bridgeUrl}/position`);
    return res.json();
  };
  const accountQuery = async () => {
    const res = await fetch(`${bridgeUrl}/account`);
    return res.json();
  };

  const result = await executeWithReconciliation(
    {
      model: proposal.setupType || '40_40_club',
      direction: proposal.direction as 'long' | 'short',
      symbol: proposal.instrument,
      confluence_score: Math.round(proposal.confidenceScore * 15),
      position_size: proposal.positionSize,
      entry_price: proposal.entryPrice ?? null,
      stop_loss_ticks: 12,  // TODO: derive from proposal.stopLoss
      take_profit_ticks: 24, // TODO: derive from proposal.takeProfit
    },
    bridgeCall,
    positionQuery,
    accountQuery,
  );

  if (!result.success) {
    return { success: false, error: result.order.lastError ?? 'Reconciler rejected' };
  }

  // Update proposal status
  const now = new Date();
  const executionResult = {
    orderId: result.order.bridgeOrderId ?? `PX-${Date.now()}`,
    filledAt: now.toISOString(),
    fillPrice: proposal.entryPrice,
    contracts: proposal.positionSize,
    reconcilerStatus: result.order.state,
    message: 'Order executed via ProjectX bridge',
  };
  const orderId = result.order.bridgeOrderId ?? executionResult.orderId;

  if (isDatabaseAvailable() && sql) {
    await sql`
      UPDATE trading_proposals
      SET status = 'executed',
          executed_at = ${now.toISOString()},
          execution_result = ${JSON.stringify(executionResult)}::jsonb,
          projectx_order_id = ${orderId}
      WHERE id = ${proposalId}
    `;
  } else {
    proposal.status = 'executed';
    proposal.executedAt = now.toISOString();
    proposal.executionResult = executionResult;
    proposal.updatedAt = now.toISOString();
    proposalCache.set(proposalId, proposal);
  }

  return { success: true, orderId };
}
```

**Note:** During unification, T4 will replace the raw `fetch` calls with the proper `projectx-service` module. For now, inline fetch is fine to keep T3 independently buildable.

---

## Verification
1. `npx tsc --noEmit` — zero errors
2. Unit test the guards in isolation:
   - Call `duplicateGuard('MNQ', 'long')` twice within 30s → second throws
   - Set `HARD_STOP_TIME=00:00` → `hardStopGuard()` throws (it's always past midnight)
   - Set `MAX_CONCURRENT_POSITIONS=0` → guard throws
3. Integration: with bridge running on :8001, call `executeWithReconciliation` directly → verify trade_runs row created
4. `bun run build` passes

---

## Changelog Entry
```typescript
{ date: '2026-03-28T14:00:00', agent: 'claude-code', summary: 'S5-T3: Reconciler state machine — duplicate guard, PDPT floor, hard stop, confirmation timeout, trade_runs logging', files: ['backend-hono/src/services/reconciler-service.ts', 'backend-hono/src/services/autopilot/proposal-service.ts'] }
```

---

## DO NOT
- Do NOT create the Python bridge (T2 owns that)
- Do NOT create `projectx-service.ts` (T4 owns that) — use inline fetch for bridge calls
- Do NOT modify trading routes or handlers (T4 owns those)
- Do NOT modify boot/index.ts (T4 owns that)
- Do NOT implement the algo playbook or fib context enrichment (S2 scope)
- Do NOT add WebSocket listeners or streaming — reconciliation is synchronous HTTP with timeout
