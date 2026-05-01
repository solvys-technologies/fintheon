// [claude-code 2026-04-28] S47-T1: Full 4-tier market-data router.
//   1. TradingView scanner API (primary)
//   2. Browser harness — page scrape Yahoo Finance (fallback)
//   3. RiskFlow headlines — narrative context only (no price data)
//   4. Yahoo Finance v8 API (explicit last resort)
//
// All market-data consumers (VIX service, morning brief, point estimator,
// diagnostics) should route through here so fallback behavior is uniform
// and observable.

import { createLogger } from "../../lib/logger.js";
import { quotes as tvQuotes } from "../tradingview/scanner.js";
import { browseRead } from "../browser/harness.js";
import { getVix as yahooVix, getQuote as yahooQuote } from "./yahoo-market.js";
import type { VixData, StockQuote } from "./types.js";

const log = createLogger("MarketDataRouter");

export interface RouterAttempt {
  tier: 1 | 2 | 3 | 4;
  source: string;
  success: boolean;
  latencyMs: number;
  error?: string;
}

interface RouterState {
  lastQuoteAttempts: Map<string, RouterAttempt[]>;
  lastVixAttempts: RouterAttempt[];
}

const state: RouterState = {
  lastQuoteAttempts: new Map(),
  lastVixAttempts: [],
};

export function getLastQuoteAttempts(symbol: string): RouterAttempt[] {
  return state.lastQuoteAttempts.get(symbol.toUpperCase()) ?? [];
}

export function getLastVixAttempts(): RouterAttempt[] {
  return [...state.lastVixAttempts];
}

function recordQuoteAttempt(symbol: string, attempt: RouterAttempt): void {
  const key = symbol.toUpperCase();
  const existing = state.lastQuoteAttempts.get(key) ?? [];
  existing.push(attempt);
  if (existing.length > 4) existing.shift();
  state.lastQuoteAttempts.set(key, existing);
}

