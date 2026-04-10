// [claude-code 2026-03-14] Market-data route handlers — Yahoo Finance + Unusual Whales + blended IV score
// [claude-code 2026-03-11] IV score now served from persistent ticker cache (decay never restarts)
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import {
  getMarketContext,
  yahooMarket,
  unusualWhales,
} from "../../services/market-data/index.js";
import {
  calculateBlendedIVScore,
  classifyEventType,
} from "../../services/market-data/iv-scorer.js";
import {
  estimateAggregatePoints,
  estimatePoints,
} from "../../services/market-data/point-estimator.js";
import {
  getCachedIVScore,
  subscribeToIVScoreUpdates,
  type IVScoreSnapshot,
} from "../../services/market-data/iv-score-ticker.js";
import type { StackedEvent } from "../../services/iv-scoring-v2.js";

interface AggregateEventSignal {
  macroLevel?: number;
  riskType?: string | null;
}

function buildAggregatePoints(
  score: number,
  vixLevel: number,
  instrument: string,
  currentPrice?: number,
  activeEvents: AggregateEventSignal[] = [],
) {
  const baseline = estimatePoints(score, vixLevel, instrument, currentPrice);
  const scaledPoints = estimateAggregatePoints(
    score,
    vixLevel,
    instrument,
    activeEvents,
    currentPrice,
  );
  const scaledTicks = Math.round(
    (scaledPoints / (baseline.implied.adjustedPoints || 1)) *
      baseline.implied.adjustedTicks,
  );
  const scaledDollarRisk = Number(
    (scaledTicks * baseline.implied.tickValue).toFixed(2),
  );

  return {
    scaledPoints,
    scaledTicks,
    scaledDollarRisk,
    urgency: baseline.urgency,
    implied: baseline.implied,
  };
}

function toIVScoreResponse(
  snapshot: IVScoreSnapshot,
  instrument: string,
  currentPrice?: number,
) {
  let points = snapshot.points;
  if (snapshot.instrument !== instrument) {
    points = buildAggregatePoints(
      snapshot.score.score,
      snapshot.score.vix?.level ?? 20,
      instrument,
      currentPrice,
      snapshot.hasCriticalEvent ? [{ macroLevel: 4 }] : [],
    );
  }

  return {
    ...snapshot.score,
    points,
    instrument,
  };
}

export async function handleQuote(c: Context) {
  const symbol = c.req.param("symbol");
  if (!symbol) return c.json({ error: "Symbol is required" }, 400);
  try {
    const quote = await yahooMarket.getQuote(symbol.toUpperCase());
    return c.json(quote);
  } catch (err: any) {
    console.error("[market-data] quote error:", err.message);
    return c.json(
      { error: err.message ?? "Failed to fetch quote" },
      err.status ?? 500,
    );
  }
}

export async function handleVix(c: Context) {
  try {
    const vix = await yahooMarket.getVix();
    return c.json(vix);
  } catch (err: any) {
    console.error("[market-data] VIX error:", err.message);
    return c.json(
      { error: err.message ?? "Failed to fetch VIX" },
      err.status ?? 503,
    );
  }
}

export async function handleGex(c: Context) {
  if (!unusualWhales.isAvailable()) {
    return c.json({ error: "Unusual Whales API key not configured" }, 503);
  }
  const symbol = c.req.param("symbol");
  if (!symbol) return c.json({ error: "Symbol is required" }, 400);
  try {
    const gex = await unusualWhales.getGammaExposure(symbol.toUpperCase());
    return c.json(gex);
  } catch (err: any) {
    console.error("[market-data] GEX error:", err.message);
    return c.json(
      { error: err.message ?? "Failed to fetch GEX" },
      err.status ?? 500,
    );
  }
}

export async function handleWalls(c: Context) {
  if (!unusualWhales.isAvailable()) {
    return c.json({ error: "Unusual Whales API key not configured" }, 503);
  }
  const symbol = c.req.param("symbol");
  if (!symbol) return c.json({ error: "Symbol is required" }, 400);
  try {
    const walls = await unusualWhales.getOptionsWalls(symbol.toUpperCase());
    return c.json(walls);
  } catch (err: any) {
    console.error("[market-data] walls error:", err.message);
    return c.json(
      { error: err.message ?? "Failed to fetch option walls" },
      err.status ?? 500,
    );
  }
}

