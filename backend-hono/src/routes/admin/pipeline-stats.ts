// [claude-code 2026-04-28] S48-T1: Admin pipeline stats route.
//   GET /api/admin/pipeline-stats?hours=24 → per-pipeline headline count,
//   errors, last success, uptime %. Gate: super-admin (applied in routes/index.ts).
// [claude-code 2026-04-29] S53-T1: GET /api/admin/pipeline-stats/runtime →
//   compact control-plane status for Refinement polling (no heavy joins).
// [claude-code 2026-04-29] S53-T4: fix response shape — return { pipelines }
//   key with camelCase fields + label/enabled enrichment so frontend
//   usePipelineStats hook contract matches.

import { Hono } from "hono";
import { computePipelineStats } from "../../services/riskflow/pipeline-stats.js";
import { getPipelineStateSnapshot } from "../../services/riskflow/pipeline-gate.js";
import { isPollingActive } from "../../services/riskflow/feed-poller.js";
import { getEconPopulatorStatus } from "../../services/cron/econ-calendar-populator.js";
import {
  getLastEconKeywordResult,
  isEconKeywordSchedulerActive,
} from "../../services/cron/econ-keyword-scheduler.js";
import {
  getCurrentSnapshot as getDropSnapshot,
  isDropCounterFlushRunning,
} from "../../services/riskflow/drop-counters.js";
import {
  getLedgerEntries,
  getLeakSentinel,
  getContinuityCounters,
} from "../../services/riskflow/ingest-ledger.js";
import { getAllowlistSnapshot } from "../../services/riskflow/source-policy.js";

const app = new Hono();

const PIPELINE_LABELS: Record<string, string> = {
  "x-browser-session": "X Browser Session",
  "x-syndication": "X Syndication",
  "browser-harness": "Browser Harness",
  "economic-calendar": "Economic Calendar",
  "kalshi-whale": "Kalshi Whale",
};

// GET /api/admin/pipeline-stats?hours=24
app.get("/", async (c) => {
  const hoursParam = c.req.query("hours") ?? "24";
  const hours = parseInt(hoursParam, 10);
  if (isNaN(hours) || hours < 1 || hours > 720) {
    return c.json({ error: "hours must be 1–720" }, 400);
  }

  const stats = await computePipelineStats(hours);
  const pipelineStates = getPipelineStateSnapshot();

  const pipelines = stats.map((s) => ({
    pipeline_id: s.pipeline_id,
    label: PIPELINE_LABELS[s.pipeline_id] ?? s.pipeline_id,
    enabled: pipelineStates[s.pipeline_id] ?? true,
    headlineCount: s.headline_count,
    errorCount: s.error_count,
    lastSuccessAt: s.last_success_at,
    uptimePct: s.uptime_pct,
  }));

  return c.json({ pipelines, hours, computed_at: new Date().toISOString() });
});

// GET /api/admin/pipeline-stats/runtime
// Compact payload for Refinement UI high-frequency polling.
// Avoids heavy COUNT(*) joins — uses in-memory snapshots for everything
// except a lightweight 24h headline count.
app.get("/runtime", async (c) => {
  const pipelineSnapshot = getPipelineStateSnapshot();
  const populatorStatus = getEconPopulatorStatus();
  const keywordResult = getLastEconKeywordResult();
  const keywordRunning = isEconKeywordSchedulerActive();
  const dropSnapshot = getDropSnapshot();
  const dropFlushRunning = isDropCounterFlushRunning();
  const feedPollerRunning = isPollingActive();

  let headlines24h = 0;
  try {
    const { getSupabaseClient } = await import("../../config/supabase.js");
    const sb = getSupabaseClient();
    if (sb) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await sb
        .from("raw_riskflow_items")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since);
      if (!error && count !== null) headlines24h = count;
    }
  } catch {
    // Non-fatal
  }

  return c.json({
    pipelines: pipelineSnapshot,
    econ_populator_running: populatorStatus.running,
    econ_populator_last_result: populatorStatus.lastResult,
    econ_keyword_running: keywordRunning,
    econ_keyword_last_result: keywordResult,
    drop_counter_flush_running: dropFlushRunning,
    drop_counter_total: dropSnapshot.total_dropped,
    feed_poller_running: feedPollerRunning,
    headlines_24h: headlines24h,
    leak_sentinel: getLeakSentinel(),
    continuity: getContinuityCounters(),
    allowlist: getAllowlistSnapshot(),
    computed_at: new Date().toISOString(),
  });
});

// GET /api/admin/pipeline-stats/ingest-activity?limit=100
// Everything timeline — every poll attempt with decision, reason, timestamp.
app.get("/ingest-activity", async (c) => {
  const limitParam = c.req.query("limit") ?? "100";
  const limit = Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 500);
  return c.json({
    entries: getLedgerEntries(limit),
    leak_sentinel: getLeakSentinel(),
    continuity: getContinuityCounters(),
    computed_at: new Date().toISOString(),
  });
});

// ── Doctoring Queue ────────────────────────────────────────────────────────
// Card-level doctoring action — queue incidents for next debug hook cycle.

interface DoctoringTicket {
  id: string;
  source: string;
  pipeline: string;
  headline: string;
  reason: string;
  submitted_at: string;
}

let doctoringQueue: DoctoringTicket[] = [];
let doctoringNextId = 1;

// POST /api/admin/pipeline-stats/doctorate
app.post("/doctorate", async (c) => {
  const body = await c.req
    .json<{
      source?: string;
      pipeline?: string;
      headline?: string;
      reason?: string;
    }>()
    .catch(() => ({
      source: undefined,
      pipeline: undefined,
      headline: undefined,
      reason: undefined,
    }));

  if (!body.source && !body.headline) {
    return c.json({ error: "source or headline required" }, 400);
  }

  const ticket: DoctoringTicket = {
    id: `dr-${doctoringNextId++}-${Date.now()}`,
    source: (body.source ?? "unknown").slice(0, 128),
    pipeline: (body.pipeline ?? "manual").slice(0, 64),
    headline: (body.headline ?? "").slice(0, 256),
    reason: (body.reason ?? "operator-flagged").slice(0, 256),
    submitted_at: new Date().toISOString(),
  };

  doctoringQueue.push(ticket);
  if (doctoringQueue.length > 200) {
    doctoringQueue = doctoringQueue.slice(-200);
  }

  return c.json({ ok: true, ticket }, 201);
});

// GET /api/admin/pipeline-stats/doctorate
app.get("/doctorate", (c) => {
  return c.json({
    tickets: [...doctoringQueue].reverse(),
    count: doctoringQueue.length,
  });
});

// DELETE /api/admin/pipeline-stats/doctorate — clear the queue
app.delete("/doctorate", (c) => {
  doctoringQueue = [];
  doctoringNextId = 1;
  return c.json({ ok: true, cleared: true });
});

export function createPipelineStatsRoutes(): Hono {
  return app;
}
