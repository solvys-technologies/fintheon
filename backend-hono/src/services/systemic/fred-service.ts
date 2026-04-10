// [claude-code 2026-03-11] FRED API service for macro indicator data
// Fetches credit spreads, yield curves, TED spread, Fed funds rate
// Free API with optional key for higher rate limits

import type { MacroIndicators } from "../../types/volatility-taxonomy.js";

// ── FRED Series IDs ────────────────────────────────────────────────────────────

const FRED_SERIES = {
  HY_OAS: "BAMLH0A0HYM2", // ICE BofA US High Yield OAS
  YIELD_2S10S: "T10Y2Y", // 10Y-2Y Treasury spread
  YIELD_3M10Y: "T10Y3M", // 10Y-3M Treasury spread (recession predictor)
  TED_SPREAD: "TEDRATE", // TED Spread (interbank stress)
  FED_FUNDS: "FEDFUNDS", // Federal Funds Rate
} as const;

const FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";
const DEFAULT_POLL_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours (data is daily anyway)

// ── Cache ──────────────────────────────────────────────────────────────────────

interface FredCache {
  data: Partial<Record<string, number>>;
  fetchedAt: Date | null;
}

let _cache: FredCache = { data: {}, fetchedAt: null };
let _pollInterval: ReturnType<typeof setInterval> | null = null;
let _apiKey: string | null = null;

// ── Core Fetch ─────────────────────────────────────────────────────────────────

/**
 * Fetch the latest observation for a FRED series.
 * Returns null if the fetch fails (FRED is best-effort, not critical path).
 */
async function fetchFredSeries(seriesId: string): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      series_id: seriesId,
      sort_order: "desc",
      limit: "1",
      file_type: "json",
    });

    // API key is optional but gives higher rate limits
    if (_apiKey) {
      params.set("api_key", _apiKey);
    } else {
      // FRED allows limited keyless access for testing
      params.set("api_key", "DEMO_KEY");
    }

    const url = `${FRED_BASE_URL}?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[FRED] Failed to fetch ${seriesId}: ${response.status}`);
      return null;
    }

    const json = (await response.json()) as {
      observations?: Array<{ date: string; value: string }>;
    };

    const obs = json.observations?.[0];
    if (!obs || obs.value === ".") return null; // '.' means data not available

    const value = parseFloat(obs.value);
    return isNaN(value) ? null : value;
  } catch (err) {
    console.warn(`[FRED] Error fetching ${seriesId}:`, err);
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch all FRED macro indicators. Caches results for 6 hours.
 */
export async function fetchFredIndicators(
  forceRefresh = false,
): Promise<Partial<Record<string, number>>> {
  // Return cache if fresh
  if (!forceRefresh && _cache.fetchedAt) {
    const age = Date.now() - _cache.fetchedAt.getTime();
    if (age < DEFAULT_POLL_INTERVAL) {
      return _cache.data;
    }
  }

  console.log("[FRED] Fetching macro indicators...");

  const results = await Promise.allSettled([
    fetchFredSeries(FRED_SERIES.HY_OAS),
    fetchFredSeries(FRED_SERIES.YIELD_2S10S),
    fetchFredSeries(FRED_SERIES.YIELD_3M10Y),
    fetchFredSeries(FRED_SERIES.TED_SPREAD),
    fetchFredSeries(FRED_SERIES.FED_FUNDS),
  ]);

  const data: Partial<Record<string, number>> = {};

  const keys = [
    "hyOasSpread",
    "yieldCurve2s10s",
    "yieldCurve3m10y",
    "tedSpread",
    "fedFundsRate",
  ] as const;
  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value !== null) {
      data[keys[i]] = result.value;
    }
  });

  _cache = { data, fetchedAt: new Date() };

  const fetched = Object.keys(data).length;
  console.log(
    `[FRED] Fetched ${fetched}/5 indicators: ${JSON.stringify(data)}`,
  );

  return data;
}

/**
 * Get cached FRED data without fetching.
 * Returns empty object if no data has been fetched yet.
 */
export function getCachedFredIndicators(): Partial<Record<string, number>> {
  return _cache.data;
}

/**
 * Get the timestamp of the last successful FRED fetch.
 */
export function getFredFetchedAt(): Date | null {
  return _cache.fetchedAt;
}

/**
 * Build a full MacroIndicators object combining FRED data, VIX, and headline signals.
 */
export function buildMacroIndicators(
  vixLevel?: number,
  vixAvg30d?: number,
  headlineSignals: MacroIndicators["headlineSignals"] = [],
): MacroIndicators {
  const fred = getCachedFredIndicators();

  return {
    hyOasSpread: fred.hyOasSpread as number | undefined,
    yieldCurve2s10s: fred.yieldCurve2s10s as number | undefined,
    yieldCurve3m10y: fred.yieldCurve3m10y as number | undefined,
    tedSpread: fred.tedSpread as number | undefined,
    fedFundsRate: fred.fedFundsRate as number | undefined,
    vixLevel,
    vixAvg30d,
    headlineSignals,
    fredFetchedAt: _cache.fetchedAt?.toISOString(),
  };
}

// ── Polling ────────────────────────────────────────────────────────────────────

/**
 * Start background FRED polling.
 */
export function startFredPolling(apiKey?: string, intervalMs?: number): void {
  if (_pollInterval) return;
  _apiKey = apiKey ?? null;

  // Immediate first fetch
  fetchFredIndicators(true).catch((err) => {
    console.warn("[FRED] Initial fetch failed:", err);
  });

  const interval = intervalMs ?? DEFAULT_POLL_INTERVAL;
  _pollInterval = setInterval(() => {
    fetchFredIndicators(true).catch((err) => {
      console.warn("[FRED] Poll fetch failed:", err);
    });
  }, interval);

  console.log(`[FRED] Polling started (every ${interval / 3600000}h)`);
}

/**
 * Stop FRED polling.
 */
export function stopFredPolling(): void {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
    console.log("[FRED] Polling stopped");
  }
}

/**
 * Set the FRED API key for higher rate limits.
 */
export function setFredApiKey(key: string): void {
  _apiKey = key;
}
