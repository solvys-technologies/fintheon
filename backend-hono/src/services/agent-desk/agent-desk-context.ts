// [claude-code 2026-04-16] S20-T2: Added fetchFilteredHeadlines() for per-agent subject-tag filtering
// [claude-code 2026-03-28] S4-T2: Widened RiskFlow select to include full scored metadata
// [claude-code 2026-03-27] S4: Added econPrintHistory to context for AgentDesk aggregation
// [claude-code 2026-03-27] S2-T4: Added addCalibrationContext for calibration upload pipeline
// [claude-code 2026-03-24] Widened RiskFlow window to 72h/40 with configurable params
// [claude-code 2026-03-23] AgentDesk context assembly — fetches VIX, FRED, RiskFlow in parallel
import type {
  SanctumPreset,
  SimulationContext,
  RiskFlowHeadline,
  EconPrintStat,
  UpcomingEconEvent,
} from "./agent-desk-types.js";
import {
  fetchFredIndicators,
  getCachedFredIndicators,
  getFredFetchedAt,
} from "../systemic/fred-service.js";
import { fetchVIX } from "../market-data/router.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { readEconEvents, readRecentEconPrintStats } from "../supabase-service.js";

/**
 * Assemble a SimulationContext bundle by fetching live data from all available sources.
 * Uses Promise.allSettled so one failure doesn't block others.
 * Preset controls which sources are fetched.
 */
export async function assembleSimulationContext(
  preset: SanctumPreset = "full-brief",
): Promise<SimulationContext> {
  const fetchVix = preset !== "econ-watch";
  const fetchFred = preset !== "risk-scan";
  const fetchRiskFlow = preset === "full-brief" || preset === "risk-scan";
  const fetchEconHistory = preset === "full-brief" || preset === "econ-watch";
  const fetchUpcomingEcon = preset === "full-brief" || preset === "econ-watch";

  const [vixResult, fredResult, riskflowResult, econResult, upcomingResult] =
    await Promise.allSettled([
      fetchVix ? fetchVIX().then((r) => r.vix.value) : Promise.resolve(null),
      fetchFred
        ? fetchFredIndicators()
        : Promise.resolve(getCachedFredIndicators()),
      fetchRiskFlow ? fetchRiskFlowHeadlines() : Promise.resolve([]),
      fetchEconHistory ? fetchEconPrintHistory() : Promise.resolve([]),
      fetchUpcomingEcon ? fetchUpcomingEconEvents() : Promise.resolve([]),
    ]);

  const vixLevel = vixResult.status === "fulfilled" ? vixResult.value : null;
  const fredIndicators =
    fredResult.status === "fulfilled"
      ? (fredResult.value as Record<string, number>)
      : getCachedFredIndicators();
  const riskflowHeadlines =
    riskflowResult.status === "fulfilled" ? riskflowResult.value : [];
  const econPrintHistory =
    econResult.status === "fulfilled" ? econResult.value : [];
  const upcomingEconEvents =
    upcomingResult.status === "fulfilled" ? upcomingResult.value : [];

  return {
    vixLevel,
    fredIndicators,
    riskflowHeadlines,
    econPrintHistory:
      econPrintHistory.length > 0 ? econPrintHistory : undefined,
    upcomingEconEvents:
      upcomingEconEvents.length > 0 ? upcomingEconEvents : undefined,
    fredFetchedAt: getFredFetchedAt()?.toISOString() ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchUpcomingEconEvents(): Promise<UpcomingEconEvent[]> {
  const today = todayInNewYork();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);
  const to = formatDateInNewYork(horizon);
  const events = await readEconEvents({ from: today.dateIso, to });
  return events
    .filter((event) => isUpcomingOrMultiDayEvent(event, today))
    .sort((a, b) => {
      const aKey = `${a.date ?? ""}T${a.time ?? "23:59"}`;
      const bKey = `${b.date ?? ""}T${b.time ?? "23:59"}`;
      return aKey.localeCompare(bKey);
    })
    .slice(0, 12)
    .map((event) => ({
      eventName: event.name ?? "Untitled event",
      date: event.date ?? today.dateIso,
      time: event.time ?? null,
      country: event.country ?? null,
      category: event.category ?? null,
      impact: event.impact ?? null,
      forecast: event.forecast ?? null,
      previous: event.previous ?? null,
    }));
}

function isUpcomingOrMultiDayEvent(
  event: Awaited<ReturnType<typeof readEconEvents>>[number],
  now: { dateIso: string; minutes: number },
): boolean {
  if (!event.date) return false;
  if (event.date > now.dateIso) return true;
  if (event.date < now.dateIso) return isMultiDayEvent(event);
  if (!event.time) return true;
  const minutes = minutesFromHHMM(event.time);
  if (minutes == null) return false;
  return minutes >= now.minutes - 15 || isMultiDayEvent(event);
}

function isMultiDayEvent(event: {
  name?: string | null;
  category?: string | null;
}): boolean {
  const text = `${event.name ?? ""} ${event.category ?? ""}`.toLowerCase();
  return /\b(jackson hole|summit|symposium|forum|conference|meetings?)\b/.test(
    text,
  );
}

function todayInNewYork(): { dateIso: string; minutes: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return {
    dateIso: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour ?? "0") * 60 + Number(parts.minute ?? "0"),
  };
}

