// [claude-code 2026-04-19] Mirror of frontend/lib/source-buckets.ts — kept as
// a sibling copy instead of a cross-import so the mobile bundle stays
// independent of frontend's build graph.

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

export function bucketOf(alert: {
  source: string;
  riskType?: string | null;
  submittedBy?: string | null;
}): SourceBucket {
  const src = (alert.source ?? "").toString();
  const submittedBy = (alert.submittedBy ?? "").toString();
  const riskType = alert.riskType ?? null;

  if (riskType === "Geopolitical") return "Geopolitical";
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
  return "General";
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
