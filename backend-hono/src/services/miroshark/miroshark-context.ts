// [claude-code 2026-03-28] S4-T2: Widened RiskFlow select to include full scored metadata
// [claude-code 2026-03-27] S4: Added econPrintHistory to context for MiroShark aggregation
// [claude-code 2026-03-27] S2-T4: Added addCalibrationContext for calibration upload pipeline
// [claude-code 2026-03-24] Widened RiskFlow window to 72h/40 with configurable params
// [claude-code 2026-03-23] MiroShark context assembly — fetches VIX, FRED, RiskFlow in parallel
import type {
  SanctumPreset,
  SimulationContext,
  RiskFlowHeadline,
  EconPrintStat,
} from "./miroshark-types.js";
import {
  fetchFredIndicators,
  getCachedFredIndicators,
  getFredFetchedAt,
} from "../systemic/fred-service.js";
import { getVix } from "../market-data/yahoo-market.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { readRecentEconPrintStats } from "../supabase-service.js";

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

  const [vixResult, fredResult, riskflowResult, econResult] =
    await Promise.allSettled([
      fetchVix ? getVix().then((v) => v.value) : Promise.resolve(null),
      fetchFred
        ? fetchFredIndicators()
        : Promise.resolve(getCachedFredIndicators()),
      fetchRiskFlow ? fetchRiskFlowHeadlines() : Promise.resolve([]),
      fetchEconHistory ? fetchEconPrintHistory() : Promise.resolve([]),
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

  return {
    vixLevel,
    fredIndicators,
    riskflowHeadlines,
    econPrintHistory:
      econPrintHistory.length > 0 ? econPrintHistory : undefined,
    fredFetchedAt: getFredFetchedAt()?.toISOString() ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch recent econ print history (7 days) and transform for MiroShark consumption.
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
      "id, tweet_id, title, summary, macro_level, sentiment, iv_score, category, created_at, sub_scores, econ_data, risk_type, agent_note, price_brain_score",
    )
    .gte("created_at", cutoff)
    .gte("macro_level", 2)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[MiroShark Context] RiskFlow fetch failed:", error.message);
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

// ─── Calibration Upload Context ─────────────────────────────────

interface CalibrationContextEntry {
  source: "calibration_upload";
  items: Array<{ headline: string; eventType: string; symbols: string[] }>;
  uploadedAt: string;
}

let calibrationContext: CalibrationContextEntry | null = null;

/**
 * Stores parsed calibration items in MiroShark's running context so they influence analysis.
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
    `[MiroShark Context] Calibration context updated: ${items.length} items`,
  );
}

/**
 * Retrieve the current calibration context (consumed by simulation engine).
 */
export function getCalibrationContext(): CalibrationContextEntry | null {
  return calibrationContext;
}