function formatDateInNewYork(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function minutesFromHHMM(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Fetch recent econ print history (7 days) and transform for AgentDesk consumption.
 * Aggregates beat/miss/inline patterns for simulation context.
 */
async function fetchEconPrintHistory(): Promise<EconPrintStat[]> {
  const prints = await readRecentEconPrintStats(168); // 7 days
  return prints.map((p) => {
    const actual = p.actual_value != null ? parseFloat(p.actual_value) : null;
    const forecast =
      p.forecast_value != null ? parseFloat(p.forecast_value) : null;
    const previous =
      p.previous_value != null ? parseFloat(p.previous_value) : null;
    let surprise: number | null = null;
    let direction: "beat" | "miss" | "inline" | null = null;

    if (actual != null && forecast != null && forecast !== 0) {
      surprise = ((actual - forecast) / Math.abs(forecast)) * 100;
      direction =
        Math.abs(surprise) < 2 ? "inline" : surprise > 0 ? "beat" : "miss";
    }

    return {
      eventName: p.headline.split("|")[0].trim(),
      actual,
      forecast,
      previous,
      surprise: surprise != null ? Math.round(surprise * 100) / 100 : null,
      direction,
      ivScore: p.iv_score ?? null,
      printedAt: p.printed_at ?? null,
    };
  });
}

// [claude-code 2026-03-31] Added narrative_card_links join so Consilium/Sanctum receives thread assignments
/**
 * Fetch scored RiskFlow headlines from Supabase — configurable window (default 72h, limit 40).
 * Enriches items with narrative thread assignments from narrative_card_links.
 */
async function fetchRiskFlowHeadlines(
  sinceHours = 72,
  limit = 40,
): Promise<RiskFlowHeadline[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const cutoff = new Date(
    Date.now() - sinceHours * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await sb
    .from("scored_riskflow_items")
    .select(
      "id, tweet_id, headline, summary, macro_level, sentiment, iv_score, category, created_at, sub_scores, econ_data, risk_type, agent_note, price_brain_score",
    )
    .gte("created_at", cutoff)
    .gte("macro_level", 2)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[AgentDesk Context] RiskFlow fetch failed:", error.message);
    return [];
  }

  const items = (data ?? []) as (RiskFlowHeadline & { tweet_id?: string })[];

  // Enrich with narrative thread assignments so Consilium/Sanctum can group by thread
  if (items.length > 0) {
    const itemIds = items.map((i) => i.tweet_id || i.id).filter(Boolean);
    const { data: links } = await sb
      .from("narrative_card_links")
      .select("card_id, thread_slug")
      .in("card_id", itemIds);

    if (links && links.length > 0) {
      const threadMap = new Map<string, string[]>();
      for (const link of links) {
        const arr = threadMap.get(link.card_id) ?? [];
        arr.push(link.thread_slug);
        threadMap.set(link.card_id, arr);
      }
      for (const item of items) {
        item.narrative_threads = threadMap.get(item.tweet_id || item.id) ?? [];
      }
    }
  }

  return items;
}

// ─── Per-Agent Subject-Filtered Headlines ──────────────────────────────────
// Ported from agent-desk-client.ts:687-756 — each DAG agent gets headlines
// filtered by its subjects array: 12 subject-matched + 3 high-impact cross-domain.

export interface FilteredHeadline {
  tier: "CRITICAL" | "HIGH" | "MED" | "LOW";
  headline: string;
  sentiment: string | null;
  source: "db";
}

/**
 * Fetch headlines from scored_riskflow_items filtered by agent's subject tags.
 * Returns formatted headline strings ready for prompt injection.
 *
 * [claude-code 2026-04-27] v5.33.2: Exa fallback STRIPPED (TP "turn off Exa
 * completely"). DB miss = empty list; agent runs without augmentation.
 */
export async function fetchFilteredHeadlines(
  subjects: string[],
  _agentName: string,
): Promise<string[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("scored_riskflow_items")
    .select(
      "headline, body, tags, created_at, macro_level, iv_score, sentiment",
    )
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data?.length) return [];

  const subjectSet = new Set(subjects);
  const matching: typeof data = [];
  const nonMatching: typeof data = [];

  for (const row of data) {
    const tags: string[] = row.tags || [];
    const hasSubjectMatch = tags.some(
      (t) => t.startsWith("subj:") && subjectSet.has(t.slice(5)),
    );
    if (hasSubjectMatch) {
      matching.push(row);
    } else {
      nonMatching.push(row);
    }
  }

  const primary = matching.slice(0, 12);
  const crossDomain = nonMatching
    .filter((r) => (r.macro_level ?? 0) >= 3)
    .slice(0, 3);

  return [...primary, ...crossDomain].map((row) => {
    const level = row.macro_level ?? 1;
    const tier =
      level >= 4
        ? "CRITICAL"
        : level >= 3
          ? "HIGH"
          : level >= 2
            ? "MED"
            : "LOW";
    const sent = row.sentiment ? ` (${row.sentiment})` : "";
    return `[${tier}] ${row.headline}${sent}`;
  });
}

// ─── Calibration Upload Context ─────────────────────────────────

interface CalibrationContextEntry {
  source: "calibration_upload";
  items: Array<{ headline: string; eventType: string; symbols: string[] }>;
  uploadedAt: string;
}

let calibrationContext: CalibrationContextEntry | null = null;

/**
 * Stores parsed calibration items in AgentDesk's running context so they influence analysis.
 * Called by the Upload Context pipeline after bulk-ingest.
 */
export function addCalibrationContext(
  items: Array<{ headline: string; eventType: string; symbols: string[] }>,
): void {
  calibrationContext = {
    source: "calibration_upload",
    items,
    uploadedAt: new Date().toISOString(),
  };
  console.log(
    `[AgentDesk Context] Calibration context updated: ${items.length} items`,
  );
}

/**
 * Retrieve the current calibration context (consumed by simulation engine).
 */
export function getCalibrationContext(): CalibrationContextEntry | null {
  return calibrationContext;
}
