// [claude-code 2026-04-24] S34-T4: GET /source-quality — merges v_source_signal_noise
//   with in-memory drop-counter snapshot + recent riskflow_drop_counters rows.
//   The "items_ingested: 0, errors: 0" silent-drop pattern now has a trace.
// [claude-code 2026-04-23] S32-T7: surface autopilot guardian status on GET /.
// [claude-code 2026-03-20] Diagnostics endpoint — service status, missing env vars, suggested fixes
// [claude-code 2026-03-22] Add POST /hermes/restart for frontend-triggered Hermes re-initialization
// [claude-code 2026-04-24] S35-T10: dual-emit news_worker + riskflow_worker payloads.
//   Diagnostics reads from riskflow_worker_heartbeats (renamed table; legacy view alias
//   keeps any unmigrated readers green). Sunset old `news_worker` key 2026-05-08.
// [claude-code 2026-04-19] S27-T6/T7 (W2d): surface cache_hit_rate_24h (browser operator) and
//   riskflow_worker_age_seconds (riskflow worker heartbeat) on GET /.
// [claude-code 2026-04-24] S34-T10: surface econ_backfill aggregate on GET /.

import { Hono } from "hono";
import { pingDb } from "../../db/optimized.js";
import { getCurrentSnapshot as getDropCounterSnapshot } from "../../services/riskflow/drop-counters.js";
import { supabaseAuthHealth } from "../../services/supabase-auth.js";
import { isPollingActive } from "../../services/riskflow/feed-poller.js";
import { getFeedHealth } from "../../services/riskflow/feed-service.js";
import {
  isRettiwtAvailable,
  getPoolStatus,
} from "../../services/rettiwt-service.js";
import {
  isRettiwtRateLimited,
  getRettiwtCooldownMs,
} from "../../services/riskflow/econ-rettiwt-poller.js";
import { initHermesAgent } from "../../services/hermes-handler.js";
import { createLogger } from "../../lib/logger.js";
import {
  triggerReflect,
  isReflectRunning,
} from "../../services/autoresearch/reflect-scheduler.js";
import { getLatestReflectReport } from "../../services/autoresearch/reflect-engine.js";
import { getBrowseTaskStats24h } from "../../services/browser/operator.js";
import { getBrowserHarnessStats24h } from "../../services/browser/harness-tool.js";
import { getFiscalSpeakerStats } from "../../services/cron/fiscal-speaker-populator.js";
import { getEconBackfillDiagnostics } from "../../services/cron/econ-backfill-orchestrator.js";
import type { BackfillDiagnostics } from "../../types/econ-backfill.js";

const log = createLogger("Diagnostics");

type ServiceStatus = "ok" | "error" | "degraded" | "unavailable";

interface ServiceDiagnostic {
  name: string;
  status: ServiceStatus;
  detail?: string;
  fix?: string;
}

interface DiagnosticsResponse {
  timestamp: string;
  overall: ServiceStatus;
  services: ServiceDiagnostic[];
  missingEnvVars: string[];
  browser_operator?: {
    runs_24h: number;
    hits_24h: number;
    cache_hit_rate_24h: number;
    cost_usd_24h: number;
  };
  // [S35-T10] dual-emit window through 2026-05-08; both keys carry identical payloads.
  news_worker?: {
    age_seconds: number | null;
    tiers: Array<{
      tier: string;
      last_run_at: string | null;
      age_seconds: number | null;
      items_ingested: number;
      errors: number;
    }>;
  };
  riskflow_worker?: {
    age_seconds: number | null;
    tiers: Array<{
      tier: string;
      last_run_at: string | null;
      age_seconds: number | null;
      items_ingested: number;
      errors: number;
    }>;
  };
  autopilot?: {
    status: "active" | "paused" | "disabled";
    reason: string | null;
    resumesAt: string | null;
    detail: string | null;
  };
  tools?: {
    browser_harness?: {
      available: boolean;
      calls_24h: number;
      errors_24h: number;
      rate_limit_per_min: number;
    };
  };
  econ_backfill?: BackfillDiagnostics;
}

async function getRiskFlowWorkerSnapshot(): Promise<
  DiagnosticsResponse["riskflow_worker"]
