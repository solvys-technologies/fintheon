// [claude-code 2026-04-16] S20-T3: Oracle research API endpoint

import { Hono } from "hono";
import { getSupabaseClient, isSupabaseConfigured } from "../config/supabase.js";
import { triggerResearchCycle } from "../services/cron/oracle-research-scheduler.js";

export function createOracleRoutes(): Hono {
  const router = new Hono();

  // GET /api/oracle/research — returns recent findings (last 24h)
  router.get("/research", async (c) => {
    if (!isSupabaseConfigured()) {
      return c.json({ findings: [], message: "Supabase not configured" });
    }

    const status = c.req.query("status") || "active";
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from("oracle_research_findings")
      .select("*")
      .eq("status", status)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json({
      findings: data ?? [],
      fetchedAt: new Date().toISOString(),
    });
  });

  // POST /api/oracle/research/trigger — manual cycle trigger
  router.post("/research/trigger", async (c) => {
    try {
      const findings = await triggerResearchCycle();
      return c.json({
        findings,
        count: findings.length,
        triggeredAt: new Date().toISOString(),
      });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  return router;
}
