# S5-T4: ProjectX Service + Route Wiring

**Sprint:** S5 (Execution Bridge — Safety-Critical Path)
**Track:** T4 — Service Layer + API Routes
**Dependencies:** T1 complete (types), T2 endpoint contracts known, T3 reconciler importable

---

## Objective
Create the TypeScript HTTP client for the FastAPI bridge (mirroring `rithmic-service.ts` exactly), wire it into `trading-service.ts` as the `projectx` broker path, add API routes for real position/account data, and register a health check on boot. After T4, the Hono backend can route orders through ProjectX end-to-end.

---

## Files to Read First
- `backend-hono/src/services/rithmic-service.ts` — **The template.** Your `projectx-service.ts` must follow this exact pattern: `gatewayFetch<T>()` helper, `hasCredentials()`, `getConnectionStatus()`, `executeOrder()`. Copy the shape, change the URL and types.
- `backend-hono/src/services/hyperliquid-service.ts` — Secondary reference for the broker interface contract (same `executeOrder` signature).
- `backend-hono/src/services/trading-service.ts` — Where you add the `projectx` case in `fireTestTrade()`. Read the rithmic and hyperliquid paths (lines 88-124) — yours follows the same pattern.
- `backend-hono/src/types/execution-bridge.ts` — (created by T1) All bridge types: `BridgeHealthResponse`, `BridgeExecuteRequest`, `BridgeExecuteResponse`, `BridgePositionResponse`, `BridgeAccountResponse`
- `backend-hono/src/routes/trading/index.ts` — Current routes (positions mock, algo-status, toggle-algo, test-trade)
- `backend-hono/src/routes/trading/handlers.ts` — Current handlers calling trading-service
- `backend-hono/src/boot/index.ts` — Where background services are initialized on startup

---

## Files to Create

### 1. `backend-hono/src/services/projectx-service.ts`

HTTP client for the FastAPI bridge. **Must match rithmic-service.ts shape exactly.**

```typescript
// [claude-code 2026-03-28] ProjectX service — HTTP client for execution bridge sidecar
/**
 * ProjectX Service
 * Calls the execution-bridge FastAPI sidecar on localhost:8001.
 *
 * Start the bridge: cd execution-bridge && uvicorn main:app --port 8001
 * Env required: BRIDGE_URL (default: http://localhost:8001)
 */

import type {
  BridgeHealthResponse,
  BridgeExecuteRequest,
  BridgeExecuteResponse,
  BridgePositionResponse,
  BridgeAccountResponse,
} from '../types/execution-bridge.js';

const BRIDGE_URL = process.env.BRIDGE_URL ?? 'http://localhost:8001';

// ── Generic fetch helper (mirrors rithmic-service.ts gatewayFetch) ──

async function bridgeFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((body.detail as string) ?? `Bridge error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Public API (same shape as rithmic-service + hyperliquid-service) ──

export function hasCredentials(_userId: string): boolean {
  return Boolean(process.env.BRIDGE_URL ?? 'http://localhost:8001');
}

export async function getConnectionStatus(_userId: string): Promise<{ connected: boolean; message: string }> {
  try {
    const status = await bridgeFetch<BridgeHealthResponse>('/health');
    return {
      connected: status.connected,
      message: status.message,
    };
  } catch {
    return {
      connected: false,
      message: 'Execution bridge unreachable — start execution-bridge/main.py',
    };
  }
}

export async function executeOrder(
  _userId: string,
  params: {
    symbol: string;
    direction: 'long' | 'short';
    quantity: number;
    entryPrice?: number;
    stopLoss?: number;
    takeProfit?: number[];
    [key: string]: unknown;
  },
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const result = await bridgeFetch<BridgeExecuteResponse>('/execute', {
      method: 'POST',
      body: JSON.stringify({
        model: (params.model as string) ?? '40_40_club',
        direction: params.direction,
        symbol: params.symbol.replace(/^\//, ''),
        confluence_score: (params.confluenceScore as number) ?? 0,
        position_size: params.quantity,
        entry_price: params.entryPrice ?? null,
        stop_loss_ticks: (params.stopLossTicks as number) ?? 12,
        take_profit_ticks: (params.takeProfitTicks as number) ?? 24,
      } satisfies Partial<BridgeExecuteRequest>),
    });

    if (result.status === 'error' || result.status === 'rejected') {
      return { success: false, error: result.message };
    }

    return {
      success: true,
      orderId: result.order_id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bridge execution error';
    return { success: false, error: message };
  }
}

export async function getPositions(_userId: string): Promise<BridgePositionResponse> {
  return bridgeFetch<BridgePositionResponse>('/position');
}

export async function getAccount(_userId: string): Promise<BridgeAccountResponse> {
  return bridgeFetch<BridgeAccountResponse>('/account');
}

export async function cancelOrder(_userId: string, orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await bridgeFetch<{ success: boolean }>(`/cancel/${orderId}`, { method: 'POST' });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Cancel failed' };
  }
}
```

---

## Files to Modify

### 2. `backend-hono/src/services/trading-service.ts`

**Add** the `projectx` case in `fireTestTrade()`. Insert BEFORE the existing rithmic default path (around line 88).

```typescript
// Add import at top:
import * as projectxService from './projectx-service.js';

