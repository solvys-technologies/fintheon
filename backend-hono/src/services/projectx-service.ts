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