export async function handleFlow(c: Context) {
  if (!unusualWhales.isAvailable()) {
    return c.json({ error: "Unusual Whales API key not configured" }, 503);
  }
  const symbol = c.req.param("symbol");
  if (!symbol) return c.json({ error: "Symbol is required" }, 400);
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  try {
    const flow = await unusualWhales.getOptionsFlow(symbol.toUpperCase(), {
      limit,
    });
    return c.json(flow);
  } catch (err: any) {
    console.error("[market-data] flow error:", err.message);
    return c.json(
      { error: err.message ?? "Failed to fetch options flow" },
      err.status ?? 500,
    );
  }
}

export async function handleContext(c: Context) {
  const symbol = c.req.param("symbol");
  if (!symbol) return c.json({ error: "Symbol is required" }, 400);
  try {
    const context = await getMarketContext(symbol.toUpperCase());
    return c.json(context);
  } catch (err: any) {
    console.error("[market-data] context error:", err.message);
    return c.json(
      { error: err.message ?? "Failed to fetch market context" },
      500,
    );
  }
}

/**
 * GET /api/market-data/iv-score — blended VIX/catalyst/MiroShark IV score
 *
 * Serves the cached ticker score (computed every 60s in background).
 * Decay is continuous from event published_at — never restarts on backend restart.
 * Falls back to live computation if ticker hasn't produced a score yet.
 */
export async function handleIVScore(c: Context) {
  try {
    const instrument = c.req.query("instrument") || "/ES";
    const priceParam = c.req.query("price");
    const currentPrice = priceParam ? parseFloat(priceParam) : undefined;

    // Serve from persistent ticker cache (preferred — decay is continuous)
    // IV score is market-wide (VIX + headline blend) — serve cached regardless of
    // which instrument the frontend requests. Point estimates are re-scaled below if needed.
    const cached = getCachedIVScore(instrument);
    if (cached) {
      return c.json(toIVScoreResponse(cached, instrument, currentPrice));
    }

    // Fallback: live computation with extended event window (7 days for V3 decay)
    let events: StackedEvent[] = [];
    try {
      const { sql, isDatabaseAvailable } =
        await import("../../config/database.js");
      if (isDatabaseAvailable() && sql) {
        const recentItems = await sql`
          SELECT headline, source, macro_level, risk_type, iv_score, published_at, is_breaking
          FROM news_feed_items
          WHERE published_at >= NOW() - INTERVAL '7 days'
            AND macro_level >= 2
          ORDER BY published_at DESC
          LIMIT 200
        `;
        events = recentItems.map((item: any) => {
          const parsed = {
            raw: item.headline,
            eventType: null,
            isBreaking: item.is_breaking,
          };
          return {
            eventType: classifyEventType(parsed as any),
            baseScore: item.iv_score || 3,
            timestamp: new Date(item.published_at),
            macroLevel: item.macro_level ?? undefined,
            riskType: item.risk_type ?? undefined,
          };
        });
      }
    } catch {
      // DB unavailable — proceed with VIX-only score
    }

    const result = await calculateBlendedIVScore(
      events,
      instrument,
      currentPrice,
    );
    const activeEvents: AggregateEventSignal[] = events.map((event: any) => ({
      macroLevel: event.macroLevel,
      riskType: event.riskType,
    }));
    const points = buildAggregatePoints(
      result.score,
      result.vix.level,
      instrument,
      currentPrice,
      activeEvents,
    );

    return c.json({
      ...result,
      points,
      instrument,
    });
  } catch (err) {
    console.error("[market-data] iv-score error:", err);
    return c.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to calculate IV score",
      },
      500,
    );
  }
}

export async function handleIVScoreStream(c: Context) {
  const symbol = c.req.query("symbol") ?? c.req.query("instrument") ?? "/ES";
  const instrument = symbol.startsWith("/") ? symbol : `/${symbol}`;

  return streamSSE(c, async (stream) => {
    const cached = getCachedIVScore(instrument);
    if (cached) {
      await stream.writeSSE({
        event: "iv-score",
        data: JSON.stringify(toIVScoreResponse(cached, instrument)),
      });
    }

    const unsubscribe = subscribeToIVScoreUpdates(instrument, (snapshot) => {
      stream
        .writeSSE({
          event: "iv-score",
          data: JSON.stringify(toIVScoreResponse(snapshot, instrument)),
        })
        .catch(() => {});
    });

    const ping = setInterval(() => {
      stream.writeSSE({ event: "ping", data: "" }).catch(() => {});
    }, 30_000);

    await new Promise<void>((resolve) => {
      const onAbort = () => resolve();
      if (c.req.raw.signal.aborted) {
        resolve();
        return;
      }
      c.req.raw.signal.addEventListener("abort", onAbort, { once: true });
    });

    clearInterval(ping);
    unsubscribe();
  });
}
