// [claude-code 2026-03-13] Hyperliquid REST client for info + exchange endpoints
/**
 * Hyperliquid Client
 * Direct REST client for Hyperliquid DEX API.
 * Info endpoints: POST /info (no auth)
 * Exchange endpoints: POST /exchange (EIP-712 signed)
 */

import type {
  HyperliquidAccountInfo,
  HyperliquidMeta,
  HyperliquidOrder,
  HyperliquidOrderRequest,
  HyperliquidOrderResponse,
  HyperliquidPosition,
} from "../../types/hyperliquid.js";
import {
  signAction,
  generateNonce,
  getWalletAddress,
  getVaultAddress,
} from "./auth.js";

const MAINNET_URL = "https://api.hyperliquid.xyz";
const TESTNET_URL = "https://api.hyperliquid-testnet.xyz";

function getBaseUrl(): string {
  return process.env.HYPERLIQUID_TESTNET === "true" ? TESTNET_URL : MAINNET_URL;
}

// ─── Info Endpoints (no auth) ────────────────────────────────────────────

async function infoRequest<T>(
  type: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`${getBaseUrl()}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, ...payload }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hyperliquid /info error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function getMeta(): Promise<HyperliquidMeta> {
  return infoRequest<HyperliquidMeta>("meta");
}

export async function getAccountState(
  walletAddress: string,
): Promise<HyperliquidAccountInfo> {
  return infoRequest<HyperliquidAccountInfo>("clearinghouseState", {
    user: walletAddress,
  });
}

export async function getOpenOrders(
  walletAddress: string,
): Promise<HyperliquidOrder[]> {
  return infoRequest<HyperliquidOrder[]>("openOrders", { user: walletAddress });
}

export async function getPositions(
  walletAddress: string,
): Promise<HyperliquidPosition[]> {
  const state = await getAccountState(walletAddress);
  return state.assetPositions
    .map((ap) => ap.position)
    .filter((p) => parseFloat(p.szi) !== 0);
}

// ─── Exchange Endpoints (EIP-712 signed) ─────────────────────────────────

async function exchangeRequest<T>(action: Record<string, unknown>): Promise<T> {
  const nonce = generateNonce();
  const vaultAddress = getVaultAddress();
  const signature = await signAction(action, nonce, vaultAddress);

  const body: Record<string, unknown> = {
    action,
    nonce,
    signature,
  };
  if (vaultAddress) {
    body.vaultAddress = vaultAddress;
  }

  const res = await fetch(`${getBaseUrl()}/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hyperliquid /exchange error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Place an order on Hyperliquid.
 * For market orders, set limit_px to a slippage price and order_type to { limit: { tif: 'Ioc' } }.
 */
export async function placeOrder(
  params: HyperliquidOrderRequest,
): Promise<HyperliquidOrderResponse> {
  const orderWire = {
    a: getAssetIndex(params.coin),
    b: params.is_buy,
    p: params.limit_px.toString(),
    s: params.sz.toString(),
    r: params.reduce_only,
    t: params.order_type,
    c: params.cloid,
  };

  return exchangeRequest<HyperliquidOrderResponse>({
    type: "order",
    orders: [orderWire],
    grouping: "na",
  });
}

/**
 * Cancel an order by oid.
 */
export async function cancelOrder(
  coin: string,
  oid: number,
): Promise<HyperliquidOrderResponse> {
  return exchangeRequest<HyperliquidOrderResponse>({
    type: "cancel",
    cancels: [{ a: getAssetIndex(coin), o: oid }],
  });
}

/**
 * Close a position by placing a market-close (reduce-only IOC) order.
 */
export async function closePosition(
  coin: string,
): Promise<HyperliquidOrderResponse> {
  const wallet = getWalletAddress();
  const positions = await getPositions(wallet);
  const pos = positions.find((p) => p.coin === coin);

  if (!pos || parseFloat(pos.szi) === 0) {
    return {
      status: "ok",
      response: { type: "cancel", data: { statuses: [] } },
    };
  }

  const size = Math.abs(parseFloat(pos.szi));
  const isBuy = parseFloat(pos.szi) < 0; // close short = buy, close long = sell

  // Use a wide slippage price for market-like execution
  const meta = await getMeta();
  const asset = meta.universe.find((a) => a.name === coin);
  const slippagePx = isBuy ? 999_999 : 0.01;

  return placeOrder({
    coin,
    is_buy: isBuy,
    sz: roundToDecimals(size, asset?.szDecimals ?? 3),
    limit_px: slippagePx,
    order_type: { limit: { tif: "Ioc" } },
    reduce_only: true,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Asset index cache (populated from /info meta) */
let assetIndexCache: Map<string, number> | null = null;

async function loadAssetIndices(): Promise<Map<string, number>> {
  if (assetIndexCache) return assetIndexCache;
  const meta = await getMeta();
  assetIndexCache = new Map(meta.universe.map((a, i) => [a.name, i]));
  return assetIndexCache;
}

function getAssetIndex(coin: string): number {
  // Synchronous lookup — assumes loadAssetIndices() was called at startup or lazily
  if (assetIndexCache) {
    const idx = assetIndexCache.get(coin);
    if (idx !== undefined) return idx;
  }
  // Fallback: force a synchronous error so we know the cache needs warming
  throw new Error(`Asset index not found for ${coin}. Call warmCache() first.`);
}

/**
 * Warm the asset index cache. Call on startup or first use.
 */
export async function warmCache(): Promise<void> {
  await loadAssetIndices();
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
