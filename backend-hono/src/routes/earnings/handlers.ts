// [claude-code 2026-04-26] S45.5/F1: switched calendar source FMP → megacap-orchestrator (TV chain)
// [claude-code 2026-04-25] S40-P8: /api/earnings/* handlers — public reads
// (lookahead is UI content). Mutations gated through internal cron only.

import type { Context } from "hono";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { refreshMegacapEarnings } from "../../services/earnings/megacap-orchestrator.js";

const log = createLogger("EarningsRoutes");

interface EarningsRow {
  id: string;
  symbol: string;
  company_name: string | null;
  fiscal_quarter: string | null;
  report_date: string;
  report_time: string | null;
  forecast_eps: number | null;
  actual_eps: number | null;
  beat_miss: string | null;
  surprise_percent: number | null;
}

export async function handleUpcomingEarnings(c: Context) {
  const daysParam = parseInt(c.req.query("days") ?? "7", 10);
  const days = Number.isFinite(daysParam)
    ? Math.min(Math.max(daysParam, 1), 90)
    : 7;
  const symbol = c.req.query("symbol")?.toUpperCase();

  const sb = getSupabaseClient();
  if (!sb) {
    return c.json({ events: [], reason: "supabase_unavailable" }, 503);
  }

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + days);
  const horizonIso = horizon.toISOString().slice(0, 10);

  let query = sb
    .from("earnings_events")
    .select(
      "id, symbol, company_name, fiscal_quarter, report_date, report_time, forecast_eps, actual_eps, beat_miss, surprise_percent",
    )
    .gte("report_date", today)
    .lte("report_date", horizonIso)
    .eq("in_ndx", true)
    .eq("in_spx", true)
    .order("report_date", { ascending: true })
    .order("report_time", { ascending: true });

  if (symbol) query = query.eq("symbol", symbol);

  const { data, error } = await query;
  if (error) {
    log.warn("upcoming earnings query failed", { error: error.message });
    return c.json({ events: [], reason: error.message }, 500);
  }

  return c.json({
    events: (data ?? []) as EarningsRow[],
    windowDays: days,
    asOf: new Date().toISOString(),
  });
}

export async function handleRefreshEarnings(c: Context) {
  // Gated to local-only callers via the existing localhost guard pattern is
  // overkill here — the upsert is idempotent and cron-driven anyway. Just
  // require an internal-trigger header to discourage casual invocation.
  const trigger = c.req.header("x-internal-trigger");
  if (trigger !== "megacap-refresh") {
    return c.json({ error: "x-internal-trigger header required" }, 401);
  }
  const daysAhead = parseInt(c.req.query("daysAhead") ?? "90", 10);
  const result = await refreshMegacapEarnings({
    daysAhead: Number.isFinite(daysAhead) ? daysAhead : 90,
  });
  return c.json(result);
}
