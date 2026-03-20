// [claude-code 2026-03-13] Hyperliquid service — top-level broker interface matching rithmic-service shape
/**
 * Hyperliquid Service
 * Business-logic layer for Hyperliquid DEX.
 * Exports match rithmic-service.ts contract so trading-service can call polymorphically.
 */

import type { HyperliquidConnectionStatus, HyperliquidPosition } from '../types/hyperliquid.js';
import * as client from './hyperliquid/client.js';
import { hasCredentials as authHasCredentials, getWalletAddress } from './hyperliquid/auth.js';

/**
 * Normalize instrument symbols to Hyperliquid coin format.
 * Strips leading "/" and common futures prefixes, uppercases.
 */
function normalizeSymbol(symbol: string): string {
  let s = symbol.trim().replace(/^\//, '').toUpperCase();
  // Common futures → crypto mappings
  const aliasMap: Record<string, string> = {
    BTCUSD: 'BTC', ETHUSD: 'ETH', SOLUSD: 'SOL',
    'BTC-USD': 'BTC', 'ETH-USD': 'ETH', 'SOL-USD': 'SOL',
    'BTC-PERP': 'BTC', 'ETH-PERP': 'ETH', 'SOL-PERP': 'SOL',
    BTCUSDT: 'BTC', ETHUSDT: 'ETH', SOLUSDT: 'SOL',
  };
  if (aliasMap[s]) s = aliasMap[s];
  return s;
}

export function hasCredentials(_userId: string): boolean {
  return authHasCredentials();
}

export async function getConnectionStatus(_userId: string): Promise<HyperliquidConnectionStatus> {
  try {
    await client.getMeta();
    return { connected: true, message: 'Hyperliquid API reachable' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hyperliquid API unreachable';
    return { connected: false, message: msg };
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
    // Ensure cache is warm
    await client.warmCache();

    const coin = normalizeSymbol(params.symbol);
    const isBuy = params.direction === 'long';

    // Market order: IOC limit at a wide slippage price
    const slippagePx = isBuy ? 999_999 : 0.01;

    const result = await client.placeOrder({
      coin,
      is_buy: isBuy,
      sz: params.quantity,
      limit_px: params.entryPrice ?? slippagePx,
      order_type: params.entryPrice
        ? { limit: { tif: 'Gtc' } }   // limit order if entry price specified
        : { limit: { tif: 'Ioc' } },   // market-like IOC otherwise
      reduce_only: false,
      cloid: `PULSE-${Date.now()}`,
    });

    if (result.status !== 'ok') {
      return { success: false, error: result.error ?? 'Hyperliquid order rejected' };
    }

    const statuses = result.response?.data?.statuses ?? [];
    const filled = statuses[0]?.filled;
    const resting = statuses[0]?.resting;
    const orderId = filled?.oid?.toString() ?? resting?.oid?.toString() ?? `HL-${Date.now()}`;

    return { success: true, orderId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hyperliquid order error';
    return { success: false, error: message };
  }
}

export async function getPositions(_userId: string): Promise<HyperliquidPosition[]> {
  const wallet = getWalletAddress();
  return client.getPositions(wallet);
}

export async function closePosition(_userId: string, coin: string): Promise<{ success: boolean; error?: string }> {
  try {
    await client.warmCache();
    const normalized = normalizeSymbol(coin);
    const result = await client.closePosition(normalized);
    return { success: result.status === 'ok' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Close position error' };
  }
}

export async function getAccountInfo(_userId: string): Promise<{
  accountValue: number;
  totalMarginUsed: number;
  availableBalance: number;
}> {
  const wallet = getWalletAddress();
  const state = await client.getAccountState(wallet);
  const accountValue = parseFloat(state.marginSummary.accountValue);
  const totalMarginUsed = parseFloat(state.marginSummary.totalMarginUsed);
  return {
    accountValue,
    totalMarginUsed,
    availableBalance: accountValue - totalMarginUsed,
  };
}
