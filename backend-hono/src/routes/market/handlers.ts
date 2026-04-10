// [claude-code 2026-03-14] Market handlers — Yahoo Finance (FMP removed)
import type { Context } from "hono";
import { fetchVIX } from "../../services/vix-service.js";
import * as yahooMarket from "../../services/market-data/yahoo-market.js";
import {
  calculateIVScoreV2,
  type IVScoringConfig,
  type StackedEvent,
} from "../../services/iv-scoring-v2.js";

/**
 * GET /api/market/vix
 */
export async function handleGetVix(c: Context) {
  try {
    const vixData = await fetchVIX();
    return c.json(vixData);
  } catch (error) {
    console.error("[Market] VIX fetch error:", error);
    return c.json(
      { error: "Failed to fetch VIX data (upstream unavailable)" },
      503,
    );
  }
}

/**
 * POST /api/iv-scoring/replay
 */
export async function handleIVScoringReplay(c: Context) {
  try {
    const body = await c.req.json();

    const events: StackedEvent[] = (body.events ?? []).map((e: any) => ({
      eventType: e.eventType ?? "other",
      baseScore: e.baseScore ?? 3,
      timestamp: new Date(e.timestamp ?? Date.now()),
    }));

    const input = {
      events,
      vixLevel: body.vixLevel ?? 20,
      previousVixLevel: body.previousVixLevel,
      vixUpdateMinutes: body.vixUpdateMinutes,
      currentPrice: body.currentPrice ?? 6000,
      instrument: body.instrument ?? "/ES",
      isMarketClosed: body.isMarketClosed ?? false,
      isEarningsSeason: body.isEarningsSeason ?? false,
      isFOMCWeek: body.isFOMCWeek ?? false,
      previousSessionScore: body.previousSessionScore ?? 0,
    };

    const configOverrides: Partial<IVScoringConfig> | undefined =
      body.config ?? undefined;

    const result = calculateIVScoreV2(input, configOverrides);
    return c.json(result);
  } catch (error) {
    console.error("[IV Replay] Error:", error);
    return c.json({ error: "Invalid replay request" }, 400);
  }
}

/**
 * GET /api/market/quotes/:symbol
 */
export async function handleGetQuote(c: Context) {
  const symbol = c.req.param("symbol");
  if (!symbol) return c.json({ error: "Symbol is required" }, 400);

  try {
    const quote = await yahooMarket.getQuote(symbol.toUpperCase());
    return c.json(quote);
  } catch (error) {
    console.error("[Market] Quote fetch error:", error);
    return c.json({ error: "Failed to fetch quote" }, 500);
  }
}
