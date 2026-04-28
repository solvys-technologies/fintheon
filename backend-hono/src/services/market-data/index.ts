// [claude-code 2026-04-28] S47-T1: Route quote + VIX through 4-tier market-data router
// [claude-code 2026-03-14] Unified market data — Yahoo Finance replaces FMP (no API key needed)
import { fetchQuote, fetchVIX } from "./router.js";
import * as unusualWhales from "./unusual-whales.js";
import type { MarketContext } from "./types.js";

/**
 * Get full market context for a symbol.
 * Used by QuickFintheon skill and Morning Brief.
 * All providers are fetched in parallel; failures degrade gracefully.
 */
export async function getMarketContext(symbol: string): Promise<MarketContext> {
  const [quoteResult, vixResult, gexResult, wallsResult, flowResult] =
    await Promise.allSettled([
      fetchQuote(symbol).then((r) => r.quote),
      fetchVIX().then((r) => r.vix),
      unusualWhales.isAvailable()
        ? unusualWhales.getGammaExposure(symbol)
        : Promise.resolve(null),
      unusualWhales.isAvailable()
        ? unusualWhales.getOptionsWalls(symbol)
        : Promise.resolve(null),
      unusualWhales.isAvailable()
        ? unusualWhales.getOptionsFlow(symbol)
        : Promise.resolve(null),
    ]);

  return {
    quote: quoteResult.status === "fulfilled" ? quoteResult.value : undefined,
    vix: vixResult.status === "fulfilled" ? vixResult.value : undefined,
    gex:
      gexResult.status === "fulfilled" && gexResult.value
        ? gexResult.value
        : undefined,
    walls:
      wallsResult.status === "fulfilled" && wallsResult.value
        ? wallsResult.value
        : undefined,
    flow:
      flowResult.status === "fulfilled" && flowResult.value
        ? flowResult.value
        : undefined,
    fetchedAt: new Date().toISOString(),
  };
}

export { unusualWhales };
export * from "./types.js";
