// [claude-code 2026-04-29] S51: added Earnings bucket — routes Earnings-tagged alerts to dedicated bucket
// [claude-code 2026-04-28] S47-T1: General stripped; Wire/Macro added.
// Mirror of frontend/lib/source-buckets.ts — kept as a sibling copy so the
// mobile bundle stays independent of frontend's build graph.

export type SourceBucket =
  | "Wire"
  | "OSINT"
  | "Macro"
  | "Commentary"
  | "Econ"
  | "Earnings"
  | "Geopolitical";

export const SOURCE_BUCKETS: SourceBucket[] = [
  "Wire",
  "Macro",
  "OSINT",
  "Commentary",
  "Econ",
  "Earnings",
  "Geopolitical",
];

export function bucketOf(alert: {
  source: string;
  riskType?: string | null;
  submittedBy?: string | null;
}): SourceBucket {
  const src = (alert.source ?? "").toString();
  const submittedBy = (alert.submittedBy ?? "").toString();
  const riskType = alert.riskType ?? null;

  if (riskType === "Geopolitical") return "Geopolitical";
  if (riskType === "Earnings") return "Earnings";
  if (src === "OSINTSources" || src === "osint-sources") return "OSINT";
  if (src === "Hermes") return "Commentary";
  if (submittedBy.startsWith("commentary-scraper:")) return "Commentary";
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
  if (riskType === "Macro") return "Macro";
  return "Wire";
}

export function isGeopolitical(riskType?: string | null): boolean {
  return riskType === "Geopolitical";
}

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
