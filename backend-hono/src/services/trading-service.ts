// [claude-code 2026-03-03] Added fireTestTrade() — Rithmic primary, ProjectX fallback via PRIMARY_BROKER env
/**
 * Trading Service
 * Business logic for trading operations
 */

import type {
  Position,
  PositionListResponse,
  AlgoStatus,
  ToggleAlgoResponse,
} from '../types/trading.js';
import * as rithmicService from './rithmic-service.js';
import * as hyperliquidService from './hyperliquid-service.js';
import * as projectxService from './projectx-service.js';

// In-memory store for algo status (per user)
const algoStatusStore = new Map<string, AlgoStatus>();

/**
 * Get positions for a user
 * Currently returns mock data - will integrate with ProjectX in Phase 3
 */
export async function getPositions(userId: string): Promise<PositionListResponse> {
  // TODO: Integrate with ProjectX API in Phase 3
  const mockPositions = generateMockPositions(userId);

  const totalUnrealizedPnl = mockPositions.reduce(
    (sum, pos) => sum + pos.unrealizedPnl,
    0
  );

  return {
    positions: mockPositions,
    total: mockPositions.length,
    totalUnrealizedPnl,
  };
}

/**
 * Toggle algo trading status
 */
export async function toggleAlgo(
  userId: string,
  enabled: boolean,
  strategy?: string
): Promise<ToggleAlgoResponse> {
  const currentStatus = algoStatusStore.get(userId) || {
    enabled: false,
    activeStrategy: undefined,
  };

  const newStatus: AlgoStatus = {
    enabled,
    activeStrategy: enabled ? (strategy || currentStatus.activeStrategy) : undefined,
    lastTriggered: enabled ? new Date() : currentStatus.lastTriggered,
  };

  algoStatusStore.set(userId, newStatus);

  return {
    success: true,
    algoStatus: newStatus,
  };
}

/**
 * Get current algo status for a user
 */
export async function getAlgoStatus(userId: string): Promise<AlgoStatus> {
  return algoStatusStore.get(userId) || {
    enabled: false,
    activeStrategy: undefined,
  };
}

/**
 * Fire a test trade — Rithmic primary (PRIMARY_BROKER=rithmic default), ProjectX fallback
 * Places a 1-contract market order for the given symbol/side
 */
export async function fireTestTrade(
  userId: string,
  params: {
    accountId: string;
    symbol: string;
    side: 'buy' | 'sell';
  }
): Promise<{ success: boolean; orderId?: string | number; message: string }> {
  const broker = (process.env.PRIMARY_BROKER ?? 'rithmic') as 'rithmic' | 'hyperliquid' | 'projectx';
  const symbolSearch = params.symbol.replace(/^\//, '');
  const direction = params.side === 'buy' ? 'long' : 'short';

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

  if (broker === 'hyperliquid') {
    const result = await hyperliquidService.executeOrder(userId, {
      symbol: symbolSearch,
      direction,
      quantity: 1,
    });
    if (!result.success) {
      throw new Error(result.error ?? 'Hyperliquid order failed');
    }

    return {
      success: true,
      orderId: result.orderId,
      message: `Order #${result.orderId} placed — 1 ${symbolSearch} ${direction.toUpperCase()} @ Market (Hyperliquid)`,
    };
  }

  // Rithmic path (default)
  const result = await rithmicService.executeOrder(userId, {
    symbol: symbolSearch,
    direction,
    quantity: 1,
  });
  if (!result.success) {
    throw new Error(result.error ?? 'Rithmic order failed');
  }

  return {
    success: true,
    orderId: result.orderId,
    message: `Order #${result.orderId} placed — 1 ${symbolSearch} ${direction.toUpperCase()} @ Market (Rithmic)`,
  };
}

/**
 * Generate mock positions for development
 */
function generateMockPositions(userId: string): Position[] {
  const now = new Date();
  const symbols = ['ES', 'NQ', 'YM', 'RTY'];
  const positions: Position[] = [];

  // Generate 0-3 random open positions
  const positionCount = Math.floor(Math.random() * 4);

  for (let i = 0; i < positionCount; i++) {
    const symbol = symbols[i % symbols.length];
    const side = Math.random() > 0.5 ? 'long' : 'short';
    const quantity = Math.floor(Math.random() * 5) + 1;
    const entryPrice = getBasePrice(symbol) + (Math.random() * 20 - 10);
    const currentPrice = entryPrice + (Math.random() * 40 - 20);
    const priceDiff = side === 'long'
      ? currentPrice - entryPrice
      : entryPrice - currentPrice;
    const unrealizedPnl = priceDiff * quantity * getMultiplier(symbol);

    positions.push({
      id: `pos-${userId}-${i}`,
      userId,
      symbol,
      side: side as 'long' | 'short',
      quantity,
      entryPrice: Math.round(entryPrice * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
      realizedPnl: 0,
      status: 'open',
      createdAt: new Date(now.getTime() - Math.random() * 3600_000),
      updatedAt: now,
    });
  }

  return positions;
}

function getBasePrice(symbol: string): number {
  const basePrices: Record<string, number> = {
    ES: 5200,
    NQ: 18500,
    YM: 39000,
    RTY: 2050,
  };
  return basePrices[symbol] || 1000;
}

function getMultiplier(symbol: string): number {
  const multipliers: Record<string, number> = {
    ES: 50,
    NQ: 20,
    YM: 5,
    RTY: 50,
  };
  return multipliers[symbol] || 1;
}
