// [claude-code 2026-04-24] S35-T1: Arbitrum verdict persistence + getLatestChamberRead
// helper for T11 (PMDB Chamber Read injection).
//
// Schema reference: supabase/migrations/<ts>_arbitrum_verdicts.sql (T2).
// Uses service_role Supabase client — RLS bypassed by design on writes; clients
// read via the authenticated "authenticated_read_arbitrum_verdicts" policy.

import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";
import type { ArbitrumTriggerType, ArbitrumVerdict } from "./types.js";

const log = createLogger("ArbitrumVerdictStore");

const TABLE = "arbitrum_verdicts";

function toRow(v: ArbitrumVerdict): Record<string, unknown> {
  return {
    verdict_id: v.verdict_id,
    created_at: v.created_at,
    trigger_type: v.trigger_type,
    question: v.question,
    category: v.category,
    seats: v.seats,
    consensus_probability: v.consensus_probability,
    confidence: v.confidence,
    dissent: v.dissent,
    gates_surfaced: v.gates_surfaced,
    digest_text: v.digest_text,
    iv_simulation: v.iv_simulation,
    trigger_source: v.trigger_source,
    latency_ms: v.latency_ms ?? null,
    model_cost_usd: v.model_cost_usd ?? null,
  };
}

function fromRow(row: Record<string, unknown>): ArbitrumVerdict {
  return {
    verdict_id: String(row.verdict_id),
    created_at: String(row.created_at),
    trigger_type: row.trigger_type as ArbitrumTriggerType,
    question: String(row.question),
    category: String(row.category),
    seats: (row.seats as ArbitrumVerdict["seats"]) ?? [],
    consensus_probability: Number(row.consensus_probability ?? 0),
    confidence: Number(row.confidence ?? 0),
    dissent: (row.dissent as ArbitrumVerdict["dissent"]) ?? null,
    gates_surfaced:
      (row.gates_surfaced as ArbitrumVerdict["gates_surfaced"]) ?? {
        consensus_spread_pp: 0,
        category_quality: 0,
        calibration_watermark: 0,
      },
    digest_text: String(row.digest_text ?? ""),
    iv_simulation:
      (row.iv_simulation as ArbitrumVerdict["iv_simulation"]) ?? null,
    trigger_source:
      (row.trigger_source as ArbitrumVerdict["trigger_source"]) ?? null,
    latency_ms:
      row.latency_ms === null || row.latency_ms === undefined
        ? undefined
        : Number(row.latency_ms),
    model_cost_usd:
      row.model_cost_usd === null || row.model_cost_usd === undefined
        ? undefined
        : Number(row.model_cost_usd),
  };
}

export async function saveVerdict(v: ArbitrumVerdict): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) {
    log.warn("Supabase not configured — verdict not persisted", {
      verdict_id: v.verdict_id,
    });
    return false;
  }
  const { error } = await sb.from(TABLE).upsert(toRow(v), {
    onConflict: "verdict_id",
  });
  if (error) {
    log.error("saveVerdict failed", {
      verdict_id: v.verdict_id,
      error: error.message,
    });
    return false;
  }
  return true;
}

export async function getVerdict(id: string): Promise<ArbitrumVerdict | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("verdict_id", id)
    .maybeSingle();
  if (error) {
    log.error("getVerdict failed", { id, error: error.message });
    return null;
  }
  if (!data) return null;
  return fromRow(data as Record<string, unknown>);
}

export async function getLatestByTrigger(
  trigger_type: ArbitrumTriggerType,
): Promise<ArbitrumVerdict | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("trigger_type", trigger_type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    log.error("getLatestByTrigger failed", {
      trigger_type,
      error: error.message,
    });
    return null;
  }
  if (!data) return null;
  return fromRow(data as Record<string, unknown>);
}

export async function getLatest(): Promise<ArbitrumVerdict | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    log.error("getLatest failed", { error: error.message });
    return null;
  }
  if (!data) return null;
  return fromRow(data as Record<string, unknown>);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  const asUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
  return asUtc - date.getTime();
}

function getNewYorkNoonIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "1";
  const localNoonAsUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    12,
    0,
    0,
  );
  const offsetMs = getTimeZoneOffsetMs(
    new Date(localNoonAsUtc),
    "America/New_York",
  );
  return new Date(localNoonAsUtc - offsetMs).toISOString();
}

/**
 * Helper consumed by T11 (PMDB Chamber Read injection). Returns the
 * digest_text of the latest `session`-triggered verdict from the current
 * trading day (since 12:00 ET), or null if none exist. Must stay a cheap
 * read — brief-generator.ts calls it on every PMDB run.
 *
 * [claude-code 2026-04-28] S47-T2: narrowed from "latest of all time" to
 * "latest within the intended day/session window" so PMDB never injects
 * a stale prior-day Chamber Read.
 */
export async function getLatestChamberRead(): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  // Session window: today since 12:00 ET (covers the 17:00 ET session).
  const sessionWindowStart = getNewYorkNoonIso();
  const { data, error } = await sb
    .from(TABLE)
    .select("digest_text, created_at")
    .eq("trigger_type", "session")
    .gte("created_at", sessionWindowStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    log.error("getLatestChamberRead failed", { error: error.message });
    return null;
  }
  return data?.digest_text ?? null;
}

/**
 * Diagnostic helper comparing latest PMDB and latest Arbitrum session
 * verdict timestamps. Returns nulls when either side is missing.
 */
export async function getChamberReadFreshness(): Promise<{
  latest_pmdb_at: string | null;
  latest_session_verdict_at: string | null;
  gap_minutes: number | null;
}> {
  const sb = getSupabaseClient();
  if (!sb) {
    return {
      latest_pmdb_at: null,
      latest_session_verdict_at: null,
      gap_minutes: null,
    };
  }
  const [{ data: pmdb }, { data: verdict }] = await Promise.all([
    sb
      .from("briefs")
      .select("created_at")
      .eq("brief_type", "PMDB")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from(TABLE)
      .select("created_at")
      .eq("trigger_type", "session")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const latest_pmdb_at = (pmdb?.created_at as string) ?? null;
  const latest_session_verdict_at = (verdict?.created_at as string) ?? null;
  let gap_minutes: number | null = null;
  if (latest_pmdb_at && latest_session_verdict_at) {
    gap_minutes = Math.round(
      (new Date(latest_pmdb_at).getTime() -
        new Date(latest_session_verdict_at).getTime()) /
        60_000,
    );
  }
  return { latest_pmdb_at, latest_session_verdict_at, gap_minutes };
}
