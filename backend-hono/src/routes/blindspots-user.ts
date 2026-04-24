// [claude-code 2026-04-23] S31-T6 — auth-gated, table-backed blindspots endpoints.
// Mounted at /api/blindspots alongside the existing anon agent-controllable
// blindspots router. The existing router owns GET/POST "/" and "/interview";
// this router owns "/psych", "/trading", "/latest" — all require a verified
// Supabase identity.

import { Hono } from "hono";
import type { Context } from "hono";
import { query, isPoolAvailable } from "../db/optimized.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface BlindspotDbRow {
  id: string;
  user_id: string;
  date: string;
  pattern: string;
  evidence: string;
  corrective_action: string;
  severity: number;
  source: "template" | "fluid";
  created_at: string;
}

function rowToJson(r: BlindspotDbRow) {
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    pattern: r.pattern,
    evidence: r.evidence,
    correctiveAction: r.corrective_action,
    severity: r.severity,
    source: r.source,
    createdAt: r.created_at,
  };
}

async function fetchByDate(
  table: "psych_blindspots" | "trading_blindspots",
  userId: string,
  date: string,
) {
  if (!isPoolAvailable()) return [];
  const result = await query<BlindspotDbRow>(
    `SELECT id, user_id, date::text AS date, pattern, evidence, corrective_action, severity, source, created_at
     FROM ${table}
     WHERE user_id = $1 AND date = $2
     ORDER BY severity DESC, created_at DESC`,
    [userId, date],
  );
  return result.rows.map(rowToJson);
}

async function fetchLatest(
  table: "psych_blindspots" | "trading_blindspots",
  userId: string,
) {
  if (!isPoolAvailable()) return { date: null as string | null, rows: [] };
  const latest = await query<{ date: string }>(
    `SELECT date::text AS date FROM ${table}
     WHERE user_id = $1
     ORDER BY date DESC
     LIMIT 1`,
    [userId],
  );
  const date = latest.rows[0]?.date ?? null;
  if (!date) return { date: null as string | null, rows: [] };
  const rows = await fetchByDate(table, userId, date);
  return { date, rows };
}

function getUserId(c: Context): string | null {
  const uid =
    (c.get("supabaseUid") as string | undefined) ||
    (c.get("userId") as string | undefined) ||
    null;
  if (!uid || uid === "anonymous") return null;
  return uid;
}

export function createBlindspotsUserRoutes() {
  const router = new Hono();

  router.get("/psych", async (c) => {
    const uid = getUserId(c);
    if (!uid) return c.json({ error: "Unauthorized" }, 401);
    const date = c.req.query("date");
    if (!date || !DATE_RE.test(date)) {
      return c.json({ error: "date=YYYY-MM-DD required" }, 400);
    }
    const rows = await fetchByDate("psych_blindspots", uid, date);
    return c.json({ date, blindspots: rows });
  });

  router.get("/trading", async (c) => {
    const uid = getUserId(c);
    if (!uid) return c.json({ error: "Unauthorized" }, 401);
    const date = c.req.query("date");
    if (!date || !DATE_RE.test(date)) {
      return c.json({ error: "date=YYYY-MM-DD required" }, 400);
    }
    const rows = await fetchByDate("trading_blindspots", uid, date);
    return c.json({ date, blindspots: rows });
  });

  router.get("/latest", async (c) => {
    const uid = getUserId(c);
    if (!uid) return c.json({ error: "Unauthorized" }, 401);
    const [psych, trading] = await Promise.all([
      fetchLatest("psych_blindspots", uid),
      fetchLatest("trading_blindspots", uid),
    ]);
    return c.json({ psych, trading });
  });

  return router;
}