> {
  const { getSupabaseClient } = await import("../../config/supabase.js");
  const sb = getSupabaseClient();
  if (!sb) return { age_seconds: null, tiers: [] };
  try {
    const { data, error } = await sb
      .from("riskflow_worker_heartbeats")
      .select("tier, last_run_at, items_ingested, errors");
    if (error || !data) return { age_seconds: null, tiers: [] };
    const now = Date.now();
    const tiers = (
      data as Array<{
        tier: string;
        last_run_at: string | null;
        items_ingested: number;
        errors: number;
      }>
    ).map((row) => ({
      tier: row.tier,
      last_run_at: row.last_run_at,
      age_seconds: row.last_run_at
        ? Math.round((now - new Date(row.last_run_at).getTime()) / 1000)
        : null,
      items_ingested: Number(row.items_ingested ?? 0),
      errors: Number(row.errors ?? 0),
    }));
    const ages = tiers
      .map((t) => t.age_seconds)
      .filter((n): n is number => typeof n === "number");
    const age_seconds = ages.length > 0 ? Math.min(...ages) : null;
    return { age_seconds, tiers };
  } catch {
    return { age_seconds: null, tiers: [] };
  }
}

/* ------------------------------------------------------------------ */
/*  Individual service checks                                          */
/* ------------------------------------------------------------------ */

async function checkHermesAI(): Promise<ServiceDiagnostic> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      name: "Hermes AI (OpenRouter)",
      status: "error",
      detail: "OPENROUTER_API_KEY not set",
      fix: "Add OPENROUTER_API_KEY to backend-hono/.env",
    };
  }

  try {
    const start = Date.now();
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    const latency = Date.now() - start;

    if (res.ok) {
      return {
        name: "Hermes AI (OpenRouter)",
        status: "ok",
        detail: `${latency}ms response`,
      };
    }
    return {
      name: "Hermes AI (OpenRouter)",
      status: "degraded",
      detail: `HTTP ${res.status} — ${latency}ms`,
      fix: "Check OpenRouter API key validity at openrouter.ai/settings/keys",
    };
  } catch (err) {
    return {
      name: "Hermes AI (OpenRouter)",
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
      fix: "Check network connectivity to openrouter.ai",
    };
  }
}

async function checkDatabase(): Promise<ServiceDiagnostic> {
  if (!process.env.DATABASE_URL) {
    return {
      name: "Database",
      status: "unavailable",
      detail: "No DATABASE_URL — using cloud backend (fintheon.fly.dev)",
    };
  }

  try {
    const start = Date.now();
    await pingDb();
    const latency = Date.now() - start;
    return {
      name: "Supabase",
      status: "ok",
      detail: `Connected — ${latency}ms ping`,
    };
  } catch (err) {
    return {
      name: "Supabase",
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
      fix: "Check DATABASE_URL in backend-hono/.env — ensure Neon/Supabase is reachable",
    };
  }
}

function checkRiskFlowPoller(): ServiceDiagnostic {
  const running = isPollingActive();
  return {
    name: "RiskFlow Feed Poller",
    status: running ? "ok" : "error",
    detail: running ? "Running — 15s poll interval" : "Stopped",
    fix: running
      ? undefined
      : "Run `fintheon start backend` to restart the feed poller",
  };
}

function checkRettiwt(): ServiceDiagnostic {
  if (!isRettiwtAvailable()) {
    return {
      name: "X Feed",
      status: "unavailable",
      detail: "RETTIWT_AUTH_TOKEN not set",
      fix: "Add RETTIWT_AUTH_TOKEN to backend-hono/.env",
    };
  }
  if (isRettiwtRateLimited()) {
    const cooldownSec = Math.round(getRettiwtCooldownMs() / 1000);
    return {
      name: "X Feed",
      status: "degraded",
      detail: `Rate limited — cooldown ${cooldownSec}s remaining`,
    };
  }
  return {
    name: "X Feed",
    status: "ok",
    detail: "Token configured",
  };
}

function checkSupabaseAuth(): ServiceDiagnostic {
  const health = supabaseAuthHealth();
  if (health.hasCredentials) {
    return {
      name: "Supabase Auth",
      status: "ok",
      detail: "Credentials configured",
    };
  }
  if (health.mockMode) {
    return {
      name: "Supabase Auth",
      status: "degraded",
      detail: "Dev mock mode (no SUPABASE_URL)",
    };
  }
  return {
    name: "Supabase Auth",
    status: "error",
    detail: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in production",
    fix: "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend-hono/.env",
  };
}

function checkTradingView(): ServiceDiagnostic {
  return {
    name: "TradingView",
    status: "ok",
    detail: "Frontend widget — check browser console for load errors",
  };
}

/* ------------------------------------------------------------------ */
/*  Env var audit                                                       */
/* ------------------------------------------------------------------ */

const REQUIRED_ENV_VARS = ["OPENROUTER_API_KEY"];

const RECOMMENDED_ENV_VARS = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EXA_API_KEY",
  "FRED_API_KEY",
];

