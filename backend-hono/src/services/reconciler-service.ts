// [claude-code 2026-03-28] S5-T3: Reconciler state machine — safety gatekeeper between proposals and execution bridge

import {
  ReconcilerState,
  type ReconcilerRules,
  type ReconcilerOrder,
  type TradeRun,
  type BridgeExecuteRequest,
  type BridgeExecuteResponse,
  type BridgePositionResponse,
  type BridgeAccountResponse,
} from '../types/execution-bridge.js';
import { sql, isDatabaseAvailable } from '../config/database.js';
import { getSessionWindow } from './autopilot/autopilot-scheduler.js';

// ── Error Types ──

class DuplicateOrderError extends Error { code = 'DUPLICATE_ORDER' as const; }
class PDPTBreachError extends Error { code = 'PDPT_BREACH' as const; }
class HardStopError extends Error { code = 'HARD_STOP' as const; }
class MaxPositionsError extends Error { code = 'MAX_POSITIONS' as const; }
class RateLimitError extends Error { code = 'RATE_LIMIT' as const; }

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

interface RecentOrder {
  symbol: string;
  direction: 'long' | 'short';
  sentAt: number;
}

const recentOrders: RecentOrder[] = [];
const activeOrders = new Map<string, ReconcilerOrder>();
const recentTradeRuns: TradeRun[] = [];

function pruneRecentOrders() {
  const cutoff = Date.now() - 60_000;
  while (recentOrders.length > 0 && recentOrders[0].sentAt < cutoff) {
    recentOrders.shift();
  }
}

// ── Pre-flight Guards ──

function duplicateGuard(symbol: string, direction: 'long' | 'short'): void {
  const cutoff = Date.now() - RULES.duplicateWindowSec * 1000;
  const dup = recentOrders.find(
    (o) => o.symbol === symbol && o.direction === direction && o.sentAt > cutoff
  );
  if (dup) {
    throw new DuplicateOrderError(
      `Duplicate ${direction} ${symbol} within ${RULES.duplicateWindowSec}s window`
    );
  }
}

function pdptGuard(account: BridgeAccountResponse): void {
  const floor = 1500 + RULES.pdptBufferUsd;
  if (account.balance < floor) {
    throw new PDPTBreachError(
      `Balance $${account.balance.toFixed(2)} below PDPT floor $${floor}`
    );
  }
}

function hardStopGuard(): void {
  const now = new Date();
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const [stopH, stopM] = RULES.hardStopTime.split(':').map(Number);
  const currentMinutes = est.getHours() * 60 + est.getMinutes();
  const stopMinutes = stopH * 60 + stopM;

  if (currentMinutes >= stopMinutes) {
    throw new HardStopError(
      `Past hard stop time ${RULES.hardStopTime} ET (current ${est.getHours()}:${String(est.getMinutes()).padStart(2, '0')})`
    );
  }
}

function concurrentPositionGuard(positions: BridgePositionResponse): void {
  if (positions.positions.length >= RULES.maxConcurrentPositions) {
    throw new MaxPositionsError(
      `${positions.positions.length} positions open (max ${RULES.maxConcurrentPositions})`
    );
  }
}

function rateLimitGuard(): void {
  pruneRecentOrders();
  const oneMinuteAgo = Date.now() - 60_000;
  const count = recentOrders.filter((o) => o.sentAt > oneMinuteAgo).length;
  if (count >= RULES.maxOrdersPerMinute) {
    throw new RateLimitError(
      `${count} orders in last 60s (max ${RULES.maxOrdersPerMinute})`
    );
  }
}

// ── Core Execute Method ──

