type MarketImpactLeg = {
  points?: unknown;
  percent?: unknown;
};

type MarketImpactRecord = {
  nq?: MarketImpactLeg | null;
  es?: MarketImpactLeg | null;
  ym?: MarketImpactLeg | null;
  asOf?: unknown;
};

const FUTURES_LEGS: Array<
  [label: string, key: keyof Pick<MarketImpactRecord, "nq" | "es" | "ym">]
> = [
  ["NQ", "nq"],
  ["ES", "es"],
  ["YM", "ym"],
];

export function formatMarketImpact(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!isRecord(value)) return null;

  const impact = value as MarketImpactRecord;
  const legs = FUTURES_LEGS.map(([label, key]) =>
    formatImpactLeg(label, impact[key]),
  ).filter((part): part is string => Boolean(part));
  const asOf = formatAsOf(impact.asOf);

  if (legs.length === 0) return null;
  return [...legs, ...(asOf ? [asOf] : [])].join(" | ");
}

export function safeNarrativeText(
  value: unknown,
  fallback?: string | null,
): string | null {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text.length > 0 ? text : (fallback ?? null);
  }

  if (value == null || typeof value === "boolean") {
    return fallback ?? null;
  }

  return formatMarketImpact(value) ?? fallback ?? null;
}

function formatImpactLeg(label: string, leg: unknown): string | null {
  if (!isRecord(leg)) return null;

  const points = numberFromUnknown(leg.points);
  const percent = numberFromUnknown(leg.percent);

  if (points == null && percent == null) return null;

  const parts = [
    points == null ? null : `${formatSigned(points)}pts`,
    percent == null ? null : `(${formatSigned(percent)}%)`,
  ].filter((part): part is string => Boolean(part));

  return `${label} ${parts.join(" ")}`;
}

function formatAsOf(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.trim();

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatSigned(value: number): string {
  const rounded = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return value > 0 ? `+${rounded}` : rounded;
}

function numberFromUnknown(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
