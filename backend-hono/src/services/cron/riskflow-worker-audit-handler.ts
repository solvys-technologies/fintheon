// [claude-code 2026-04-24] S35-T10: renamed from news-worker-audit-handler.ts. RiskFlow Worker
//   is the new name of the News Worker; audit semantics unchanged. Source-tag emissions
//   dual-emit "news-worker-audit" + "riskflow-worker-audit" through 2026-05-08.
// [claude-code 2026-04-19] S28: RiskFlow Worker Audit — the clock-based health gate TP requires
//   at 6:00am / 11:30am / 4:00pm ET. Three slices:
//     1. Heartbeat freshness  — breaking tier > 10min or standard > 15min = unhealthy
//     2. Pipeline health      — raw ingest + scored conversion in the last hour
//     3. Auto-heal            — soft (agentReachTick) then hard (stop/start poller) on stall
//   Escalates to superadmins via push when auto-heal doesn't recover or when human action is
//   required (e.g. a code-level fix is needed and a commit/deploy has to happen).

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { writeOpsEntry } from "../harper-autonomous/ops-store.js";
// [claude-code 2026-04-23] recordRun dropped — routines state-store retired; ops entry above is enough.
import { notifySuperadmins } from "../notifications/notify-superadmins.js";
import {
  agentReachTick,
  startAgentReachPoller,
  stopAgentReachPoller,
} from "../riskflow/agent-reach-poller.js";

const log = createLogger("RiskFlowWorkerAudit");

const BREAKING_STALE_MS = 10 * 60_000;
const STANDARD_STALE_MS = 15 * 60_000;
const INGEST_WINDOW_MS = 60 * 60_000;
const HEAL_SETTLE_MS = 60_000;

interface TierHeartbeat {
  tier: string;
  last_run_at: string | null;
  ageMs: number | null;
  items_ingested: number;
  errors: number;
  staleThresholdMs: number;
  stale: boolean;
}

interface PipelineCounts {
  rawLastHour: number;
  scoredLastHour: number;
  scoredRatio: number;
}

interface AuditSnapshot {
  tiers: TierHeartbeat[];
  pipeline: PipelineCounts;
  healActions: string[];
  finalStatus: "ok" | "warn" | "critical";
  reasons: string[];
}

function thresholdFor(tier: string): number {
  return tier === "breaking" ? BREAKING_STALE_MS : STANDARD_STALE_MS;
}

async function readHeartbeats(): Promise<TierHeartbeat[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("riskflow_worker_heartbeats")
    .select("tier, last_run_at, items_ingested, errors");
  if (error || !data) return [];
  const now = Date.now();
  return (
    data as Array<{
      tier: string;
      last_run_at: string | null;
      items_ingested: number;
      errors: number;
    }>
  ).map((row) => {
    const ageMs = row.last_run_at
      ? now - new Date(row.last_run_at).getTime()
      : null;
    const threshold = thresholdFor(row.tier);
    return {
      tier: row.tier,
      last_run_at: row.last_run_at,
      ageMs,
      items_ingested: Number(row.items_ingested ?? 0),
      errors: Number(row.errors ?? 0),
      staleThresholdMs: threshold,
      stale: ageMs === null || ageMs > threshold,
    };
  });
}

async function readPipelineCounts(): Promise<PipelineCounts> {
  const sb = getSupabaseClient();
  if (!sb) return { rawLastHour: 0, scoredLastHour: 0, scoredRatio: 0 };
  const since = new Date(Date.now() - INGEST_WINDOW_MS).toISOString();
  try {
    const [raw, scored] = await Promise.all([
      sb
        .from("raw_riskflow_items")
        .select("tweet_id", { count: "exact", head: true })
        .gte("created_at", since),
      sb
        .from("scored_riskflow_items")
        .select("tweet_id", { count: "exact", head: true })
        .gte("created_at", since),
    ]);
    const rawLastHour = raw.count ?? 0;
    const scoredLastHour = scored.count ?? 0;
    const scoredRatio =
      rawLastHour > 0
        ? scoredLastHour / rawLastHour
        : scoredLastHour > 0
          ? 1
          : 0;
    return { rawLastHour, scoredLastHour, scoredRatio };
  } catch (err) {
    log.warn("readPipelineCounts failed", { error: String(err) });
    return { rawLastHour: 0, scoredLastHour: 0, scoredRatio: 0 };
  }
}

async function softNudge(): Promise<boolean> {
  try {
    await agentReachTick();
    return true;
  } catch (err) {
    log.warn("Soft nudge failed", { error: String(err) });
    return false;
  }
}

function hardRestart(): boolean {
  try {
    stopAgentReachPoller();
    startAgentReachPoller();
    return true;
  } catch (err) {
    log.warn("Hard restart failed", { error: String(err) });
    return false;
  }
}

async function isMarketHours(): Promise<boolean> {
  // Rough ET check: Mon–Fri 9:30–16:00. We allow the audit to *warn* on low volume
  // outside market hours but not flag critical — news flow ebbs on nights + weekends.
  const now = new Date();
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hour12: false,
    minute: "numeric",
  }).formatToParts(now);
  const wd = etParts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(etParts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(etParts.find((p) => p.type === "minute")?.value ?? "0");
  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(wd);
  const time = hour * 60 + minute;
  return isWeekday && time >= 9 * 60 + 30 && time <= 16 * 60;
}

export interface AuditResult {
  auditName: string;
  triggerId: string;
  snapshot: AuditSnapshot;
}

