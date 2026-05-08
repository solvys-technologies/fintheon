// [codex 2026-05-08] Shared country/category gate for econ-watch filters.
// Calendar ingestion already honors econ_watch_filters; this extends the same
// control to raw RiskFlow ingestion, including worker/RSS paths that bypass the
// calendar populator.

import {
  categorizeEvent,
  type EconCategory,
  type EconCountryCode,
} from "../econ-calendar-service.js";
import { isEconWirePrint } from "../riskflow/wire-print-classifier.js";
import { getFilters } from "./econ-watch-filters-service.js";

export interface EconWatchGateItem {
  source?: string | null;
  headline?: string | null;
  body?: string | null;
  tags?: string[] | null;
  ingest_pipeline?: string | null;
}

export interface EconWatchGateDecision {
  allowed: boolean;
  reason: string;
  country?: EconCountryCode;
  category?: string;
}

const COUNTRY_PATTERNS: Array<{
  country: EconCountryCode;
  patterns: RegExp[];
}> = [
  {
    country: "US",
    patterns: [
      /\b(?:u\.?s\.?|usa|united states|america|american|usd)\b/i,
      /\b(?:fed|fomc|treasury|powell|yellen|bessent)\b/i,
    ],
  },
  {
    country: "EU",
    patterns: [
      /\b(?:eu|eurozone|euro area|european union|eurostat|eur|ecb|lagarde)\b/i,
    ],
  },
  {
    country: "UK",
    patterns: [
      /\b(?:uk|u\.k\.|britain|british|united kingdom|gbp|boe|bank of england|bailey)\b/i,
    ],
  },
  {
    country: "JP",
    patterns: [/\b(?:japan|japanese|jpy|boj|bank of japan|ueda)\b/i],
  },
  {
    country: "NZ",
    patterns: [/\b(?:new zealand|nzd|rbnz|orr)\b/i],
  },
  {
    country: "AU",
    patterns: [/\b(?:australia|australian|aud|rba|reserve bank of australia)\b/i],
  },
  {
    country: "CA",
    patterns: [/\b(?:canada|canadian|cad|boc|bank of canada|macklem)\b/i],
  },
];

const US_DEFAULT_PATTERNS: RegExp[] = [
  /\b(?:nfp|non[- ]?farm|jobless claims|initial claims|continuing claims)\b/i,
  /\b(?:ism|pce|fomc|fed|treasury|powell|yellen|bessent)\b/i,
];

const ECON_PRINT_PATTERNS: RegExp[] = [
  /\b(?:actual|forecast|previous)\b/i,
  /\b(?:cpi|ppi|pce|hicp|inflation|prices?)\b/i,
  /\b(?:nfp|non[- ]?farm|payrolls?|jobless claims|unemployment|jolts|adp|wages?|earnings)\b/i,
  /\b(?:pmi|ism|manufacturing|services|industrial production|factory orders|durable goods)\b/i,
  /\b(?:retail sales|housing starts|building permits|trade balance|inventories|gdp)\b/i,
  /\b(?:rate decision|interest rate|central bank|fomc|ecb|boe|boj|rba|rbnz|boc)\b/i,
  /\b(?:budget|deficit|treasury auction|fiscal|debt ceiling)\b/i,
];

const CATEGORY_TO_WATCH_CATEGORY: Partial<Record<EconCategory, string>> = {
  Fiscal: "Fiscal",
  "Supply Chain": "Supply Chain",
  Inflation: "Inflation",
  "Job Market": "Job Market",
  Speaker: "Fiscal",
};

function blobFor(item: EconWatchGateItem): string {
  return [
    item.headline ?? "",
    item.body ?? "",
    ...(item.tags ?? []),
    item.source ?? "",
    item.ingest_pipeline ?? "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeEconItem(text: string): boolean {
  if (!text) return false;
  if (isEconWirePrint(text)) return true;
  return ECON_PRINT_PATTERNS.some((pattern) => pattern.test(text));
}

function inferCountry(text: string): EconCountryCode | null {
  for (const entry of COUNTRY_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) {
      return entry.country;
    }
  }
  if (US_DEFAULT_PATTERNS.some((pattern) => pattern.test(text))) {
    return "US";
  }
  return null;
}

function inferCategory(text: string): string {
  return CATEGORY_TO_WATCH_CATEGORY[categorizeEvent(text)] ?? "Fiscal";
}

export async function checkEconWatchGate(
  item: EconWatchGateItem,
): Promise<EconWatchGateDecision> {
  const text = blobFor(item);
  if (!looksLikeEconItem(text)) {
    return { allowed: true, reason: "not_econ_watch_candidate" };
  }

  const country = inferCountry(text);
  if (!country) {
    return { allowed: true, reason: "econ_country_unknown" };
  }

  const category = inferCategory(text);
  const filters = await getFilters();
  if (filters.length === 0) {
    return { allowed: true, reason: "econ_watch_filters_unavailable" };
  }

  const match = filters.find(
    (filter) =>
      String(filter.country).toUpperCase() === country &&
      String(filter.category) === category,
  );

  if (!match) {
    return {
      allowed: false,
      reason: `econ_watch_filter_missing:${country}:${category}`,
      country,
      category,
    };
  }

  if (!match.active) {
    return {
      allowed: false,
      reason: `econ_watch_filter_inactive:${country}:${category}`,
      country,
      category,
    };
  }

  return {
    allowed: true,
    reason: `econ_watch_filter_active:${country}:${category}`,
    country,
    category,
  };
}
