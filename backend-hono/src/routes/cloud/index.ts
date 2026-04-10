// [claude-code 2026-03-19] Cloud API routes — Supabase-backed scored items, ER, settings, consilium
import { Hono } from "hono";
import {
  readScoredItems,
  writeRawItems,
  readERSessions,
  writeERSession,
  readUserSettings,
  writeUserSettings,
  readConsiliumMessages,
  writeConsiliumMessage,
  checkSupabaseHealth,
} from "../../services/supabase-service.js";
import { isCentralScorerRunning } from "../../services/riskflow/central-scorer.js";

const cloud = new Hono();

// ─── Scored Items ───────────────────────────────────────────────

cloud.get("/scored-items", async (c) => {
  const minMacroLevel = Number(c.req.query("minMacroLevel") || "0");
  const limit = Number(c.req.query("limit") || "100");
  const since = c.req.query("since");

  const items = await readScoredItems({
    minMacroLevel: minMacroLevel || undefined,
    limit,
    since: since || undefined,
  });
  return c.json({ items, total: items.length });
});

// Push raw items (team instances call this)
cloud.post("/raw-items", async (c) => {
  const body = await c.req.json();
  const items = Array.isArray(body) ? body : body.items;
  if (!items?.length) return c.json({ error: "items array required" }, 400);

  const written = await writeRawItems(items);
  return c.json({ success: true, written });
});

// ─── ER Sessions ────────────────────────────────────────────────

cloud.get("/er-sessions", async (c) => {
  const userId = c.req.query("userId") || "";
  if (!userId) return c.json({ error: "userId required" }, 400);

  const limit = Number(c.req.query("limit") || "20");
  const sessions = await readERSessions(userId, limit);
  return c.json({ sessions });
});

cloud.post("/er-sessions", async (c) => {
  const body = await c.req.json();
  if (!body.user_id) return c.json({ error: "user_id required" }, 400);

  const success = await writeERSession(body);
  return c.json({ success });
});

// ─── User Settings ──────────────────────────────────────────────

cloud.get("/settings", async (c) => {
  const userId = c.req.query("userId") || "";
  if (!userId) return c.json({ error: "userId required" }, 400);

  const settings = await readUserSettings(userId);
  return c.json({ settings });
});

cloud.put("/settings", async (c) => {
  const body = await c.req.json();
  if (!body.user_id) return c.json({ error: "user_id required" }, 400);

  const success = await writeUserSettings(body);
  return c.json({ success });
});

// ─── Consilium (Cloud-synced boardroom) ─────────────────────────

cloud.get("/consilium", async (c) => {
  const limit = Number(c.req.query("limit") || "100");
  const messages = await readConsiliumMessages(limit);
  return c.json({ messages });
});

cloud.post("/consilium", async (c) => {
  const body = await c.req.json();
  if (!body.agent_name || !body.content) {
    return c.json({ error: "agent_name and content required" }, 400);
  }

  const success = await writeConsiliumMessage(body);
  return c.json({ success });
});

// ─── Health / Status ────────────────────────────────────────────

cloud.get("/status", async (c) => {
  const healthy = await checkSupabaseHealth();
  return c.json({
    supabase: healthy,
    centralScorer: isCentralScorerRunning(),
  });
});

export default cloud;
