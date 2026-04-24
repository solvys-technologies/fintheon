// [claude-code 2026-04-12] S15-T3: Added divergence, prediction tracking, accuracy routes
// [claude-code 2026-04-12] S15-T2: Polymarket read-only service — public API data for research/signal enrichment
// [claude-code 2026-04-24] Scope guardrails: predictions must be in PREDICTION_CATEGORIES
//   and settle within 7 days. Mirrors the DB CHECK constraints so agents get a useful 400
//   instead of an opaque Postgres failure.
import { Hono } from "hono";
import { createPolymarketService } from "../../services/polymarket-service.js";
import { getRecentDivergenceAlerts } from "../../services/polymarket-kalshi-divergence.js";
import { getSupabaseClient } from "../../config/supabase.js";

const PREDICTION_CATEGORIES = [
  "weather",
  "economics",
  "commentary",
  "projected_data",
] as const;
type PredictionCategory = (typeof PREDICTION_CATEGORIES)[number];

const MAX_PREDICTION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createPolymarketRoutes() {
  const app = new Hono();
  const polyService = createPolymarketService();

  // GET /api/polymarket/markets — trending/filtered markets
  app.get("/markets", async (c) => {
    const category = c.req.query("category");
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const data = await polyService.getMarkets(category, limit);
    return c.json(data);
  });

  // GET /api/polymarket/search — text search
  app.get("/search", async (c) => {
    const q = c.req.query("q");
    if (!q) return c.json({ error: "query parameter 'q' required" }, 400);
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const markets = await polyService.searchMarkets(q, limit);
    return c.json({ markets, fetchedAt: new Date().toISOString() });
  });

  // GET /api/polymarket/market/:slug — single market detail
  app.get("/market/:slug", async (c) => {
    const slug = c.req.param("slug");
    const market = await polyService.getMarketBySlug(slug);
    if (!market) return c.json({ error: "Market not found" }, 404);
    return c.json(market);
  });

  // GET /api/polymarket/whale-alerts — large trade detection
  app.get("/whale-alerts", async (c) => {
    const data = await polyService.getWhaleAlerts();
    return c.json(data);
  });

  // GET /api/polymarket/divergence — cross-platform odds comparison
  app.get("/divergence", (c) => {
    const alerts = getRecentDivergenceAlerts();
    return c.json({
      alerts,
      count: alerts.length,
      fetchedAt: new Date().toISOString(),
    });
  });

  // POST /api/polymarket/predictions — record an agent prediction.
  //   Scope: category must be weather|economics|commentary|projected_data.
  //   Duration: market_close_at must settle within 7 days of now.
  //   Audit: reasoning + catalyst_source are encouraged (not required yet, but
  //   /predictions/accuracy segmentation gets much more useful when populated).
  app.post("/predictions", async (c) => {
    const body = await c.req.json();
    const {
      marketId,
      marketTitle,
      predictedOutcome,
      predictedProbability,
      agentName,
      snapshotProbability,
      category,
      marketCloseAt,
      reasoning,
      catalystSource,
    } = body;

    if (
      !marketId ||
      !marketTitle ||
      !predictedOutcome ||
      predictedProbability == null
    ) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    if (
      !category ||
      !PREDICTION_CATEGORIES.includes(category as PredictionCategory)
    ) {
      return c.json(
        {
          error:
            "category must be one of: weather, economics, commentary, projected_data",
          allowed: PREDICTION_CATEGORIES,
        },
        400,
      );
    }

    if (!marketCloseAt) {
      return c.json(
        {
          error:
            "marketCloseAt required (ISO timestamp; must settle within 7 days)",
        },
        400,
      );
    }

    const closeMs = Date.parse(marketCloseAt);
    if (Number.isNaN(closeMs)) {
      return c.json(
        { error: "marketCloseAt must be a valid ISO timestamp" },
        400,
      );
    }
    const msFromNow = closeMs - Date.now();
    if (msFromNow <= 0) {
      return c.json({ error: "marketCloseAt must be in the future" }, 400);
    }
    if (msFromNow > MAX_PREDICTION_DURATION_MS) {
      const days = (msFromNow / 86_400_000).toFixed(1);
      return c.json(
        {
          error: `marketCloseAt is ${days} days away — max duration is 7 days. Pick a shorter-horizon contract.`,
          maxDurationDays: 7,
        },
        400,
      );
    }

    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "No database" }, 503);

    const { data, error } = await sb
      .from("polymarket_predictions")
      .insert({
        market_id: marketId,
        market_title: marketTitle,
        predicted_outcome: predictedOutcome,
        predicted_probability: predictedProbability,
        agent_name: agentName || "Oracle",
        snapshot_probability: snapshotProbability || predictedProbability,
        category,
        market_close_at: marketCloseAt,
        reasoning: reasoning ?? null,
        catalyst_source: catalystSource ?? null,
      })
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data, 201);
  });

  // GET /api/polymarket/predictions — list predictions with optional filters
  app.get("/predictions", async (c) => {
    const agent = c.req.query("agent");
    const resolved = c.req.query("resolved");
    const limit = parseInt(c.req.query("limit") || "50", 10);

    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "No database" }, 503);

    let query = sb
      .from("polymarket_predictions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (agent) query = query.eq("agent_name", agent);
    if (resolved === "true") query = query.eq("resolved", true);
    if (resolved === "false") query = query.eq("resolved", false);

    const { data, error } = await query;
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ predictions: data, count: data?.length ?? 0 });
  });

  // GET /api/polymarket/predictions/accuracy — agent accuracy stats, segmented
  //   by (agent_name, category). Query params:
  //     ?agent=Oracle         — single agent
  //     ?category=weather     — single category
  //   Omit both to get the full matrix.
  app.get("/predictions/accuracy", async (c) => {
    const agent = c.req.query("agent");
    const category = c.req.query("category");

    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "No database" }, 503);

    let query = sb
      .from("polymarket_predictions")
      .select("agent_name, category, result, predicted_probability")
      .eq("resolved", true);

    if (agent) query = query.eq("agent_name", agent);
    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) return c.json({ error: error.message }, 500);

    // Key by "agent|category" so the same analyst's weather vs economics
    // records don't pool into a single win-rate.
    const stats: Record<
      string,
      {
        agent: string;
        category: string;
        total: number;
        wins: number;
        losses: number;
        avgConfidence: number;
      }
    > = {};
    for (const row of data ?? []) {
      const name = row.agent_name;
      const cat = row.category ?? "uncategorized";
      const key = `${name}|${cat}`;
      if (!stats[key])
        stats[key] = {
          agent: name,
          category: cat,
          total: 0,
          wins: 0,
          losses: 0,
          avgConfidence: 0,
        };
      stats[key].total++;
      if (row.result === "win") stats[key].wins++;
      else stats[key].losses++;
      stats[key].avgConfidence += row.predicted_probability;
    }

    const result = Object.values(stats).map((s) => ({
      agent: s.agent,
      category: s.category,
      total: s.total,
      wins: s.wins,
      losses: s.losses,
      winRate: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0,
      avgConfidence:
        s.total > 0 ? Math.round((s.avgConfidence / s.total) * 100) : 0,
    }));

    return c.json({ accuracy: result });
  });

  return app;
}
