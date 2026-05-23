// [claude-code 2026-04-26] /api/market-scan — TradingView Scanner-backed
// market data routes. Powers Strategium daily-perf, Performance journal
// snapshots, and the Harper market_scan tool.
import { Hono } from "hono";
import {
  quotes,
  topMovers,
  presetGoldSilverOil,
  presetMajorFx,
  presetUsIndices,
  presetUsFutures,
  presetCommodityFutures,
  presetRateFutures,
  type ScannerMarket,
} from "../../services/tradingview/scanner.js";
import { fetchMacroWatchlist } from "../../services/market-data/macro-watchlist.js";

export function createMarketScanRoutes() {
  const app = new Hono();

  // GET /api/market-scan/indices — SPX/NDX/DJI/RUT/VIX cash snapshot
  app.get("/indices", async (c) => {
    try {
      const data = await presetUsIndices();
      return c.json({ ok: true, asOf: new Date().toISOString(), data });
    } catch (err) {
      return c.json(
        { ok: false, error: (err as Error).message ?? "scanner_error" },
        502,
      );
    }
  });

  // GET /api/market-scan/futures — /ES /NQ /YM /RTY /VX continuous front-month
  app.get("/futures", async (c) => {
    try {
      const data = await presetUsFutures();
      return c.json({ ok: true, asOf: new Date().toISOString(), data });
    } catch (err) {
      return c.json(
        { ok: false, error: (err as Error).message ?? "scanner_error" },
        502,
      );
    }
  });

  // GET /api/market-scan/commodities — /GC /SI /CL /NG /HG continuous
  app.get("/commodities", async (c) => {
    try {
      const data = await presetCommodityFutures();
      return c.json({ ok: true, asOf: new Date().toISOString(), data });
    } catch (err) {
      return c.json(
        { ok: false, error: (err as Error).message ?? "scanner_error" },
        502,
      );
    }
  });

  // GET /api/market-scan/rates — /ZB /ZN /ZF /ZT Treasury futures continuous
  app.get("/rates", async (c) => {
    try {
      const data = await presetRateFutures();
      return c.json({ ok: true, asOf: new Date().toISOString(), data });
    } catch (err) {
      return c.json(
        { ok: false, error: (err as Error).message ?? "scanner_error" },
        502,
      );
    }
  });

  // GET /api/market-scan/fx — major USD pairs
  app.get("/fx", async (c) => {
    try {
      const data = await presetMajorFx();
      return c.json({ ok: true, asOf: new Date().toISOString(), data });
    } catch (err) {
      return c.json(
        { ok: false, error: (err as Error).message ?? "scanner_error" },
        502,
      );
    }
  });

  // GET /api/market-scan/metals — gold/silver/oil
  app.get("/metals", async (c) => {
    try {
      const data = await presetGoldSilverOil();
      return c.json({ ok: true, asOf: new Date().toISOString(), data });
    } catch (err) {
      return c.json(
        { ok: false, error: (err as Error).message ?? "scanner_error" },
        502,
      );
    }
  });

  app.get("/macro-watchlist", async (c) => {
    try {
      const data = await fetchMacroWatchlist();
      return c.json({ ok: true, asOf: new Date().toISOString(), data });
    } catch (err) {
      return c.json(
        { ok: false, error: (err as Error).message ?? "scanner_error" },
        502,
      );
    }
  });

  // GET /api/market-scan/top-movers?side=gainers|losers&market=america&limit=10
  app.get("/top-movers", async (c) => {
    const side = (c.req.query("side") ?? "gainers") as "gainers" | "losers";
    const market = (c.req.query("market") ?? "america") as ScannerMarket;
    const limit = Math.max(
      1,
      Math.min(parseInt(c.req.query("limit") ?? "10", 10) || 10, 50),
    );
    try {
      const data = await topMovers({ side, market, limit });
      return c.json({
        ok: true,
        side,
        market,
        asOf: new Date().toISOString(),
        data,
      });
    } catch (err) {
      return c.json(
        { ok: false, error: (err as Error).message ?? "scanner_error" },
        502,
      );
    }
  });

  // POST /api/market-scan/quotes  { symbols: string[], market?: ScannerMarket }
  app.post("/quotes", async (c) => {
    let body: { symbols?: unknown; market?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "invalid_json" }, 400);
    }
    const symbols = Array.isArray(body.symbols)
      ? (body.symbols as unknown[])
          .filter((s): s is string => typeof s === "string")
          .slice(0, 50)
      : [];
    if (symbols.length === 0) {
      return c.json({ ok: false, error: "no_symbols" }, 400);
    }
    const market = (
      typeof body.market === "string" ? body.market : "america"
    ) as ScannerMarket;
    try {
      const data = await quotes(symbols, market);
      return c.json({ ok: true, asOf: new Date().toISOString(), data });
    } catch (err) {
      return c.json(
        { ok: false, error: (err as Error).message ?? "scanner_error" },
        502,
      );
    }
  });

  return app;
}
