// [claude-code 2026-05-03] S58-T1: DeepSeek primary AI diagnostics.
// [claude-code 2026-04-29] S53-T1: riskflow_runtime section on GET / —
//   pipelines enabled/disabled, source accounts by category, econ populator/
//   scheduler health, drop-counter snapshot, feed poller, headlines_24h.
//   Canonical control-plane payload for Refinement Engine (T2).
// [claude-code 2026-04-24] S34-T4: GET /source-quality — merges v_source_signal_noise
//   with in-memory drop-counter snapshot + recent riskflow_drop_counters rows.
//   The "items_ingested: 0, errors: 0" silent-drop pattern now has a trace.
// [claude-code 2026-04-23] S32-T7: surface autopilot guardian status on GET /.
// [claude-code 2026-03-20] Diagnostics endpoint — service status, missing env vars, suggested fixes
// [claude-code 2026-03-22] Add POST /hermes/restart for frontend-triggered Hermes re-initialization
// [claude-code 2026-04-19] S27-T6/T7 (W2d): surface cache_hit_rate_24h (browser operator) and
//   news_worker_age_seconds (news worker heartbeat) on GET /.
// [claude-code 2026-04-24] S34-T10: surface econ_backfill aggregate on GET /.

import { Hono } from "hono";
import { pingDb } from "../../db/optimized.js";
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
import {
  getLastVixAttempts,
  getRouterHealthSnapshot,
  type RouterAttempt,
} from "../../services/market-data/router.js";
import {
  getAccounts,
  getAccountHandles,
  getWireHandles,
  getMacroHandles,
} from "../../services/source-accounts/source-accounts-service.js";
import { getEconPopulatorStatus } from "../../services/cron/econ-calendar-populator.js";
import {
  getLastEconKeywordResult,
  isEconKeywordSchedulerActive,
} from "../../services/cron/econ-keyword-scheduler.js";
import {
  getCurrentSnapshot as getDropCounterSnapshot,
  isDropCounterFlushRunning,
} from "../../services/riskflow/drop-counters.js";
import { getPipelineStateSnapshot } from "../../services/riskflow/pipeline-gate.js";
import { getDeskCalendarDiagnostics } from "../desk-calendar/handlers.js";
import { getSttProviderDiagnostics } from "../../services/voice-stt-provider.js";
import { getTranscriptStats24h } from "../../services/commentary-transcript.js";
import { checkDeepSeekDirectHealth } from "../../services/strands/provider.js";

const log = createLogger("Diagnostics");

type ServiceStatus = "ok" | "error" | "degraded" | "unavailable" | "unknown";

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
  desk_calendar?: {
    queue_count: number | null;
    last_ingest_at: string | null;
    latest_error: string | null;
  };
  source_accounts?: {
    total: number;
    active: number;
    handles: string[];
    cache_last_refresh: string | null;
  };
  market_data_router?: {
    vix_attempts: RouterAttempt[];
    vix_last_source: string | null;
    vix_last_success: boolean;
    vix_last_latency_ms: number | null;
    recent_symbols: string[];
    recent_quote_attempts: Array<{ symbol: string; attempts: RouterAttempt[] }>;
  };
  riskflow_sources?: {
    window: string;
    sources: Array<{
      source: string;
      ingested: number;
      scored_total: number;
      promoted: number;
      drop_rate: number;
      avg_score: number;
    }>;
  };
  voice_stt?: {
    provider: string;
    model: string;
    available: boolean;
    reason?: string;
    sidecar_enabled: boolean;
    voice_sidecar_disabled: boolean;
    vibevoice_configured: boolean;
    openai_configured: boolean;
  };
  commentary_transcripts?: {
    count_24h: number;
    last_capture_at: string | null;
    last_failure: string | null;
  };
  riskflow_runtime?: {
    pipelines: Record<string, boolean>;
    source_accounts_by_category: Record<string, number>;
    econ_populator: {
      running: boolean;
      last_result: {
        fetched: number;
        upserted: number;
        actualsBridged: number;
        skippedCountry: number;
        skippedDate: number;
        skippedFilter: number;
      } | null;
    };
    econ_keyword_scheduler: {
      running: boolean;
      last_result: { scanned: number; promoted: number } | null;
    };
    drop_counters: {
      flush_running: boolean;
      snapshot: {
        window_start: string;
        window_end: string;
        total_dropped: number;
        counter_count: number;
      };
    };
    feed_poller_running: boolean;
    headlines_24h: number;
  };
}