function auditEnvVars(): string[] {
  const missing: string[] = [];
  for (const key of [...REQUIRED_ENV_VARS, ...RECOMMENDED_ENV_VARS]) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  return missing;
}

// ── Smart Model Routing snapshot (T9 W2e) ────────────────────────────────
// Aggregates the last 24h of routing_decisions rows per agent so the
// RoutingWidget on the diagnostics page can show live per-agent cost + latency.

interface RoutingAgentRow {
  model: string;
  calls: number;
  total_cost_usd: number;
  avg_latency_ms: number;
}

async function loadRoutingSnapshot(): Promise<{
  last_24h: Record<string, RoutingAgentRow>;
  budget_status: {
    user_id: string;
    used_usd: number;
    cap_usd: number;
    degraded: boolean;
  };
} | null> {
  try {
    const { getSupabaseClient } = await import("../../config/supabase.js");
    const sb = getSupabaseClient();
    if (!sb) return null;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await sb
      .from("routing_decisions")
      .select("agent_id, model, cost_usd, latency_ms")
      .gte("created_at", since);
    const rows = (data ?? []) as Array<{
      agent_id: string;
      model: string;
      cost_usd: number | null;
      latency_ms: number | null;
    }>;
    const agg: Record<
      string,
      { model: string; calls: number; cost: number; latencySum: number }
    > = {};
    for (const r of rows) {
      const key = r.agent_id;
      if (!agg[key]) {
        agg[key] = { model: r.model, calls: 0, cost: 0, latencySum: 0 };
      }
      agg[key].calls += 1;
      agg[key].cost += Number(r.cost_usd ?? 0);
      agg[key].latencySum += Number(r.latency_ms ?? 0);
      agg[key].model = r.model;
    }
    const last_24h: Record<string, RoutingAgentRow> = {};
    for (const [agent, v] of Object.entries(agg)) {
      last_24h[agent] = {
        model: v.model,
        calls: v.calls,
        total_cost_usd: Number(v.cost.toFixed(6)),
        avg_latency_ms: v.calls > 0 ? Math.round(v.latencySum / v.calls) : 0,
      };
    }

    const { getBudgetStatus } = await import("../../services/ai/budget.js");
    const budget = await getBudgetStatus(undefined);
    return {
      last_24h,
      budget_status: {
        user_id: budget.user_id,
        used_usd: budget.used_usd,
        cap_usd: budget.cap_usd,
        degraded: budget.degraded,
      },
    };
  } catch (err) {
    log.warn("loadRoutingSnapshot failed", { error: String(err) });
    return null;
  }
}

// ── GEPA snapshot (T11) ──────────────────────────────────────────────────

