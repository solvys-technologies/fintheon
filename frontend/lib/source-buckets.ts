// [claude-code 2026-04-29] S51: added Earnings bucket — routes Earnings-tagged alerts to dedicated bucket
// [claude-code 2026-04-28] S47-T1: General bucket stripped; Wire added as the
// primary catch-all for wire/rapid-news sources. Source bucket taxonomy
// collapses raw source values into user-facing buckets.
// Geopolitical is a cross-cut classification that layers on top of the bucket.

import type { RiskFlowAlert } from "./riskflow-feed";

export type SourceBucket =
  | "Wire"
  | "OSINT"
  | "Macro"
  | "Commentary"
  | "Econ"
  | "Earnings"
  | "Geopolitical"
  | "Commentary";

export const SOURCE_BUCKETS: SourceBucket[] = [
  "Wire",
  "Macro",
  "OSINT",
  "Commentary",
  "Econ",
  "Earnings",
  "Geopolitical",
];

/** Match an alert's source field (backend NewsSource or frontend AlertSource) to a bucket. */
export function bucketOf(alert: {
  source: string;
  riskType?: string | null;
  submittedBy?: string | null;
}): SourceBucket {
  const src = (alert.source ?? "").toString();
  const submittedBy = (alert.submittedBy ?? "").toString();
  const riskType = alert.riskType ?? null;

  // Geopolitical is additive but wins when present
  if (riskType === "Geopolitical") return "Geopolitical";

  // Earnings — dedicated bucket before other classification
  if (riskType === "Earnings") return "Earnings";

  // OSINT
  if (src === "OSINTSources" || src === "osint-sources") return "OSINT";

  // Commentary — Hermes agent + any commentary-scraper output
  if (src === "Hermes") return "Commentary";
  if (submittedBy.startsWith("commentary-scraper:")) return "Commentary";

  // Econ — calendar + prediction markets (both are structured data, not news)
  if (
    src === "EconomicCalendar" ||
    src === "economic-calendar" ||
    src === "Polymarket" ||
    src === "polymarket" ||
    src === "Kalshi" ||
    src === "kalshi-whale"
  ) {
    return "Econ";
  }

  // Macro — explicit macro risk type or macro-labelled sources
  if (riskType === "Macro") return "Macro";

  // Commentary — dedicated bucket for opinion/analysis
  if (src === "Commentary") return "Commentary";

  // Wire — everything else (FinancialJuice, DeItaOne, TwitterCli, etc.)
  return "Wire";
}

/** Additive membership — a Wire/OSINT item can ALSO be geopolitical. */
export function isGeopolitical(riskType?: string | null): boolean {
  return riskType === "Geopolitical";
}

/** Check if an alert matches any of the selected buckets (empty = all). */
export function matchesBuckets(
  alert: {
    source: string;
    riskType?: string | null;
    submittedBy?: string | null;
  },
  selected: Set<SourceBucket>,
): boolean {
  if (selected.size === 0) return true;
  const primary = bucketOf(alert);
  if (selected.has(primary)) return true;
  if (selected.has("Geopolitical") && isGeopolitical(alert.riskType))
    return true;
  return false;
}

/** Adapter for the frontend RiskFlowAlert shape. */
export function bucketOfAlert(alert: RiskFlowAlert): SourceBucket {
  return bucketOf({ source: alert.source, riskType: alert.riskType });
}