async function getNewsWorkerSnapshot(): Promise<
  DiagnosticsResponse["news_worker"]
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
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      name: "Hermes AI (DeepSeek primary)",
      status: "error",
      detail: "DEEPSEEK_API_KEY not set",
      fix: "Add DEEPSEEK_API_KEY to backend-hono/.env or store a user key in Settings",
    };
  }

  try {
    const start = Date.now();
    const health = await checkDeepSeekDirectHealth();
    const latency = Date.now() - start;

    if (health.available) {
      return {
        name: "Hermes AI (DeepSeek primary)",
        status: "ok",
        detail: `deepseek-reasoner primary — ${latency}ms response`,
      };
    }
    return {
      name: "Hermes AI (DeepSeek primary)",
      status: "degraded",
      detail: `${health.error ?? "unreachable"} — ${latency}ms`,
      fix: "Check DeepSeek API key validity and api.deepseek.com reachability",
    };
  } catch (err) {
    return {
      name: "Hermes AI (DeepSeek primary)",
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
      fix: "Check network connectivity to api.deepseek.com",
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

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m ago`;
}

function checkTradingViewEconCalendar(
  diag: DiagnosticsResponse["desk_calendar"],
): ServiceDiagnostic {
  if (!diag || diag.queue_count == null) {
    return {
      name: "TradingView Econ Calendar",
      status: "unknown",
      detail: "Calendar diagnostics unavailable",
    };
  }
  if (diag.latest_error) {
    return {
      name: "TradingView Econ Calendar",
      status: "degraded",
      detail: diag.latest_error,
    };
  }
  if (diag.queue_count <= 0) {
    return {
      name: "TradingView Econ Calendar",
      status: "degraded",
      detail: "No TradingView calendar events queued",
    };
  }
  if (!diag.last_ingest_at) {
    return {
      name: "TradingView Econ Calendar",
      status: "ok",
      detail: `${diag.queue_count} upcoming events queued`,
    };
  }
  const ageMs = Date.now() - new Date(diag.last_ingest_at).getTime();
  if (ageMs > 36 * 3_600_000) {
    return {
      name: "TradingView Econ Calendar",
      status: "degraded",
      detail: `${diag.queue_count} queued; last ingest ${formatAge(diag.last_ingest_at)}`,
    };
  }
  return {
    name: "TradingView Econ Calendar",
    status: "ok",
    detail: `${diag.queue_count} queued; last ingest ${formatAge(diag.last_ingest_at)}`,
  };
}

function checkTradingViewQuotes(routerHealth: {
  vix_attempts: RouterAttempt[];
  recent_quote_attempts: Array<{ symbol: string; attempts: RouterAttempt[] }>;
}): ServiceDiagnostic {
  const attempts = [
    ...routerHealth.recent_quote_attempts.flatMap((row) => row.attempts),
    ...routerHealth.vix_attempts,
  ].filter((attempt) => attempt.source === "tradingview");
  const latest = attempts[attempts.length - 1];

  if (!latest) {
    return {
      name: "TradingView Quotes",
      status: "unknown",
      detail: "No TradingView quote checks recorded yet",
    };
  }
  if (!latest.success) {
    return {
      name: "TradingView Quotes",
      status: "degraded",
      detail: latest.error
        ? `TradingView scanner failed: ${latest.error}`
        : "TradingView scanner returned no quote data",
    };
  }
  return {
    name: "TradingView Quotes",
    status: "ok",
    detail: `TradingView scanner quote healthy (${latest.latencyMs}ms)`,
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
/*  Source-account diagnostics                                          */
/* ------------------------------------------------------------------ */

async function loadSourceAccountDiagnostics(): Promise<
  DiagnosticsResponse["source_accounts"]
> {
  try {
    const accounts = await getAccounts();
    const active = accounts.filter((a) => a.active);
    const handles = await getAccountHandles();
    return {
      total: accounts.length,
      active: active.length,
      handles,
      cache_last_refresh: new Date().toISOString(),
    };
  } catch (err) {
    log.warn("source-account diagnostics failed", { error: String(err) });
    return { total: 0, active: 0, handles: [], cache_last_refresh: null };
  }
}

/* ------------------------------------------------------------------ */
/*  RiskFlow source stats                                               */
/* ------------------------------------------------------------------ */

async function loadRiskFlowSourceStats(): Promise<
  DiagnosticsResponse["riskflow_sources"]
> {
  try {
    const { getSupabaseClient } = await import("../../config/supabase.js");
    const sb = getSupabaseClient();
    if (!sb) return { window: "48h", sources: [] };
    const { data, error } = await sb.from("v_source_signal_noise").select("*");
    if (error) {
      log.warn("riskflow source stats failed", { error: error.message });
      return { window: "48h", sources: [] };
    }
    return {
      window: "48h",
      sources: (data ?? []) as Array<{
        source: string;
        ingested: number;
        scored_total: number;
        promoted: number;
        drop_rate: number;
        avg_score: number;
      }>,
    };
  } catch (err) {
    log.warn("riskflow source stats failed", { error: String(err) });
    return { window: "48h", sources: [] };
  }
}

/* ------------------------------------------------------------------ */
/*  RiskFlow Runtime — canonical control-plane status payload          */
/* ------------------------------------------------------------------ */

async function loadRiskFlowRuntime(): Promise<
  DiagnosticsResponse["riskflow_runtime"]
> {
  try {
    const pipelineSnapshot = getPipelineStateSnapshot();
    const populatorStatus = getEconPopulatorStatus();
    const keywordResult = getLastEconKeywordResult();
    const keywordRunning = isEconKeywordSchedulerActive();
    const dropSnapshot = getDropCounterSnapshot();
    const dropFlushRunning = isDropCounterFlushRunning();
    const feedPollerRunning = isPollingActive();

    const accounts = await getAccounts();
    const byCategory: Record<string, number> = {};
    for (const a of accounts) {
      if (!a.active) continue;
      byCategory[a.category] = (byCategory[a.category] || 0) + 1;
    }

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

    return {
      pipelines: pipelineSnapshot,
      source_accounts_by_category: byCategory,
      econ_populator: {
        running: populatorStatus.running,
        last_result: populatorStatus.lastResult,
      },
      econ_keyword_scheduler: {
        running: keywordRunning,
        last_result: keywordResult,
      },
      drop_counters: {
        flush_running: dropFlushRunning,
        snapshot: {
          window_start: dropSnapshot.window_start,
          window_end: dropSnapshot.window_end,
          total_dropped: dropSnapshot.total_dropped,
          counter_count: dropSnapshot.counters.length,
        },
      },
      feed_poller_running: feedPollerRunning,
      headlines_24h: headlines24h,
    };
  } catch (err) {
    log.warn("loadRiskFlowRuntime failed", { error: String(err) });
    return {
      pipelines: {},
      source_accounts_by_category: {},
      econ_populator: { running: false, last_result: null },
      econ_keyword_scheduler: { running: false, last_result: null },
      drop_counters: {
        flush_running: false,
        snapshot: {
          window_start: "",
          window_end: "",
          total_dropped: 0,
          counter_count: 0,
        },
      },
      feed_poller_running: false,
      headlines_24h: 0,
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

    const [
      coreServices,
      browserStats,
      newsWorker,
      econBackfill,
      sourceAccounts,
      riskflowSources,
      transcriptStats,
    ] = await Promise.all([
      Promise.all([
        checkHermesAI(),
        checkDatabase(),
        Promise.resolve(checkRettiwt()),
        Promise.resolve(checkSupabaseAuth()),
      ]),
      getBrowseTaskStats24h(),
      getNewsWorkerSnapshot(),
      getEconBackfillDiagnostics().catch(() => null),
      loadSourceAccountDiagnostics(),
      loadRiskFlowSourceStats(),
      getTranscriptStats24h().catch(() => ({
        count: 0,
        lastCaptureAt: null,
        lastFailure: null,
      })),
    ]);

    const missingEnvVars = auditEnvVars();

    const [routing, gepa, riskflowRuntime] = await Promise.all([
      loadRoutingSnapshot(),
      loadGepaSnapshot(),
      loadRiskFlowRuntime(),
    ]);

    // [claude-code 2026-04-28] S47-T2: desk calendar diagnostics
    let deskCalendarDiag: DiagnosticsResponse["desk_calendar"] = {
      queue_count: null,
      last_ingest_at: null,
      latest_error: null,
    };
    try {
      const { getSupabaseClient } = await import("../../config/supabase.js");
      const sb = getSupabaseClient();
      if (sb) {
        const now = new Date().toISOString();
        const horizon = new Date(Date.now() + 14 * 86_400_000).toISOString();
        const { count } = await sb
          .from("desk_calendar_events")
          .select("id", { count: "exact", head: true })
          .gte("starts_at", now)
          .lt("starts_at", horizon);
        const { data: latest } = await sb
          .from("desk_calendar_events")
          .select("ingested_at")
          .order("ingested_at", { ascending: false })
          .limit(1);
        deskCalendarDiag = {
          queue_count: count ?? 0,
          last_ingest_at: latest?.[0]?.ingested_at ?? null,
          latest_error: getDeskCalendarDiagnostics().last_ingest_error,
        };
      }
    } catch {
      // Non-fatal
    }

    // Market-data router health
    const vixAttempts = getLastVixAttempts();
    const vixAttempt = vixAttempts[vixAttempts.length - 1];
    const routerHealth = getRouterHealthSnapshot();
    const services = [
      ...coreServices,
      checkTradingViewEconCalendar(deskCalendarDiag),
      checkTradingViewQuotes(routerHealth),
    ];
    const hasError = services.some((s) => s.status === "error");
    const hasDegraded = services.some((s) => s.status === "degraded");
    const overall: ServiceStatus = hasError
      ? "error"
      : hasDegraded
        ? "degraded"
        : "ok";

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
      news_worker: newsWorker,
      econ_backfill: econBackfill ?? undefined,
      desk_calendar: deskCalendarDiag,
      source_accounts: sourceAccounts,
      market_data_router: {
        vix_attempts: vixAttempts,
        vix_last_source: vixAttempt?.source ?? null,
        vix_last_success: vixAttempt?.success ?? false,
        vix_last_latency_ms: vixAttempt?.latencyMs ?? null,
        recent_symbols: routerHealth.recent_symbols,
        recent_quote_attempts: routerHealth.recent_quote_attempts,
      },
      riskflow_sources: riskflowSources,
      voice_stt: (() => {
        const d = getSttProviderDiagnostics();
        return {
          provider: d.provider,
          model: d.model,
          available: d.available,
          reason: d.reason,
          sidecar_enabled: process.env.HERMES_SIDECAR_ENABLED === "true",
          voice_sidecar_disabled: process.env.VOICE_SIDECAR_DISABLED === "true",
          vibevoice_configured: Boolean(process.env.VIBEVOICE_ASR_URL),
          openai_configured: Boolean(process.env.OPENAI_API_KEY),
        };
      })(),
      commentary_transcripts: {
        count_24h: transcriptStats.count,
        last_capture_at: transcriptStats.lastCaptureAt,
        last_failure: transcriptStats.lastFailure,
      },
      riskflow_runtime: riskflowRuntime,
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
