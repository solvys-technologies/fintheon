// [claude-code 2026-05-16] S67: Estimated Drift KPI service — maps risk signal event types
// to volatility taxonomy decay data, produces persistence categories.
import { getVolatilityProfile } from "../iv-scoring/taxonomy.js";

export type PersistenceCategory =
  | "1_session"
  | "2_sessions"
  | "1_day"
  | "2_days"
  | "1_week";

export interface EstimatedDriftResult {
  signalId: string;
  persistenceCategory: PersistenceCategory;
  label: string;
  decayBaseMinutes: number;
  adjustedDecayMinutes: number;
  clusteredCatalysts: number;
  snowballRisk: boolean;
  driftDrivers: string[];
}

export interface EstimatedDriftContext {
  title?: string;
  summary?: string;
  analysis?: string;
  score?: number;
  source?: string;
  relatedHeadlines?: string[];
  narrativeThreads?: string[];
}

function minutesToCategory(minutes: number): {
  category: PersistenceCategory;
  label: string;
} {
  if (minutes <= 180) return { category: "1_session", label: "1 session" };
  if (minutes <= 540) return { category: "2_sessions", label: "2 sessions" };
  if (minutes <= 1440) return { category: "1_day", label: "1 day" };
  if (minutes <= 2880) return { category: "2_days", label: "2 days" };
  return { category: "1_week", label: "1 week" };
}

export function estimateDrift(
  signalId: string,
  eventType: string,
  context?: EstimatedDriftContext,
): EstimatedDriftResult {
  const profile = getVolatilityProfile(eventType);
  const decayBaseMinutes = profile.decayBaseMinutes ?? 30;
  const cascade = scoreCatalystCascade(context);
  const adjustedDecayMinutes = Math.min(
    7 * 24 * 60,
    decayBaseMinutes + cascade.premiumMinutes,
  );
  const { category, label } = minutesToCategory(adjustedDecayMinutes);

  return {
    signalId,
    persistenceCategory: category,
    label,
    decayBaseMinutes,
    adjustedDecayMinutes,
    clusteredCatalysts: cascade.clusteredCatalysts,
    snowballRisk: cascade.snowballRisk,
    driftDrivers: cascade.driftDrivers,
  };
}

function scoreCatalystCascade(context?: EstimatedDriftContext): {
  premiumMinutes: number;
  clusteredCatalysts: number;
  snowballRisk: boolean;
  driftDrivers: string[];
} {
  if (!context) {
    return {
      premiumMinutes: 0,
      clusteredCatalysts: 0,
      snowballRisk: false,
      driftDrivers: [],
    };
  }

  const text = [
    context.title,
    context.summary,
    context.analysis,
    ...(context.relatedHeadlines ?? []),
    ...(context.narrativeThreads ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const clusteredCatalysts = Math.max(0, context.relatedHeadlines?.length ?? 0);
  const driftDrivers = findDriftDrivers(text);
  const hasPositioningStress =
    /\b(squeeze|gamma|positioning|forced|liquidat|deleverag|rotation|repric)/.test(
      text,
    );
  const hasExplicitCascade =
    /\b(snowball|cascade|cluster|chorus|pile[- ]?on|feedback loop)\b/.test(
      text,
    );
  const isCatalystCluster =
    clusteredCatalysts >= 3 ||
    (clusteredCatalysts >= 2 && driftDrivers.length >= 3) ||
    hasExplicitCascade;

  let premiumMinutes = 0;
  if (isCatalystCluster) {
    premiumMinutes +=
      180 + Math.min(300, clusteredCatalysts * 55 + driftDrivers.length * 25);
  }
  if (isCatalystCluster && (context.score ?? 0) >= 8) {
    premiumMinutes += 120;
  }
  if (hasPositioningStress) {
    premiumMinutes += isCatalystCluster ? 90 : 45;
  }
  if (
    !isCatalystCluster &&
    (context.score ?? 0) >= 8.5 &&
    driftDrivers.length >= 3
  ) {
    premiumMinutes += 90;
  }

  return {
    premiumMinutes,
    clusteredCatalysts,
    snowballRisk: premiumMinutes >= 180,
    driftDrivers,
  };
}

function findDriftDrivers(text: string): string[] {
  const patterns: Array<[RegExp, string]> = [
    [/\bfed|fomc|powell|bowman|paulson|musalem|williams\b/, "fed-policy"],
    [/\bpmi|ism|manufactur|services|growth\b/, "growth-data"],
    [/\binflation|cpi|pce|prices|tariff\b/, "inflation"],
    [/\blabor|jobs|payroll|wage|unemployment\b/, "labor"],
    [/\byield|treasur|rates?|duration|curve\b/, "rates"],
    [/\bdollar|dxy|yen|euro|fx\b/, "fx"],
    [/\bnq|nasdaq|tech|semis?|ai\b/, "tech-beta"],
    [/\bvix|vol|gamma|squeeze|positioning\b/, "positioning-vol"],
    [/\bcredit|spread|liquidity|funding\b/, "liquidity"],
  ];
  return patterns
    .filter(([pattern]) => pattern.test(text))
    .map(([, label]) => label)
    .slice(0, 6);
}