export async function executeWithReconciliation(
  request: BridgeExecuteRequest,
  bridgeCall: (req: BridgeExecuteRequest) => Promise<BridgeExecuteResponse>,
  positionQuery: () => Promise<BridgePositionResponse>,
  accountQuery: () => Promise<BridgeAccountResponse>,
): Promise<{ success: boolean; order: ReconcilerOrder; tradeRun: TradeRun }> {
  const orderId = crypto.randomUUID();
  const now = Date.now();

  const order: ReconcilerOrder = {
    id: orderId,
    state: ReconcilerState.IDLE,
    symbol: request.symbol,
    direction: request.direction,
    sentAt: now,
    retryCount: 0,
  };

  const estNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const tradeRun: TradeRun = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    model: request.model,
    symbol: request.symbol,
    direction: request.direction,
    confluenceScore: request.confluence_score,
    entryPrice: request.entry_price,
    fillPrice: null,
    stopLoss: request.stop_loss_ticks,
    takeProfit: request.take_profit_ticks,
    exitPrice: null,
    pnl: null,
    hourOfDay: estNow.getHours(),
    session: getSessionWindow() ?? 'unknown',
    fibContext: request.hour_fib_context ?? null,
    signalMetadata: request.signal_metadata ?? null,
    reconcilerStatus: ReconcilerState.IDLE,
    featuresFired: null,
    modelPrediction: null,
  };

  // ── Run all 5 guards ──
  try {
    const [account, positions] = await Promise.all([accountQuery(), positionQuery()]);
    duplicateGuard(request.symbol, request.direction);
    pdptGuard(account);
    hardStopGuard();
    concurrentPositionGuard(positions);
    rateLimitGuard();
  } catch (err) {
    const guardError = err as Error & { code?: string };
    order.state = ReconcilerState.REJECTED;
    order.lastError = `Guard: ${guardError.code ?? 'UNKNOWN'} — ${guardError.message}`;
    tradeRun.reconcilerStatus = ReconcilerState.REJECTED;
    await logTradeRun(tradeRun);
    console.warn(`[Reconciler] Guard rejected: ${order.lastError}`);
    return { success: false, order, tradeRun };
  }

  // ── Record order + send ──
  order.state = ReconcilerState.ORDER_SENT;
  activeOrders.set(orderId, order);
  recentOrders.push({ symbol: request.symbol, direction: request.direction, sentAt: now });

  let response: BridgeExecuteResponse;
  try {
    response = await bridgeCall(request);
  } catch (err) {
    order.state = ReconcilerState.ALERT;
    order.lastError = `Bridge call failed: ${(err as Error).message}`;
    tradeRun.reconcilerStatus = ReconcilerState.ALERT;
    activeOrders.delete(orderId);
    await logTradeRun(tradeRun);
    console.error(`[Reconciler] Bridge call failed: ${order.lastError}`);
    return { success: false, order, tradeRun };
  }

  order.bridgeOrderId = response.order_id;

  // ── Handle response status ──
  if (response.status === 'filled') {
    order.state = ReconcilerState.FILLED;
    order.confirmedAt = Date.now();
    tradeRun.fillPrice = response.fill_price;
    tradeRun.reconcilerStatus = ReconcilerState.FILLED;
    activeOrders.delete(orderId);
    await logTradeRun(tradeRun);
    console.log(`[Reconciler] FILLED ${request.direction} ${request.symbol} @ ${response.fill_price}`);
    return { success: true, order, tradeRun };
  }

  if (response.status === 'rejected' || response.status === 'error') {
    order.state = ReconcilerState.REJECTED;
    order.lastError = response.message;
    tradeRun.reconcilerStatus = ReconcilerState.REJECTED;
    activeOrders.delete(orderId);
    await logTradeRun(tradeRun);
    console.warn(`[Reconciler] REJECTED: ${response.message}`);
    return { success: false, order, tradeRun };
  }

  // ── Pending → confirmation timeout ──
  order.state = ReconcilerState.PENDING_CONFIRM;

  const confirmed = await waitForConfirmation(order, positionQuery, RULES.confirmationTimeoutSec);

  tradeRun.reconcilerStatus = order.state;
  if (confirmed) tradeRun.fillPrice = response.fill_price;
  activeOrders.delete(orderId);
  await logTradeRun(tradeRun);

  return { success: confirmed, order, tradeRun };
}

// ── Confirmation Timeout Logic ──

async function waitForConfirmation(
  order: ReconcilerOrder,
  positionQuery: () => Promise<BridgePositionResponse>,
  timeoutSec: number,
): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, timeoutSec * 1000));

  order.state = ReconcilerState.TIMEOUT;
  console.warn(`[Reconciler] Confirmation timeout for ${order.id}, reconciling...`);
  order.state = ReconcilerState.RECONCILING;

  try {
    const positions = await positionQuery();
    const found = positions.positions.some(
      (p) => p.symbol === order.symbol && p.direction === order.direction
    );

    if (found) {
      order.state = ReconcilerState.CORRECTED;
      order.confirmedAt = Date.now();
      console.log(`[Reconciler] CORRECTED — position exists for ${order.symbol}, confirm was lost`);
      return true;
    }

    order.state = ReconcilerState.ALERT;
    order.lastError = 'Timeout: no position found after reconciliation';
    console.error(`[Reconciler] ALERT — no position found for ${order.symbol} after timeout`);
    return false;
  } catch (err) {
    order.state = ReconcilerState.ALERT;
    order.lastError = `Reconciliation query failed: ${(err as Error).message}`;
    console.error(`[Reconciler] ALERT — reconciliation query failed: ${order.lastError}`);
    return false;
  }
}

// ── Database Logging ──

async function logTradeRun(run: TradeRun): Promise<void> {
  recentTradeRuns.unshift(run);
  if (recentTradeRuns.length > 50) recentTradeRuns.pop();

  if (!isDatabaseAvailable()) {
    console.log(`[Reconciler] TradeRun logged (in-memory): ${run.id} ${run.reconcilerStatus}`);
    return;
  }

  try {
    await sql`
      INSERT INTO trade_runs (
        id, timestamp, model, symbol, direction, confluence_score,
        entry_price, fill_price, stop_loss, take_profit, exit_price, pnl,
        hour_of_day, session, fib_context, signal_metadata,
        reconciler_status, features_fired, model_prediction, proposal_id
      ) VALUES (
        ${run.id}, ${run.timestamp}, ${run.model}, ${run.symbol}, ${run.direction}, ${run.confluenceScore},
        ${run.entryPrice}, ${run.fillPrice}, ${run.stopLoss}, ${run.takeProfit}, ${run.exitPrice}, ${run.pnl},
        ${run.hourOfDay}, ${run.session},
        ${run.fibContext ? JSON.stringify(run.fibContext) : null}::jsonb,
        ${run.signalMetadata ? JSON.stringify(run.signalMetadata) : null}::jsonb,
        ${run.reconcilerStatus},
        ${run.featuresFired ? JSON.stringify(run.featuresFired) : null}::jsonb,
        ${run.modelPrediction ? JSON.stringify(run.modelPrediction) : null}::jsonb,
        ${run.proposalId ?? null}
      )
    `;
  } catch (err) {
    console.error(`[Reconciler] Failed to log trade run to DB: ${(err as Error).message}`);
  }
}

// ── State Getters (for frontend/API) ──

export function getReconcilerStatus() {
  const activeList = Array.from(activeOrders.values());
  return {
    state: activeList.length > 0 ? activeList[0].state : ReconcilerState.IDLE,
    activeOrders: activeList,
    recentRuns: recentTradeRuns.slice(0, 10),
    rules: RULES,
  };
}

export function getRecentTradeRuns(limit = 20): TradeRun[] {
  return recentTradeRuns.slice(0, limit);
}
