/**
 * RiskFlow Routes
 * Route registration for /api/riskflow endpoints
 */

import { Hono } from "hono";
import {
  handleGetFeed,
  handleGetBreaking,
  handlePreload,
  handleGetWatchlist,
  handleUpdateWatchlist,
  handleAddSymbols,
  handleRemoveSymbols,
  handleBreakingStream,
  handleCronPrefetch,
  handleDebug,
  handleGetIVAggregate,
  handleGetSources,
  handleRefresh,
  handleGenerateNote,
  handleRescore,
  handlePollingToggle,
  handlePollingStatus,
  handleUserPollingToggle,
  handleUserPollingStatus,
  handleGetPhrases,
  handleAddPhrase,
  handleDeletePhrase,
  handleNotRelevant,
  handleGetRiskSignals,
} from "./handlers.js";

export function createRiskFlowRoutes(): Hono {
  const router = new Hono();

  // GET /api/riskflow/feed - Get news feed
  router.get("/feed", handleGetFeed);

  // GET /api/riskflow/breaking - Get breaking news only
  router.get("/breaking", handleGetBreaking);

  // GET /api/riskflow/stream - Level 4 SSE updates
  router.get("/stream", handleBreakingStream);

  // GET /api/riskflow/preload - Pre-load 15 tweets, last 48h, level 3+
  router.get("/preload", handlePreload);

  // GET /api/riskflow/watchlist - Get user watchlist
  router.get("/watchlist", handleGetWatchlist);

  // POST /api/riskflow/watchlist - Update watchlist
  router.post("/watchlist", handleUpdateWatchlist);

  // POST /api/riskflow/watchlist/symbols - Add symbols
  router.post("/watchlist/symbols", handleAddSymbols);

  // DELETE /api/riskflow/watchlist/symbols - Remove symbols
  router.delete("/watchlist/symbols", handleRemoveSymbols);

  // POST /api/riskflow/cron/prefetch - Cron job to pre-fetch news (protected by secret token)
  router.post("/cron/prefetch", handleCronPrefetch);

  // GET /api/riskflow/debug - Debug endpoint
  router.get("/debug", handleDebug);

  // GET /api/riskflow/iv-aggregate - Aggregated IV score with VIX correlation
  router.get("/iv-aggregate", handleGetIVAggregate);

  // POST /api/riskflow/refresh - Manual refresh trigger
  router.post("/refresh", handleRefresh);

  // POST /api/riskflow/rescore - Re-score with current regime/calibration weights
  router.post("/rescore", handleRescore);

  // POST /api/riskflow/:id/generate-note - Manual agent note generation
  router.post("/:id/generate-note", handleGenerateNote);

  // POST /api/riskflow/:id/not-relevant - Thumbs down — remove + log for scorer feedback
  router.post("/:id/not-relevant", handleNotRelevant);

  // GET /api/riskflow/sources - Connection status for data source indicators (public)
  router.get("/sources", handleGetSources);

  // POST /api/riskflow/polling-toggle - Enable/disable automatic polling (S10-T1c)
  router.post("/polling-toggle", handlePollingToggle);

  // GET /api/riskflow/polling-status - Current polling state for frontend toggle sync
  router.get("/polling-status", handlePollingStatus);

  // POST /api/riskflow/user-polling-toggle - Per-user X CLI killswitch
  router.post("/user-polling-toggle", handleUserPollingToggle);

  // GET /api/riskflow/user-polling-status - Per-user polling registry status
  router.get("/user-polling-status", handleUserPollingStatus);

  // Catalyst Watch — watchlist phrase CRUD
  router.get("/phrases", handleGetPhrases);
  router.post("/phrases", handleAddPhrase);
  router.delete("/phrases/:id", handleDeletePhrase);

  // Risk Signals — AI-refined cards (S16-T3)
  router.get("/risk-signals", handleGetRiskSignals);

  // POST /api/riskflow/rettiwt-refresh — force-reload keys from DB + reset cooldowns
  // [claude-code 2026-04-16] Called on app startup to ensure X feed polling is immediately healthy
  router.post("/rettiwt-refresh", async (c) => {
    const { forceRefreshPool, getPoolStatus } =
      await import("../../services/rettiwt-service.js");
    const result = await forceRefreshPool();
    const status = getPoolStatus();
    return c.json({ ...result, pool: status });
  });

  return router;
}