/**
 * Run a single riskflow-worker audit cycle. Called by the cron scheduler at
 * 6:00am / 11:30am / 4:00pm ET and by the /api/routines/:id/rerun handler
 * when an operator manually fires an audit routine.
 */
export async function runRiskFlowWorkerAudit(opts: {
  auditName: string;
  triggerId: string;
}): Promise<AuditResult> {
  const startedAt = Date.now();
  const reasons: string[] = [];
  const healActions: string[] = [];

  let tiers = await readHeartbeats();
  const pipeline = await readPipelineCounts();
  const anyStale = tiers.some((t) => t.stale);
  const marketOpen = await isMarketHours();

  // Pipeline-level red flags
  if (marketOpen && pipeline.rawLastHour === 0) {
    reasons.push("zero-raw-ingest-market-hours");
  }
  if (pipeline.rawLastHour > 0 && pipeline.scoredRatio < 0.5) {
    reasons.push(
      `low-scoring-ratio: ${(pipeline.scoredRatio * 100).toFixed(0)}%`,
    );
  }

  // Tier stall → soft heal
  if (anyStale) {
    reasons.push(
      `stale-tiers: ${tiers
        .filter((t) => t.stale)
        .map((t) => t.tier)
        .join(",")}`,
    );
    const nudged = await softNudge();
    healActions.push(nudged ? "soft-nudge:ok" : "soft-nudge:failed");

    await new Promise((r) => setTimeout(r, HEAL_SETTLE_MS));
    tiers = await readHeartbeats();
  }

  // Still stale after soft nudge → hard restart
  if (tiers.some((t) => t.stale)) {
    const restarted = hardRestart();
    healActions.push(restarted ? "hard-restart:ok" : "hard-restart:failed");
    await new Promise((r) => setTimeout(r, HEAL_SETTLE_MS));
    tiers = await readHeartbeats();
  }

  const stillStale = tiers.some((t) => t.stale);
  const finalStatus: AuditSnapshot["finalStatus"] = stillStale
    ? "critical"
    : reasons.length > 0
      ? "warn"
      : "ok";

  const snapshot: AuditSnapshot = {
    tiers,
    pipeline,
    healActions,
    finalStatus,
    reasons,
  };

  const elapsedMs = Date.now() - startedAt;
  log.info(`${opts.auditName} audit complete`, {
    finalStatus,
    reasons,
    healActions,
    elapsedMs,
  });

  // Ops-feed breadcrumb — always write, even on OK status, so operators see the cadence.
  const opsEntry = await writeOpsEntry({
    actionType: "routine",
    title: `RiskFlow worker audit: ${opts.auditName}`,
    detail: formatOpsDetail(snapshot),
    severity:
      finalStatus === "critical"
        ? "critical"
        : finalStatus === "warn"
          ? "warning"
          : "info",
    metadata: {
      routineId: opts.triggerId,
      routineName: opts.auditName,
      // [S35-T10] dual-emit source tag through 2026-05-08; legacy "news-worker-audit"
      //   stays for any Harper-Ops filters still keyed on the old name.
      source: "riskflow-worker-audit",
      legacy_source: "news-worker-audit",
      finalStatus,
      reasons,
      healActions,
      tiers,
      pipeline,
      elapsedMs,
    },
  }).catch((err) => {
    log.warn("writeOpsEntry failed", { error: String(err) });
    return null;
  });

  // [claude-code 2026-04-23] recordRun removed with the Routines Console; ops entry above
  //   is the durable trail. Escalate to superadmins when auto-heal didn't recover.
  if (finalStatus === "critical") {
    // [S35-T10] dual-emit: send both the new "riskflow-worker-audit:" and legacy
    //   "news-worker-audit:" source tag through 2026-05-08 so Harper-Ops filters
    //   keyed on either name keep paging.
    const baseAlert = {
      title: `RiskFlow feed unhealthy — ${opts.auditName}`,
      body: `Tiers still stale after heal attempts: ${
        tiers
          .filter((t) => t.stale)
          .map((t) => t.tier)
          .join(", ") || "unknown"
      }. Heal: ${healActions.join(" → ") || "none"}.`,
      severity: "critical" as const,
      url: "/admin/monitor",
    };
    await notifySuperadmins({
      ...baseAlert,
      source: `riskflow-worker-audit:${opts.triggerId}`,
    }).catch((err) =>
      log.warn("notifySuperadmins failed", { error: String(err) }),
    );
    await notifySuperadmins({
      ...baseAlert,
      source: `news-worker-audit:${opts.triggerId}`,
    }).catch((err) =>
      log.warn("notifySuperadmins legacy failed", { error: String(err) }),
    );
  }

  return { auditName: opts.auditName, triggerId: opts.triggerId, snapshot };
}

function formatOpsDetail(snap: AuditSnapshot): string {
  const tierLines = snap.tiers.map(
    (t) =>
      `${t.tier}: ${t.ageMs === null ? "never" : `${Math.round(t.ageMs / 1000)}s`}${t.stale ? " [STALE]" : ""} · ${t.items_ingested} items · ${t.errors} errs`,
  );
  const pipelineLine = `raw/h=${snap.pipeline.rawLastHour} · scored/h=${snap.pipeline.scoredLastHour} · ratio=${(snap.pipeline.scoredRatio * 100).toFixed(0)}%`;
  const healLine =
    snap.healActions.length > 0
      ? `heal: ${snap.healActions.join(" → ")}`
      : "heal: (none needed)";
  return [...tierLines, pipelineLine, healLine].join("\n");
}
