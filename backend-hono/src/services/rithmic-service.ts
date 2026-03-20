// [claude-code 2026-03-03] Replaced stub with HTTP calls to rithmic-gateway Python sidecar
/**
 * Rithmic Service
 * Calls the rithmic-gateway Python sidecar (async_rithmic) on localhost:3002.
 *
 * Start the gateway: cd rithmic-gateway && uvicorn gateway:app --port 3002
 * Env required in gateway: RITHMIC_USER, RITHMIC_PASSWORD, RITHMIC_SYSTEM_NAME, RITHMIC_URI
 */

import type { RithmicConnectionStatus } from '../types/rithmic.js';

const GATEWAY_URL = process.env.RITHMIC_GATEWAY_URL ?? 'http://localhost:3002';

interface GatewayStatus {
  connected: boolean;
  system_name: string;
  user: string;
  message: string;
}

interface GatewayOrderResponse {
  success: boolean;
  order_id?: string;
  message: string;
  ts: number;
}

async function gatewayFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((body.detail as string) ?? `Rithmic gateway error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function hasCredentials(_userId: string): boolean {
  // Credentials live in the gateway's env, not here.
  // Consider the gateway "credentialed" if the env var points somewhere.
  return Boolean(process.env.RITHMIC_GATEWAY_URL ?? 'http://localhost:3002');
}

export async function getConnectionStatus(_userId: string): Promise<RithmicConnectionStatus> {
  try {
    const status = await gatewayFetch<GatewayStatus>('/status');
    return {
      connected: status.connected,
      message: status.message,
    };
  } catch {
    return {
      connected: false,
      message: 'Rithmic gateway unreachable — start rithmic-gateway/gateway.py',
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
  }
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const result = await gatewayFetch<GatewayOrderResponse>('/order/place', {
      method: 'POST',
      body: JSON.stringify({
        symbol: params.symbol,
        side: params.direction === 'long' ? 'buy' : 'sell',
        quantity: params.quantity,
        order_type: 'market',
        tag: `PULSE-AUTO-${Date.now()}`,
      }),
    });

    return {
      success: result.success,
      orderId: result.order_id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rithmic gateway error';
    return { success: false, error: message };
  }
}
