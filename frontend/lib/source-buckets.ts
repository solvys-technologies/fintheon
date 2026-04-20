// [claude-code 2026-04-19] Source bucket taxonomy — collapses the 11 raw source
// values into 5 user-facing buckets. Used by the desktop filter dropdown,
// mobile filter sheet, and every card surface that prints a source chip.
// Geopolitical is a cross-cut classification that layers on top of the bucket;
// see `isGeopolitical()` for the additive rule.

import type { RiskFlowAlert } from "./riskflow-feed";

export type SourceBucket =
  | "OSINT"
  | "General"
  | "Commentary"
  | "Econ"
  | "Geopolitical";

export const SOURCE_BUCKETS: SourceBucket[] = [
  "General",
  "OSINT",
  "Commentary",
  "Econ",
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

  // Geopolitical is additive but wins when present — a card authored by a
  // geopolitical source (e.g. OSINT) reads more naturally under the
  // Geopolitical bucket than its raw source bucket.
  if (riskType === "Geopolitical") return "Geopolitical";

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

  return "General";
}

/** Additive membership — a General/OSINT item can ALSO be geopolitical. */
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
  // Additive: selecting Geopolitical should also surface non-Geopol primary
  // cards whose riskType is Geopolitical (handled by bucketOf above), but we
  // also want selecting "General" to still surface a Geopol-primary item whose
  // raw source is General. Guard with riskType check.
  if (selected.has("Geopolitical") && isGeopolitical(alert.riskType))
    return true;
  return false;
}

/** Adapter for the frontend RiskFlowAlert shape. */
export function bucketOfAlert(alert: RiskFlowAlert): SourceBucket {
  return bucketOf({ source: alert.source, riskType: alert.riskType });
}
