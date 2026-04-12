// [claude-code 2026-04-12] S15-T3: Added divergence, prediction tracking, accuracy routes
// [claude-code 2026-04-12] S15-T2: Polymarket read-only service — public API data for research/signal enrichment
import { Hono } from "hono";
import { createPolymarketService } from "../../services/polymarket-service.js";
import { getRecentDivergenceAlerts } from "../../services/polymarket-kalshi-divergence.js";
import { getSupabaseClient } from "../../config/supabase.js";

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

  // POST /api/polymarket/predictions — record an agent prediction
  app.post("/predictions", async (c) => {
    const body = await c.req.json();
    const {
      marketId,
      marketTitle,
      predictedOutcome,
      predictedProbability,
      agentName,
      snapshotProbability,
    } = body;

    if (
      !marketId ||
      !marketTitle ||
      !predictedOutcome ||
      predictedProbability == null
    ) {
      return c.json({ error: "Missing required fields" }, 400);
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

  // GET /api/polymarket/predictions/accuracy — agent accuracy stats
  app.get("/predictions/accuracy", async (c) => {
    const agent = c.req.query("agent");

    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "No database" }, 503);

    let query = sb
      .from("polymarket_predictions")
      .select("agent_name, result, predicted_probability")
      .eq("resolved", true);

    if (agent) query = query.eq("agent_name", agent);

    const { data, error } = await query;
    if (error) return c.json({ error: error.message }, 500);

    const stats: Record<
      string,
      { total: number; wins: number; losses: number; avgConfidence: number }
    > = {};
    for (const row of data ?? []) {
      const name = row.agent_name;
      if (!stats[name])
        stats[name] = { total: 0, wins: 0, losses: 0, avgConfidence: 0 };
      stats[name].total++;
      if (row.result === "win") stats[name].wins++;
      else stats[name].losses++;
      stats[name].avgConfidence += row.predicted_probability;
    }

    const result = Object.entries(stats).map(([agent, s]) => ({
      agent,
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