async function loadGepaSnapshot(): Promise<{
  last_run_at: string | null;
  evolutions_proposed_7d: number;
  evolutions_merged_7d: number;
  current_metric_deltas: Record<
    string,
    { accuracy: string; latency: string; cost: string }
  >;
} | null> {
  try {
    const { loadGepaDiagnostics } =
      await import("../../services/gepa/runner.js");
    return await loadGepaDiagnostics();
  } catch (err) {
    log.warn("loadGepaSnapshot failed (GEPA may be disabled)", {
      error: String(err),
    });
    return {
      last_run_at: null,
      evolutions_proposed_7d: 0,
      evolutions_merged_7d: 0,
      current_metric_deltas: {},
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Route                                                               */
/* ------------------------------------------------------------------ */

export function createDiagnosticsRoutes(): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    const start = Date.now();

    const [services, browserStats, riskflowWorker, econBackfill] =
      await Promise.all([
        Promise.all([
          checkHermesAI(),
          checkDatabase(),
          Promise.resolve(checkRettiwt()),
          Promise.resolve(checkSupabaseAuth()),
        ]),
        getBrowseTaskStats24h(),
        getRiskFlowWorkerSnapshot(),
        getEconBackfillDiagnostics().catch(() => null),
      ]);

    const missingEnvVars = auditEnvVars();

    const hasError = services.some((s) => s.status === "error");
    const hasDegraded = services.some((s) => s.status === "degraded");
    const overall: ServiceStatus = hasError
      ? "error"
      : hasDegraded
        ? "degraded"
        : "ok";

    const [routing, gepa] = await Promise.all([
      loadRoutingSnapshot(),
      loadGepaSnapshot(),
    ]);

    const response: DiagnosticsResponse & {
      routing?: unknown;
      gepa?: unknown;
      fiscal_speakers?: unknown;
    } = {
      timestamp: new Date().toISOString(),
      overall,
      services,
      missingEnvVars,
      browser_operator: browserStats,
      // [S35-T10] dual-emit through 2026-05-08; legacy news_worker mirrors riskflow_worker.
      news_worker: riskflowWorker,
      riskflow_worker: riskflowWorker,
      econ_backfill: econBackfill ?? undefined,
      routing,
      gepa,
      fiscal_speakers: getFiscalSpeakerStats(),
    };

    log.info("Diagnostics check", { overall, elapsed: Date.now() - start });

    const statusCode =
      overall === "ok" ? 200 : overall === "degraded" ? 207 : 503;
    return c.json(response, statusCode);
  });

  /* ------------------------------------------------------------------ */
  /*  Routing snapshot — Smart Model Routing telemetry                   */
  /* ------------------------------------------------------------------ */

  router.get("/routing", async (c) => {
    return c.json((await loadRoutingSnapshot()) ?? { last_24h: {} });
  });

  router.get("/gepa", async (c) => {
    return c.json((await loadGepaSnapshot()) ?? { last_run_at: null });
  });

  /* ------------------------------------------------------------------ */
  /*  Hermes restart — rate-limited to once per 30s                      */
  /* ------------------------------------------------------------------ */

  let lastRestartAt = 0;

  router.post("/hermes/restart", async (c) => {
    const now = Date.now();
    if (now - lastRestartAt < 30_000) {
      return c.json(
        {
          success: false,
          message: "Rate limited — wait 30s between restart attempts",
        },
        429,
      );
    }

    lastRestartAt = now;
    log.info("Hermes restart requested by frontend");

    try {
      await initHermesAgent();
      return c.json({
        success: true,
        message: "Hermes re-initialization complete",
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      log.warn("Hermes restart failed", { error: detail });
      return c.json({ success: false, message: detail }, 500);
    }
  });

  /* ------------------------------------------------------------------ */
  /*  REFLECT — news analysis quality self-improvement                   */
  /* ------------------------------------------------------------------ */

  router.get("/reflect/latest", async (c) => {
    const report = await getLatestReflectReport();
    if (!report) {
      return c.json({ error: "No REFLECT report available yet" }, 404);
    }
    return c.json(report);
  });

  router.post("/reflect/run", async (c) => {
    if (isReflectRunning()) {
      return c.json({ error: "REFLECT is already running" }, 429);
    }

    const body = await c.req
      .json<{ daysBack?: number }>()
      .catch(() => ({ daysBack: 7 }));
    const daysBack = body.daysBack ?? 7;

    log.info(`Manual REFLECT trigger — ${daysBack} days`);

    // Run async, return immediately
    triggerReflect(daysBack).catch((err) =>
      log.error("Manual REFLECT failed:", { error: String(err) }),
    );

    return c.json({ status: "started", daysBack });
  });

  // [claude-code 2026-04-06] Debug: check unscored items count
  router.get("/unscored-check", async (c) => {
    try {
      const { readUnscoredItems } =
        await import("../../services/supabase-service.js");
      const { isCentralScorerRunning, scoringCycle } =
        await import("../../services/riskflow/central-scorer.js");
      const items = await readUnscoredItems(5);
      return c.json({
        unscoredCount: items.length,
        scorerRunning: isCentralScorerRunning(),
        sampleIds: items.map((i) => i.tweet_id),
        sampleHeadlines: items.map((i) => (i.headline || "").slice(0, 60)),
      });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // Force score unscored items NOW
  router.post("/force-score", async (c) => {
    try {
      const { scoringCycle } =
        await import("../../services/riskflow/central-scorer.js");
      await scoringCycle();
      const { readUnscoredItems } =
        await import("../../services/supabase-service.js");
      const remaining = await readUnscoredItems(1);
      return c.json({ success: true, remainingUnscored: remaining.length });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // [claude-code 2026-04-12] Feed health endpoint for Harper monitoring hook
  // Extended with scorer status + unscored backlog count for pipeline visibility
  router.get("/feed-health", async (c) => {
    const health = getFeedHealth();
    const pollerRunning = isPollingActive();

    // Scorer status (lazy import to avoid circular deps)
    let scorerRunning = false;
    let unscoredCount = 0;
    try {
      const { isCentralScorerRunning } =
        await import("../../services/riskflow/central-scorer.js");
      const { readUnscoredItems } =
        await import("../../services/supabase-service.js");
      scorerRunning = isCentralScorerRunning();
      const sample = await readUnscoredItems(1);
      // Quick count: if sample returns 1, there's backlog. Exact count is expensive.
      unscoredCount = sample.length > 0 ? sample.length : 0;
      if (unscoredCount > 0) {
        // Get a rough count via raw SQL for the hook
        const { isDatabaseAvailable } =
          await import("../../config/database.js");
        const { sql: dbSql } = await import("../../config/database.js");
        if (isDatabaseAvailable() && dbSql) {
          const rows = await dbSql`
            SELECT COUNT(*) AS cnt FROM raw_riskflow_items r
            WHERE NOT EXISTS (SELECT 1 FROM scored_riskflow_items s WHERE s.tweet_id = r.tweet_id)
          `;
          unscoredCount = Number(rows[0]?.cnt ?? 0);
        }
      }
    } catch {
      // Non-fatal — scorer info is supplementary
    }

    const status =
      health.cacheSize === 0
        ? "empty"
        : !pollerRunning
          ? "poller_stopped"
          : !scorerRunning
            ? "scorer_stopped"
            : health.cacheAgeMs > 300_000
              ? "stale"
              : "healthy";
    return c.json({
      status,
      pollerRunning,
      scorerRunning,
      unscoredBacklog: unscoredCount,
      ...health,
      rettiwtPool: getPoolStatus(),
    });
  });

  // [claude-code 2026-04-17] Manual trigger for market impact enrichment — callable by Claude Code Routine
  router.post("/trigger-market-impact", async (c) => {
    try {
      const { runMarketImpactEnrichment } =
        await import("../../services/cron/market-impact-enricher.js");
      const result = await runMarketImpactEnrichment();
      return c.json({ success: true, ...result });
    } catch (err) {
      return c.json({ success: false, error: String(err) }, 500);
    }
  });

  // [claude-code 2026-04-24] S34-T4: per-source signal/noise + live drop
  // counters. v_source_signal_noise is the rolling 48h promotion funnel;
  // riskflow_drop_counters surfaces what got silently dropped and why.
  router.get("/source-quality", async (c) => {
    try {
      const { getSupabaseClient } = await import("../../config/supabase.js");
      const sb = getSupabaseClient();
      const liveSnapshot = getDropCounterSnapshot();
      if (!sb) {
        return c.json({
          window: "48h",
          sources: [],
          flushed_counters: [],
          live_counters: liveSnapshot,
          reason: "supabase_unconfigured",
        });
      }
      const sinceIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const [viewResult, countersResult] = await Promise.all([
        sb.from("v_source_signal_noise").select("*"),
        sb
          .from("riskflow_drop_counters")
          .select("source,stage,reason,count,window_end")
          .gte("window_end", sinceIso)
          .order("window_end", { ascending: false })
          .limit(500),
      ]);
      const sources = (viewResult.data ?? []) as Array<{
        source: string;
        ingested: number;
        scored_total: number;
        promoted: number;
        drop_rate: number;
        avg_score: number;
      }>;
      const counters = (countersResult.data ?? []) as Array<{
        source: string;
        stage: string;
        reason: string;
        count: number;
        window_end: string;
      }>;
      return c.json({
        window: "48h",
        counter_window: "2h",
        sources,
        flushed_counters: counters,
        live_counters: liveSnapshot,
        errors: {
          view: viewResult.error?.message ?? null,
          counters: countersResult.error?.message ?? null,
        },
      });
    } catch (err) {
      return c.json({ window: "48h", sources: [], error: String(err) }, 500);
    }
  });

  // [claude-code 2026-04-19] S27-T4: headline volume — per-source 48h sparkline.
  // Powers the HeadlineVolumeWidget on the diagnostics page; quantifies the
  // Rettiwt → browser-harness migration in riskflow_items source tags.
  router.get("/headline-volume", async (c) => {
    try {
      const { getSupabaseClient } = await import("../../config/supabase.js");
      const sb = getSupabaseClient();
      if (!sb) {
        return c.json({
          window: "48h",
          sources: [],
          reason: "supabase_unconfigured",
        });
      }
      const { data, error } = await sb
        .from("v_headline_volume_48h")
        .select("*");
      if (error) {
        return c.json(
          { window: "48h", sources: [], error: error.message },
          500,
        );
      }
      const { getQuotaSnapshot, getBreakerSnapshot, getPoolStats } =
        await import("../../services/browser/index.js");
      const [quotas, breaker, pool] = [
        await getQuotaSnapshot(),
        getBreakerSnapshot(),
        getPoolStats(),
      ];
      return c.json({
        window: "48h",
        sources: data ?? [],
        browser: { pool, quotas, breaker },
      });
    } catch (err) {
      return c.json({ window: "48h", sources: [], error: String(err) }, 500);
    }
  });

  return router;
}
