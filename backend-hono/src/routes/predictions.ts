// [claude-code 2026-04-10] Serve AI-generated Aquarium outlook (Oracle/Nous) when fresh, fall back to heuristic
// [claude-code 2026-03-28] S7: Forward-looking performance prediction endpoint
// Aggregates scored FJ items + scheduled econ events → per-instrument outlook
import { Hono } from "hono";
import { getSupabaseClient } from "../config/supabase.js";
import { getAIAquariumOutlook } from "../services/riskflow/aquarium-scheduler.js";

const app = new Hono();

const PREDICTION_INSTRUMENTS = [
  {
    symbol: "/NQ",
    name: "Nasdaq",
    keywords: ["nq", "nasdaq", "tech", "qqq", "nvda"],
  },
  {
    symbol: "/ES",
    name: "S&P 500",
    keywords: ["es", "s&p", "spx", "spy", "sp500"],
  },
  { symbol: "/YM", name: "Dow Jones", keywords: ["ym", "dow", "djia"] },
  {
    symbol: "/CL",
    name: "Crude Oil",
    keywords: ["cl", "oil", "crude", "wti", "opec", "barrel", "energy"],
  },
  {
    symbol: "/GC",
    name: "Gold",
    keywords: ["gc", "gold", "safe haven", "precious"],
  },
];

interface InstrumentOutlook {
  symbol: string;
  name: string;
  ivScore: number;
  lean: "bullish" | "bearish" | "neutral";
  range: [number, number]; // [low, high] in points
  conviction: "low" | "moderate" | "elevated";
  drivers: string[];
  scoredItemCount: number;
}

// GET /api/predictions/outlook
app.get("/outlook", async (c) => {
  // Serve AI-generated outlook if fresh (< 4 hours)
  const ai = getAIAquariumOutlook();
  if (ai) {
    const ageMs = Date.now() - new Date(ai.generatedAt).getTime();
    if (ageMs < 4 * 60 * 60 * 1000) {
      return c.json({
        instruments: ai.instruments,
        fetchedAt: ai.generatedAt,
        source: ai.source,
        ageMinutes: Math.round(ageMs / 60_000),
      });
    }
  }

  try {
    const sb = getSupabaseClient();
    if (!sb) {
      return c.json({
        instruments: [],
        fetchedAt: new Date().toISOString(),
        error: "No database connection",
      });
    }

    // Fetch recent scored items (last 48h)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: scoredItems, error: scoredErr } = await sb
      .from("scored_riskflow_items")
      .select("headline, sentiment, iv_score, macro_level, published_at, tags")
      .gte("published_at", cutoff)
      .order("published_at", { ascending: false })
      .limit(200);

    if (scoredErr) {
      console.error(
        "[Predictions] scored items fetch error:",
        scoredErr.message,
      );
    }

    // Fetch upcoming econ events (next 3 days)
    const now = new Date().toISOString().slice(0, 10);
    const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { data: econEvents, error: econErr } = await sb
      .from("econ_events")
      .select("name, date, impact")
      .gte("date", now)
      .lte("date", threeDays)
      .order("date", { ascending: true })
      .limit(20);

    if (econErr) {
      console.error("[Predictions] econ events fetch error:", econErr.message);
    }

    const items = scoredItems ?? [];
    const events = econEvents ?? [];

    // Compute per-instrument outlook
    const instruments: InstrumentOutlook[] = PREDICTION_INSTRUMENTS.map(
      ({ symbol, name, keywords }) => {
        // Find relevant items for this instrument
        const relevant = items.filter((item) => {
          const text = (item.headline ?? "").toLowerCase();
          return keywords.some((kw) => text.includes(kw));
        });

        // Also include broad macro items for equity indices
        const isBroadEquity = ["/NQ", "/ES", "/YM"].includes(symbol);
        const broadItems = isBroadEquity
          ? items.filter((item) => {
              const text = (item.headline ?? "").toLowerCase();
              return (
                text.includes("market") ||
                text.includes("stocks") ||
                text.includes("equity") ||
                text.includes("fed ")
              );
            })
          : [];

        const allRelevant = [
          ...new Map(
            [...relevant, ...broadItems].map((i) => [i.headline, i]),
          ).values(),
        ];

        // Aggregate sentiment
        let bullishWeight = 0;
        let bearishWeight = 0;
        let totalIV = 0;

        for (const item of allRelevant) {
          const weight = (item.iv_score ?? 3) / 10; // Normalize 0-1
          if (item.sentiment === "bullish") bullishWeight += weight;
          else if (item.sentiment === "bearish") bearishWeight += weight;
          totalIV += item.iv_score ?? 3;
        }

        const avgIV = allRelevant.length > 0 ? totalIV / allRelevant.length : 3;

        // Determine lean — be humble
        const sentimentDelta = bullishWeight - bearishWeight;
        let lean: "bullish" | "bearish" | "neutral" = "neutral";
        if (sentimentDelta > 1.5) lean = "bullish";
        else if (sentimentDelta < -1.5) lean = "bearish";

        // Compute range — wider with higher IV, wider with fewer data points
        const uncertaintyMultiplier = Math.max(
          1,
          3 - Math.log2(allRelevant.length + 1),
        );
        const baseRange = avgIV * 15 * uncertaintyMultiplier;
        const leanOffset = sentimentDelta * 5;
        const rangeLow = Math.round(-baseRange + leanOffset);
        const rangeHigh = Math.round(baseRange + leanOffset);

        // Conviction — humble by default
        let conviction: "low" | "moderate" | "elevated" = "low";
        if (allRelevant.length >= 10 && Math.abs(sentimentDelta) > 3)
          conviction = "elevated";
        else if (allRelevant.length >= 5 && Math.abs(sentimentDelta) > 1.5)
          conviction = "moderate";

        // Key drivers from upcoming econ events
        const highImpactEvents = events.filter((e) => e.impact === "high");
        const drivers = highImpactEvents
          .slice(0, 3)
          .map((e) => `${e.name} (${e.date})`);
        if (drivers.length === 0 && allRelevant.length > 0) {
          // Use top headline as driver
          drivers.push(
            allRelevant[0].headline?.slice(0, 50) ?? "Market sentiment",
          );
        }

        return {
          symbol,
          name,
          ivScore: Math.round(avgIV * 10) / 10,
          lean,
          range: [rangeLow, rangeHigh] as [number, number],
          conviction,
          drivers,
          scoredItemCount: allRelevant.length,
        };
      },
    );

    return c.json({
      instruments,
      fetchedAt: new Date().toISOString(),
      dataPoints: items.length,
      upcomingEvents: events.length,
    });
  } catch (err) {
    console.error("[Predictions] outlook error:", err);
    return c.json(
      {
        instruments: [],
        fetchedAt: new Date().toISOString(),
        error: "Prediction failed",
      },
      500,
    );
  }
});