// Add in fireTestTrade(), after line 91 (const direction = ...):
if (broker === 'projectx') {
  const result = await projectxService.executeOrder(userId, {
    symbol: symbolSearch,
    direction,
    quantity: 1,
  });
  if (!result.success) {
    throw new Error(result.error ?? 'ProjectX order failed');
  }

  return {
    success: true,
    orderId: result.orderId,
    message: `Order #${result.orderId} placed — 1 ${symbolSearch} ${direction.toUpperCase()} @ Market (ProjectX)`,
  };
}
```

Also update the broker type on line 88:
```typescript
// Change:
const broker = (process.env.PRIMARY_BROKER ?? 'rithmic') as 'rithmic' | 'hyperliquid';
// To:
const broker = (process.env.PRIMARY_BROKER ?? 'rithmic') as 'rithmic' | 'hyperliquid' | 'projectx';
```

### 3. `backend-hono/src/routes/trading/index.ts`

**Add** new routes for real positions, account info, cancel, and reconciler status.

```typescript
// Add after existing routes:

// GET /api/trading/bridge-positions - Real positions from ProjectX bridge
router.get('/bridge-positions', handleGetBridgePositions);

// GET /api/trading/bridge-account - Real account from ProjectX bridge
router.get('/bridge-account', handleGetBridgeAccount);

// POST /api/trading/cancel-order - Cancel an open order
router.post('/cancel-order', handleCancelOrder);

// GET /api/trading/reconciler-status - Current reconciler state
router.get('/reconciler-status', handleGetReconcilerStatus);

// GET /api/trading/trade-runs - Recent trade runs with enriched metadata
router.get('/trade-runs', handleGetTradeRuns);
```

### 4. `backend-hono/src/routes/trading/handlers.ts`

**Add** the new handler functions. Keep each handler short — delegate to service layer.

```typescript
import * as projectxService from '../../services/projectx-service.js';
import { getReconcilerStatus, getRecentTradeRuns } from '../../services/reconciler-service.js';

export async function handleGetBridgePositions(c: Context) {
  try {
    const userId = c.get('userId') ?? 'default';
    const result = await projectxService.getPositions(userId);
    return c.json(result);
  } catch (error) {
    return c.json({ error: 'Failed to fetch positions from bridge' }, 500);
  }
}

export async function handleGetBridgeAccount(c: Context) {
  try {
    const userId = c.get('userId') ?? 'default';
    const result = await projectxService.getAccount(userId);
    return c.json(result);
  } catch (error) {
    return c.json({ error: 'Failed to fetch account from bridge' }, 500);
  }
}

export async function handleCancelOrder(c: Context) {
  try {
    const userId = c.get('userId') ?? 'default';
    const { orderId } = await c.req.json();
    const result = await projectxService.cancelOrder(userId, orderId);
    return c.json(result);
  } catch (error) {
    return c.json({ error: 'Failed to cancel order' }, 500);
  }
}

export async function handleGetReconcilerStatus(c: Context) {
  try {
    const status = getReconcilerStatus();
    return c.json(status);
  } catch (error) {
    return c.json({ error: 'Failed to get reconciler status' }, 500);
  }
}

export async function handleGetTradeRuns(c: Context) {
  try {
    const limit = Number(c.req.query('limit') ?? 20);
    const runs = await getRecentTradeRuns(limit);
    return c.json({ runs, total: runs.length });
  } catch (error) {
    return c.json({ error: 'Failed to get trade runs' }, 500);
  }
}
```

### 5. `backend-hono/src/boot/index.ts`

**Add** a non-blocking bridge health check at startup (same pattern as `initHermesAgent`).

Find the section where services are initialized (look for `initHermesAgent` or similar non-blocking inits). Add:

```typescript
// Execution bridge health check (non-blocking)
import * as projectxService from '../services/projectx-service.js';

async function initBridgeHealthCheck() {
  try {
    const status = await projectxService.getConnectionStatus('system');
    if (status.connected) {
      console.log('[Boot] Execution bridge connected');
    } else {
      console.log(`[Boot] Execution bridge not available: ${status.message}`);
    }
  } catch {
    console.log('[Boot] Execution bridge not available (will retry on first use)');
  }
}

// Call it in the startup sequence (non-blocking):
initBridgeHealthCheck().catch(() => {});
```

---

## Verification
1. `npx tsc --noEmit` — zero errors
2. `bun run build` — passes
3. With bridge running: `curl localhost:8080/api/trading/bridge-positions` → returns real position data
4. `curl localhost:8080/api/trading/bridge-account` → returns account info
5. `curl localhost:8080/api/trading/reconciler-status` → returns reconciler state
6. `curl -X POST localhost:8080/api/trading/test-trade -H 'Content-Type: application/json' -d '{"accountId":"test","symbol":"MNQ","side":"buy"}'` with `PRIMARY_BROKER=projectx` → routes through projectx-service → bridge
7. Boot log shows bridge health check message

---

## Changelog Entry
```typescript
{ date: '2026-03-28T14:00:00', agent: 'claude-code', summary: 'S5-T4: ProjectX service client + trading route wiring + bridge health check on boot', files: ['backend-hono/src/services/projectx-service.ts', 'backend-hono/src/services/trading-service.ts', 'backend-hono/src/routes/trading/index.ts', 'backend-hono/src/routes/trading/handlers.ts', 'backend-hono/src/boot/index.ts'] }
```

---

## DO NOT
- Do NOT create or modify the Python bridge (T2 owns that)
- Do NOT create the reconciler logic (T3 owns that) — only import `getReconcilerStatus` and `getRecentTradeRuns` from it
- Do NOT create types or migrations (T1 owns those)
- Do NOT modify proposal-service.ts (T3 owns the reconciler integration there)
- Do NOT add frontend components (S2 scope)
- Do NOT add algo playbook or fib context enrichment (S2 scope)
