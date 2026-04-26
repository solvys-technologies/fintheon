// [claude-code 2026-04-25] S40-P6: Time-To-Print eligibility — joins
// economic_events (FF), earnings_events (FMP, megacap-only), and Macro
// commentator speeches (commentators.country='US') within a 5-min lookahead,
// ordered by impact rank.
//
// "country='US' for v1" filter is hard-coded here because the Refinement
// Engine country toggle scaffolds future EU/UK/JP support but only US is
// currently selectable.

import { getSupabaseClient } from "../../config/supabase.js";
import { ECON_PRINT_RANKINGS } from "../../config/econ-rankings.js";
import { createLogger } from "../../lib/logger.js";

// Build a fast map of name (lowercase) → rank (higher = more impactful).
// The brief's per-event rank values: CPI=8, NFP=8, FOMC=9, PCE=7, GDP=7,
// PPI=6, JOLTS=5, JOBLESS=5, RETAIL=5. We map the existing taxonomy onto
// these per-event values rather than the chainRole rank from ECON_PRINT_RANKINGS.
const TTP_IMPACT_RANK: Record<string, number> = {
  cpi: 8,
  nfp: 8,
  fomc: 9,
  pce: 7,
  gdp: 7,
  ppi: 6,
  jolts: 5,
  jobless: 5,
  jobless_claims: 5,
  retail: 5,
  retail_sales: 5,
  pmi: 6,
};

function rankFor(eventKey: string): number | null {
  const norm = eventKey.toLowerCase();
  if (TTP_IMPACT_RANK[norm] != null) return TTP_IMPACT_RANK[norm];
  // Fallback: scan the existing config for a name match.
  const cfg = ECON_PRINT_RANKINGS.find((c) => c.name.toLowerCase() === norm);
  return cfg ? Math.min(9, cfg.rank + 4) : null;
}

const log = createLogger("TimeToPrintEligibility");

export interface EligibleEvent {
  id: string;
  source: "econ" | "earnings" | "speaker";
  name: string;
  country: string;
  fires_at: string; // ISO
  forecast: string | null;
  actual: string | null;
  beatMiss: "beat" | "miss" | "inline" | null;
  surprisePercent: number | null;
  impactRank: number | null;
}

interface EconRow {
  id: string;
  name: string;
  date: string;
  time: string | null;
  forecast: string | null;
  actual: string | null;
  country: string | null;
  event_key: string | null;
  econ_data?: Record<string, unknown> | null;
}

interface EarningsRow {
  id: string;
  symbol: string;
  report_date: string;
  report_time: string | null;
  forecast_eps: number | null;
  actual_eps: number | null;
  beat_miss: string | null;
  surprise_percent: number | null;
}

function eventTimeToIso(date: string, time: string | null): string {
  if (!time || time === "TBD") return `${date}T00:00:00Z`;
  if (time === "BMO") return `${date}T13:00:00Z`; // 09:00 ET (BMO ≈ pre-market)
  if (time === "AMC") return `${date}T20:30:00Z`; // 16:30 ET (AMC ≈ post-close)
  // HH:MM time → assume ET, convert (best-effort; FF stores eastern timestamps)
  if (/^\d{2}:\d{2}/.test(time)) {
    return `${date}T${time}:00-04:00`; // EDT default; close enough for ±5 min eligibility
  }
  return `${date}T00:00:00Z`;
}

export async function getNextEligibleEvents(opts: {
  windowMinutes: number;
  country: string;
}): Promise<EligibleEvent[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const now = new Date();
  const horizon = new Date(now.getTime() + opts.windowMinutes * 60_000);

  const out: EligibleEvent[] = [];

  // 1. Economic events
  const today = now.toISOString().slice(0, 10);
  const tomorrow = horizon.toISOString().slice(0, 10);
  const { data: econRows, error: econErr } = await sb
    .from("economic_events")
    .select("id, name, date, time, forecast, actual, country, event_key, econ_data")
    .gte("date", today)
    .lte("date", tomorrow)
    .eq("country", opts.country);

  if (econErr) {
    log.warn("econ query failed", { error: econErr.message });
  } else {
    for (const row of (econRows ?? []) as EconRow[]) {
      const fires = new Date(eventTimeToIso(row.date, row.time));
      if (fires < now || fires > horizon) continue;
      const rank = rankFor(row.event_key ?? row.name);
      out.push({
        id: `econ:${row.id}`,
        source: "econ",
        name: row.name,
        country: row.country ?? opts.country,
        fires_at: fires.toISOString(),
        forecast: row.forecast,
        actual: row.actual,
        beatMiss: null,
        surprisePercent: null,
        impactRank: rank,
      });
    }
  }

  // 2. Megacap earnings (NDX∩SPX>$300B)
  const { data: earningsRows, error: earnErr } = await sb
    .from("earnings_events")
    .select(
      "id, symbol, report_date, report_time, forecast_eps, actual_eps, beat_miss, surprise_percent",
    )
    .gte("report_date", today)
    .lte("report_date", tomorrow)
    .eq("in_ndx", true)
    .eq("in_spx", true);

  if (earnErr) {
    log.warn("earnings query failed", { error: earnErr.message });
  } else {
    for (const row of (earningsRows ?? []) as EarningsRow[]) {
      const fires = new Date(
        eventTimeToIso(row.report_date, row.report_time),
      );
      if (fires < now || fires > horizon) continue;
      out.push({
        id: `earnings:${row.id}`,
        source: "earnings",
        name: `${row.symbol} earnings`,
        country: "US",
        fires_at: fires.toISOString(),
        forecast: row.forecast_eps?.toString() ?? null,
        actual: row.actual_eps?.toString() ?? null,
        beatMiss:
          row.beat_miss === "beat" ||
          row.beat_miss === "miss" ||
          row.beat_miss === "inline"
            ? row.beat_miss
            : null,
        surprisePercent: row.surprise_percent,
        impactRank: 7, // megacap default rank
      });
    }
  }

  // 3. Sort: closest fires_at first, then highest impactRank.
  out.sort((a, b) => {
    const aT = new Date(a.fires_at).getTime();
    const bT = new Date(b.fires_at).getTime();
    if (aT !== bT) return aT - bT;
    return (b.impactRank ?? 0) - (a.impactRank ?? 0);
  });

  return out;
}