// ── Fuzzy matching: find Kalshi market with similar title to Polymarket question ──

function findKalshiMatch(
  polyQuestion: string,
  kalshiMarkets: Array<{ ticker: string; title: string; lastPrice: number }>,
): { ticker: string; title: string; lastPrice: number } | null {
  if (kalshiMarkets.length === 0) return null;

  const polyLower = polyQuestion.toLowerCase();
  const keyTerms = polyLower
    .replace(/will |the |be |by |in |to |of |a |an /g, "")
    .split(/\s+/)
    .filter((t) => t.length > 3);

  let bestMatch: (typeof kalshiMarkets)[0] | null = null;
  let bestScore = 0;

  for (const km of kalshiMarkets) {
    const kalshiLower = km.title.toLowerCase();
    let score = 0;
    for (const term of keyTerms) {
      if (kalshiLower.includes(term)) score++;
    }
    if (score >= 3 && score > bestScore) {
      bestScore = score;
      bestMatch = km;
    }
  }

  return bestMatch;
}

// GET /api/predictions/polymarket-outlook
app.get("/polymarket-outlook", async (c) => {
  try {
    const { createPolymarketService } =
      await import("../services/polymarket-service.js");
    const polyService = createPolymarketService();

    const polyData = await polyService.getMarkets(undefined, 8);

    // Try to get Kalshi markets for divergence comparison
    let kalshiMarkets: Array<{
      ticker: string;
      title: string;
      lastPrice: number;
    }> = [];
    try {
      const { createKalshiService } =
        await import("../services/kalshi-service.js");
      const kalshiService = createKalshiService();
      const kalshiData = await kalshiService.getMarkets();
      kalshiMarkets = kalshiData.markets;
    } catch {
      // Kalshi unavailable — skip divergence
    }

    const markets = polyData.markets.map((m) => {
      const kalshiMatch = findKalshiMatch(m.question, kalshiMarkets);

      return {
        slug: m.slug,
        question: m.question,
        yesPrice: m.yesPrice,
        volume: m.volume,
        category: m.category,
        closeTime: m.closeTime,
        kalshiDivergence: kalshiMatch
          ? {
              kalshiPrice: kalshiMatch.lastPrice,
              divergencePct: Math.abs(m.yesPrice - kalshiMatch.lastPrice) * 100,
              direction:
                m.yesPrice > kalshiMatch.lastPrice + 0.02
                  ? ("poly_higher" as const)
                  : m.yesPrice < kalshiMatch.lastPrice - 0.02
                    ? ("poly_lower" as const)
                    : ("aligned" as const),
            }
          : undefined,
      };
    });

    return c.json({
      markets,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Predictions] polymarket outlook error:", err);
    return c.json(
      {
        markets: [],
        fetchedAt: new Date().toISOString(),
        error: "Fetch failed",
      },
      500,
    );
  }
});

export default app;