function recordVixAttempt(attempt: RouterAttempt): void {
  state.lastVixAttempts.push(attempt);
  if (state.lastVixAttempts.length > 4) state.lastVixAttempts.shift();
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Tier 1 — TradingView                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

async function tier1Quote(symbol: string): Promise<StockQuote | null> {
  const start = Date.now();
  try {
    const rows = await tvQuotes([symbol], "america");
    const row = rows[0];
    if (row && typeof row.close === "number" && row.close > 0) {
      return {
        symbol: row.symbol,
        price: row.close,
        change: row.changeAbs ?? 0,
        changePercent: row.change ?? 0,
        volume: row.volume ?? 0,
        timestamp: new Date().toISOString(),
      };
    }
    // Silent failure (empty/malformed row) — still record for diagnostics
    recordQuoteAttempt(symbol, {
      tier: 1,
      source: "tradingview",
      success: false,
      latencyMs: Date.now() - start,
      error: "empty_or_malformed_row",
    });
  } catch (err) {
    recordQuoteAttempt(symbol, {
      tier: 1,
      source: "tradingview",
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

async function tier1Vix(): Promise<VixData | null> {
  const start = Date.now();
  try {
    const rows = await tvQuotes(["TVC:VIX"], "america");
    const row = rows[0];
    if (row && typeof row.close === "number" && row.close > 0) {
      return {
        value: row.close,
        change: row.change ?? 0,
        changePercent: row.change ?? 0,
        high: row.high ?? row.close,
        low: row.low ?? row.close,
        previousClose: row.open ? row.open + (row.changeAbs ?? 0) : row.close,
        timestamp: new Date().toISOString(),
        stale: false,
      };
    }
    // Silent failure (empty/malformed row) — still record for diagnostics
    recordVixAttempt({
      tier: 1,
      source: "tradingview",
      success: false,
      latencyMs: Date.now() - start,
      error: "empty_or_malformed_row",
    });
  } catch (err) {
    recordVixAttempt({
      tier: 1,
      source: "tradingview",
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Tier 2 — Browser harness (Yahoo Finance page scrape)                      */
/* ─────────────────────────────────────────────────────────────────────────── */

const PRICE_RE = /regularMarketPrice["']?\s*[:=]\s*["']?(\d+\.?\d*)/i;
const PREV_CLOSE_RE = /previousClose["']?\s*[:=]\s*["']?(\d+\.?\d*)/i;
const CHANGE_RE = /regularMarketChange["']?\s*[:=]\s*["']?(-?\d+\.?\d*)/i;
const CHANGE_PCT_RE =
  /regularMarketChangePercent["']?\s*[:=]\s*["']?(-?\d+\.?\d*)/i;
const VOL_RE = /regularMarketVolume["']?\s*[:=]\s*["']?(\d+)/i;

function extractYahooQuoteFromText(
  text: string,
  symbol: string,
): StockQuote | null {
  const priceMatch = text.match(PRICE_RE);
  if (!priceMatch) return null;
  const price = Number(priceMatch[1]);
  if (!price || price <= 0) return null;

  const prevCloseMatch = text.match(PREV_CLOSE_RE);
  const changeMatch = text.match(CHANGE_RE);
  const changePctMatch = text.match(CHANGE_PCT_RE);
  const volMatch = text.match(VOL_RE);

  return {
    symbol,
    price,
    change: changeMatch ? Number(changeMatch[1]) : 0,
    changePercent: changePctMatch ? Number(changePctMatch[1]) : 0,
    volume: volMatch ? Number(volMatch[1]) : 0,
    timestamp: new Date().toISOString(),
  };
}

async function tier2Quote(symbol: string): Promise<StockQuote | null> {
  const start = Date.now();
  try {
    const result = await browseRead({
      url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
      mode: "allowlist",
      textOnly: true,
    });
    const quote = extractYahooQuoteFromText(result.body, symbol);
    if (quote) {
      return quote;
    }
  } catch (err) {
    recordQuoteAttempt(symbol, {
      tier: 2,
      source: "browser-yahoo",
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

async function tier2Vix(): Promise<VixData | null> {
  const start = Date.now();
  try {
    const result = await browseRead({
      url: "https://finance.yahoo.com/quote/%5EVIX",
      mode: "allowlist",
      textOnly: true,
    });
    const quote = extractYahooQuoteFromText(result.body, "^VIX");
    if (quote) {
      return {
        value: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        high: quote.price,
        low: quote.price,
        previousClose: quote.price - quote.change,
        timestamp: quote.timestamp,
        stale: false,
      };
    }
  } catch (err) {
    recordVixAttempt({
      tier: 2,
      source: "browser-yahoo",
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Tier 3 — RiskFlow headlines (narrative context only)                      */
/* ─────────────────────────────────────────────────────────────────────────── */

interface NarrativeContext {
  symbol: string;
  headline: string;
  ivScore?: number;
  sentiment?: string;
  publishedAt?: string;
}

async function tier3Narrative(
  symbol: string,
): Promise<NarrativeContext | null> {
  const start = Date.now();
  try {
    const { getFeed } = await import("../riskflow/feed-service.js");
    // Fire a quick feed query with symbol filter — no user context needed
    const feed = await getFeed("router", { symbols: [symbol], limit: 5 });
    const item = feed.items.find((i) =>
      i.symbols.some((s) => s.toUpperCase() === symbol.toUpperCase()),
    );
    if (item) {
      return {
        symbol,
        headline: item.headline,
        ivScore: item.ivScore,
        sentiment: item.sentiment,
        publishedAt: item.publishedAt,
      };
    }
  } catch (err) {
    log.warn("Tier-3 RiskFlow narrative failed", {
      symbol,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  recordQuoteAttempt(symbol, {
    tier: 3,
    source: "riskflow-narrative",
    success: false,
    latencyMs: Date.now() - start,
  });
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Tier 4 — Yahoo Finance API (explicit last resort)                         */
/* ─────────────────────────────────────────────────────────────────────────── */

async function tier4Quote(symbol: string): Promise<StockQuote | null> {
  const start = Date.now();
  try {
    const data = await yahooQuote(symbol);
    recordQuoteAttempt(symbol, {
      tier: 4,
      source: "yahoo-api",
      success: true,
      latencyMs: Date.now() - start,
    });
    return data;
  } catch (err) {
    recordQuoteAttempt(symbol, {
      tier: 4,
      source: "yahoo-api",
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function tier4Vix(): Promise<VixData | null> {
  const start = Date.now();
  try {
    const data = await yahooVix();
    recordVixAttempt({
      tier: 4,
      source: "yahoo-api",
      success: true,
      latencyMs: Date.now() - start,
    });
    return data;
  } catch (err) {
    recordVixAttempt({
      tier: 4,
      source: "yahoo-api",
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Public API                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface QuoteResult {
  quote: StockQuote;
  attempts: RouterAttempt[];
  narrative?: NarrativeContext;
}

export interface VixResult {
  vix: VixData;
  attempts: RouterAttempt[];
}

/**
 * Fetch a stock quote through the 4-tier router.
 * TradingView → browser scrape → narrative context → Yahoo API.
 */
export async function fetchQuote(symbol: string): Promise<QuoteResult> {
  const upper = symbol.toUpperCase();
  const attempts: RouterAttempt[] = [];

  // Tier 1
  const t1Start = Date.now();
  const t1 = await tier1Quote(upper);
  if (t1) {
    const a: RouterAttempt = {
      tier: 1,
      source: "tradingview",
      success: true,
      latencyMs: Date.now() - t1Start,
    };
    attempts.push(a);
    recordQuoteAttempt(upper, a);

    // Tier 3 — narrative context (best-effort, non-blocking)
    const narrative = await tier3Narrative(upper);
    return { quote: t1, attempts, narrative: narrative ?? undefined };
  }

  // Tier 2
  const t2Start = Date.now();
  const t2 = await tier2Quote(upper);
  if (t2) {
    const a: RouterAttempt = {
      tier: 2,
      source: "browser-yahoo",
      success: true,
      latencyMs: Date.now() - t2Start,
    };
    attempts.push(a);
    recordQuoteAttempt(upper, a);
    return { quote: t2, attempts };
  }

  // Tier 4 (Yahoo API — explicit last resort)
  const t4Start = Date.now();
  const t4 = await tier4Quote(upper);
  if (t4) {
    const a: RouterAttempt = {
      tier: 4,
      source: "yahoo-api",
      success: true,
      latencyMs: Date.now() - t4Start,
    };
    attempts.push(a);
    recordQuoteAttempt(upper, a);
    return { quote: t4, attempts };
  }

  throw new Error(`All market-data tiers failed for ${upper}`);
}

/**
 * Fetch VIX through the 4-tier router.
 * TradingView → browser scrape → Yahoo API.
 */
export async function fetchVIX(): Promise<VixResult> {
  const attempts: RouterAttempt[] = [];

  // Tier 1
  const t1Start = Date.now();
  const t1 = await tier1Vix();
  if (t1) {
    const a: RouterAttempt = {
      tier: 1,
      source: "tradingview",
      success: true,
      latencyMs: Date.now() - t1Start,
    };
    attempts.push(a);
    recordVixAttempt(a);
    return { vix: t1, attempts };
  }

  // Tier 2
  const t2Start = Date.now();
  const t2 = await tier2Vix();
  if (t2) {
    const a: RouterAttempt = {
      tier: 2,
      source: "browser-yahoo",
      success: true,
      latencyMs: Date.now() - t2Start,
    };
    attempts.push(a);
    recordVixAttempt(a);
    return { vix: t2, attempts };
  }

  // Tier 4
  const t4Start = Date.now();
  const t4 = await tier4Vix();
  if (t4) {
    const a: RouterAttempt = {
      tier: 4,
      source: "yahoo-api",
      success: true,
      latencyMs: Date.now() - t4Start,
    };
    attempts.push(a);
    recordVixAttempt(a);
    return { vix: t4, attempts };
  }

  throw new Error("All VIX tiers failed");
}

/**
 * Get the most recent fallback source used for a symbol.
 * Returns null if no attempts recorded.
 */
export function getLastFallbackSource(symbol: string): string | null {
  const attempts = getLastQuoteAttempts(symbol);
  const last = attempts[attempts.length - 1];
  return last?.success ? last.source : null;
}

/**
 * Snapshot of router health for diagnostics.
 */
export function getRouterHealthSnapshot(): {
  vix_attempts: RouterAttempt[];
  recent_symbols: string[];
  recent_quote_attempts: Array<{ symbol: string; attempts: RouterAttempt[] }>;
} {
  const recentSymbols = Array.from(state.lastQuoteAttempts.keys()).slice(-10);
  return {
    vix_attempts: getLastVixAttempts(),
    recent_symbols: recentSymbols,
    recent_quote_attempts: recentSymbols.map((symbol) => ({
      symbol,
      attempts: getLastQuoteAttempts(symbol),
    })),
  };
}
