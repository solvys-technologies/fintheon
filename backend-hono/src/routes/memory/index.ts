// [claude-code 2026-04-10] Wrapped all handlers in try/catch for graceful degradation
// [claude-code 2026-04-01] S13-T3: Shared memory + analysis history routes

import { Hono } from "hono";
import {
  getSharedMemory,
  setSharedMemory,
  listSharedMemory,
  deleteSharedMemory,
} from "../../services/peers/shared-memory.js";
import {
  searchAnalysisHistory,
  getAgentAnalysisHistory,
  getAnalysisByInstrument,
} from "../../services/peers/analysis-history.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("MemoryRoutes");

export function createMemoryRoutes(): Hono {
  const app = new Hono();

  // ── Shared Memory ─────────────────────────────────────────────────────

  // GET /api/memory/shared — list with optional category/search filter
  app.get("/shared", async (c) => {
    try {
      const category = c.req.query("category") || undefined;
      const search = c.req.query("search") || undefined;
      const entries = await listSharedMemory({ category, search });
      return c.json({ entries });
    } catch (err) {
      log.error("Failed to list shared memory", { error: String(err) });
      return c.json({ entries: [], error: "shared memory unavailable" });
    }
  });

  // GET /api/memory/shared/:key — get single entry
  app.get("/shared/:key", async (c) => {
    try {
      const key = c.req.param("key");
      const entry = await getSharedMemory(key);
      return c.json({ entry });
    } catch (err) {
      log.error("Failed to get shared memory entry", { error: String(err) });
      return c.json({ entry: null, error: "shared memory unavailable" });
    }
  });

  // PUT /api/memory/shared/:key — set/upsert
  app.put("/shared/:key", async (c) => {
    try {
      const key = c.req.param("key");
      const body = await c.req.json<{
        value: Record<string, unknown>;
        category?: string;
        ttlHours?: number;
        agentName?: string;
      }>();
      const entry = await setSharedMemory(key, body.value, {
        category: body.category,
        ttlHours: body.ttlHours,
        agentName: body.agentName,
      });
      return c.json({ entry });
    } catch (err) {
      log.error("Failed to set shared memory", { error: String(err) });
      return c.json({ entry: null, error: "shared memory unavailable" });
    }
  });

  // DELETE /api/memory/shared/:key
  app.delete("/shared/:key", async (c) => {
    try {
      const key = c.req.param("key");
      const ok = await deleteSharedMemory(key);
      return c.json({ ok });
    } catch (err) {
      log.error("Failed to delete shared memory", { error: String(err) });
      return c.json({ ok: false, error: "shared memory unavailable" });
    }
  });

  // ── Analysis History ──────────────────────────────────────────────────

  // GET /api/memory/analysis/search?q=...&agent=...&limit=...
  app.get("/analysis/search", async (c) => {
    try {
      const q = c.req.query("q") || "";
      const agent = c.req.query("agent") || undefined;
      const limit = Number(c.req.query("limit")) || 20;
      if (!q.trim()) return c.json({ results: [] });
      const results = await searchAnalysisHistory(q, { agent, limit });
      return c.json({ results });
    } catch (err) {
      log.error("Failed to search analysis history", { error: String(err) });
      return c.json({ results: [], error: "analysis search unavailable" });
    }
  });

  // GET /api/memory/analysis/agent/:name
  app.get("/analysis/agent/:name", async (c) => {
    try {
      const name = c.req.param("name");
      const limit = Number(c.req.query("limit")) || 20;
      const thoughts = await getAgentAnalysisHistory(name, limit);
      return c.json({ thoughts });
    } catch (err) {
      log.error("Failed to get agent analysis history", { error: String(err) });
      return c.json({ thoughts: [], error: "analysis history unavailable" });
    }
  });

  // GET /api/memory/analysis/instrument/:sym
  app.get("/analysis/instrument/:sym", async (c) => {
    try {
      const sym = c.req.param("sym");
      const limit = Number(c.req.query("limit")) || 20;
      const thoughts = await getAnalysisByInstrument(sym, limit);
      return c.json({ thoughts });
    } catch (err) {
      log.error("Failed to get instrument analysis", { error: String(err) });
      return c.json({ thoughts: [], error: "analysis history unavailable" });
    }
  });

  return app;
}
