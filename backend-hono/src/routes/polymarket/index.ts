// [claude-code 2026-04-12] S15-T2: Polymarket read-only service — public API data for research/signal enrichment
import { Hono } from "hono";
import { createPolymarketService } from "../../services/polymarket-service.js";

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

  return app;
}
