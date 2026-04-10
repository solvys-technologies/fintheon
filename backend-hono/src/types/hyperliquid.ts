// [claude-code 2026-03-13] Hyperliquid DEX types for perpetual futures trading
/**
 * Hyperliquid Types
 * Perpetual futures DEX on Arbitrum — wallet-based auth (EIP-712)
 * API: https://api.hyperliquid.xyz
 */

export interface HyperliquidConnectionStatus {
  connected: boolean;
  message: string;
}

export interface HyperliquidPosition {
  coin: string;
  /** Signed size — negative = short */
  szi: string;
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  liquidationPx: string | null;
  marginUsed: string;
  leverage: { type: string; value: number };
}

export interface HyperliquidOrder {
  oid: number;
  coin: string;
  /** "A" = sell, "B" = buy */
  side: "A" | "B";
  sz: string;
  limitPx: string;
  orderType: string;
  timestamp: number;
  cloid?: string;
}

export interface HyperliquidOrderType {
  limit?: { tif: "Gtc" | "Ioc" | "Alo" };
  trigger?: {
    triggerPx: string;
    isMarket: boolean;
    tpsl: "tp" | "sl";
  };
}

export interface HyperliquidOrderRequest {
  coin: string;
  is_buy: boolean;
  sz: number;
  limit_px: number;
  order_type: HyperliquidOrderType;
  reduce_only: boolean;
  cloid?: string;
}

export interface HyperliquidOrderStatus {
  filled?: { totalSz: string; avgPx: string; oid: number };
  resting?: { oid: number };
  error?: string;
}

export interface HyperliquidOrderResponse {
  status: "ok" | "err";
  response?: {
    type: string;
    data: {
      statuses: HyperliquidOrderStatus[];
    };
  };
  error?: string;
}

export interface HyperliquidMarginSummary {
  accountValue: string;
  totalMarginUsed: string;
  totalNtlPos: string;
  totalRawUsd: string;
}

export interface HyperliquidAccountInfo {
  marginSummary: HyperliquidMarginSummary;
  assetPositions: Array<{
    position: HyperliquidPosition;
    type: string;
  }>;
  crossMaintenanceMarginUsed: string;
}

export interface HyperliquidAssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

export interface HyperliquidMeta {
  universe: HyperliquidAssetMeta[];
}
