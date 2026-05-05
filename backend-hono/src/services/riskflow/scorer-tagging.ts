// [claude-code 2026-04-29] S52-T2: expanded Earnings keywords for broader headline mix (forecast, net income, dividend, buyback, earnings call, preannounce, top/bottom line)
// [claude-code 2026-04-28] S48-T1: Fix 2 — added missing econ narrative keywords (gdp, industrial-output, consumer-sentiment, manufacturing-pmi, retail-activity, trade-flows, capital-goods, housing-activity)
// [claude-code 2026-04-16] S20-T9: Split from central-scorer.ts — source normalization, risk classification, narrative gate, dismissed patterns
// [claude-code 2026-03-23] Central scoring agent — polls unscored items from Supabase, runs AI analysis, writes scored results

import type { FeedItem } from "../../types/riskflow.js";
import { getSupabaseClient } from "../../config/supabase.js";

// ── Dismissed Pattern Cache ─────────────────────────────────────────────────
let dismissedHeadlines: string[] = [];
let dismissedLoadedAt = 0;
const DISMISSED_TTL = 5 * 60_000;

export async function loadDismissedPatterns(): Promise<string[]> {
  if (
    Date.now() - dismissedLoadedAt < DISMISSED_TTL &&
    dismissedHeadlines.length > 0
  ) {
    return dismissedHeadlines;
  }
  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data } = await sb
    .from("riskflow_dismissed_items")
    .select("headline")
    .order("dismissed_at", { ascending: false })
    .limit(500);
  dismissedHeadlines = (data ?? []).map((r) =>
    (r.headline as string)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  dismissedLoadedAt = Date.now();
  return dismissedHeadlines;
}

export function isSimilarToDismissed(
  headline: string,
  dismissed: string[],
): boolean {
  const normalized = headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalized.split(" ").slice(0, 6).join(" ");
  if (words.length < 10) return false;
  return dismissed.some(
    (d) =>
      d.includes(words) || words.includes(d.split(" ").slice(0, 6).join(" ")),
  );
}

// ── Narrative Keywords ──────────────────────────────────────────────────────
const NARRATIVE_KEYWORDS: Record<string, RegExp> = {
  "middle-east-conflict":
    /\b(iran|israel|irgc|houthi|hezbollah|hamas|gaza|lebanon|netanyahu|araghchi|khamenei|hormuz|strait|missile|ceasefire|idf|ukmto|cargo vessel|maritime incident|engine room|shipping lane|gulf of oman|dubai|uae)\b/i,
  "liquidity-credit":
    /\b(liquidity|credit|repo|reverse repo|TGA|treasury general|QT|quantitative tight|bank run|bank stress|deposit flight|private credit|redemption)\b/i,
  "ai-singularity":
    /\b(nvidia|nvda|openai|anthropic|deepmind|google ai|microsoft ai|meta ai|mag.?7|magnificent|artificial intelligence|AGI|GPU|H100|data center|AI capex)\b/i,
  "usd-jpy-carry":
    /\b(usd.?jpy|carry trade|yen|boj|bank of japan|japan rate|ueda)\b/i,
  "trade-war":
    /\b(tariff|trade war|import duty|reciprocal tariff|customs|duties|retaliatory|section 301|trade deficit)\b/i,
  "us-china":
    /\b(us.?china|china.*sanction|china.*tariff|taiwan|xi jinping|chip ban|export control|rare earth|china.*retaliat)\b/i,
  "rate-cycle":
    /\b(rate cut|fed cut|fomc|fed funds|powell|dot plot|terminal rate|neutral rate|easing cycle|pivot)\b/i,
  "trump-presidency":
    /\b(trump|executive order|white house|bessent|doge|elon.*gov)\b/i,
  "price-stability":
    /\b(cpi|ppi|pce|inflation|deflation|disinflation|core price|shelter cost|sticky inflation|supercore)\b/i,
  employment:
    /\b(nfp|payroll|unemployment|jobless claim|jolts|hiring|layoff|ADP|labor market|wage growth)\b/i,
  energy:
    /\b(oil|crude|wti|brent|opec|barrel|EIA|refinery|pipeline|LNG|natgas|energy)\b/i,
  earnings:
    /\b(earnings|revenue|eps|guidance|beat|miss|outlook|forward guidance)\b/i,
  gdp: /\bgdp\b/i,
  "industrial-output": /\bindustrial\s+production\b/i,
  "consumer-sentiment": /\bconsumer\s+(?:confidence|sentiment)\b/i,
  "manufacturing-pmi":
    /\b(?:ism|pmi|manufacturing)\s*(?:pmi|manufacturing|services)\b/i,
  "retail-activity": /\bretail\s+sales\b/i,
  "trade-flows": /\btrade\s+balance\b/i,
  "capital-goods": /\bdurable\s+goods\b/i,
  "housing-activity": /\bbuilding\s+permits\b/i,
};

export function matchesAnyNarrative(text: string): boolean {
  for (const regex of Object.values(NARRATIVE_KEYWORDS)) {
    if (regex.test(text)) return true;
  }
  return false;
}

// ── Source Normalization ─────────────────────────────────────────────────────
// S10-T1a: Normalize raw source labels to the 4 watchlist categories

const FJ_ACCOUNTS = new Set(["financialjuice", "firstsquawk"]);

const DEITAONE_ACCOUNTS = new Set(["deltaone", "deItaone", "deitaone"]);

// [claude-code 2026-04-30] S55: Commentary accounts are managed via the
// Refinement Engine (riskflow_source_accounts table, category="Commentary").
// No hardcoded accounts here — the Commentary worker tier polls whatever the
// operator has added. FinancialJuice is seeded as the default Commentary entry.
const COMMENTARY_ACCOUNTS = new Set<string>([]);

const OSINT_ACCOUNTS = new Set([
  "osintdefender",
  "intikinetik",
  "thespectatorindex",
  "schizointel",
  "menchosint",
  "clashreport",
  "aboragchi",
  "israelipm",
  "secdef",
  "ustreasury",
  "whitehouse",
  "vp",
  "ecb",
]);

const ECON_KEYWORDS = [
  "cpi",
  "ppi",
  "nfp",
  "gdp",
  "pce",
  "fomc",
  "fed rate",
  "jobless claims",
  "retail sales",
  "housing starts",
  "consumer confidence",
  "ism ",
  "adp ",
  "unemployment",
  "inflation",
  "payrolls",
  "economic calendar",
  "data release",
];

const GEO_KEYWORDS = [
  "tariff",
  "sanction",
  "military",
  "invasion",
  "war ",
  "conflict",
  "nato",
  "opec",
  "missile",
  "nuclear",
  "geopolitical",
  "executive order",
  "white house",
  "congress",
  "legislation",
  "treasury secretary",
  "ukmto",
  "hormuz",
  "red sea",
  "cargo vessel",
  "engine room fire",
  "maritime incident",
  "shipping lane",
  "uae",
  "dubai",
];

const PREDICTION_KEYWORDS = [
  "polymarket",
  "kalshi",
  "prediction market",
  "betting odds",
  "probability",
];

export function normalizeSource(
  rawSource: string | undefined,
  headline: string,
  tags: string[] = [],
  url?: string | null,
):
  | "FinancialJuice"
  | "OSINTSources"
  | "EconomicCalendar"
  | "Polymarket"
  | "Commentary"
  | "Untrusted" {
  const src = (rawSource || "").toLowerCase().replace(/[^a-z0-9_]/g, "");

  if (rawSource === "FinancialJuice") return "FinancialJuice";
  if (rawSource === "OSINTSources") return "OSINTSources";
  if (rawSource === "DeItaOne") return "FinancialJuice";
  if (rawSource === "Commentary") return "Commentary";
  if (rawSource === "EconomicCalendar") return "EconomicCalendar";
  if (rawSource === "Polymarket" || rawSource === "Kalshi") return "Polymarket";

  if (FJ_ACCOUNTS.has(src)) return "FinancialJuice";
  if (DEITAONE_ACCOUNTS.has(src)) return "FinancialJuice";
  if (COMMENTARY_ACCOUNTS.has(src)) return "Commentary";
  if (OSINT_ACCOUNTS.has(src)) return "OSINTSources";

  // [claude-code 2026-04-30] S55: Unknown source with a blocked publisher URL
  // must NEVER default to FinancialJuice. This was the root cause of the
  // trust-label failure — items from Agent Reach RSS with seekingalpha.com URLs
  // were getting normalized to FinancialJuice because the source field was
  // an unrecognized RSS tag.
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      const BLOCKED_HOSTS = [
        "seekingalpha.com",
        "bloomberg.com",
        "cnbc.com",
        "marketwatch.com",
        "reuters.com",
        "wsj.com",
        "ft.com",
        "barrons.com",
        "zerohedge.com",
        "foxnews.com",
        "foxbusiness.com",
        "msnbc.com",
        "cnn.com",
        "yahoo.com",
        "finance.yahoo.com",
        "businessinsider.com",
      ];
      for (const blocked of BLOCKED_HOSTS) {
        if (host === blocked || host.endsWith("." + blocked)) {
          return "Untrusted";
        }
      }
    } catch {}
  }

  const text = (headline + " " + tags.join(" ")).toLowerCase();

  if (PREDICTION_KEYWORDS.some((kw) => text.includes(kw))) return "Polymarket";
  if (ECON_KEYWORDS.some((kw) => text.includes(kw))) return "EconomicCalendar";
  if (GEO_KEYWORDS.some((kw) => text.includes(kw))) return "OSINTSources";

  // [claude-code 2026-04-30] S55: Unknown sources that don't match any
  // keyword bucket are now "Untrusted" instead of defaulting to FinancialJuice.
  return "Untrusted";
}

// ── Risk Type Classification ─────────────────────────────────────────────────

const RISK_TYPE_KEYWORDS: Record<string, string[]> = {
  Macro: [
    "fed",
    "fomc",
    "cpi",
    "ppi",
    "gdp",
    "nfp",
    "pce",
    "rate",
    "inflation",
    "unemployment",
    "jobless",
    "retail sales",
    "housing starts",
    "consumer confidence",
  ],
  Geopolitical: [
    "war",
    "tariff",
    "sanction",
    "military",
    "conflict",
    "opec",
    "nato",
    "invasion",
    "missile",
    "nuclear",
    "ukmto",
    "hormuz",
    "red sea",
    "cargo vessel",
    "maritime incident",
    "engine room fire",
    "shipping lane",
    "uae",
    "dubai",
  ],
  Earnings: [
    "earnings",
    "eps",
    "earnings per share",
    "q1 preview",
    "q2 preview",
    "q3 preview",
    "q4 preview",
    "q1 earnings",
    "q2 earnings",
    "q3 earnings",
    "q4 earnings",
    "q1 results",
    "q2 results",
    "q3 results",
    "q4 results",
    "analyst estimate",
    "revenue guidance",
    "analyst cut",
    "analyst raises",
    "beat estimates",
    "miss estimates",
    "results",
    "ebit",
    "margin",
    "gross margin",
    "operating margin",
    "net income",
    "operating income",
    "revenue",
    "guidance",
    "forecast",
    "outlook",
    "forward guidance",
    "beat",
    "miss",
    "quarterly",
    "quarterly report",
    "fiscal",
    "fiscal year",
    "dividend",
    "buyback",
    "share repurchase",
    "earnings call",
    "conference call",
    "preannounce",
    "profit warning",
    "top line",
    "bottom line",
    "sales growth",
    "comparable sales",
  ],
  Technical: [
    "resistance",
    "support",
    "breakout",
    "volume",
    "rsi",
    "macd",
    "moving average",
    "fibonacci",
    "trend",
  ],
  Credit: [
    "credit spread",
    "high yield",
    "leverage",
    "margin",
    "default",
    "downgrade",
    "junk bond",
  ],
  Liquidity: [
    "repo",
    "funding",
    "liquidity",
    "bank run",
    "cash crunch",
    "reserve",
  ],
};

export function classifyRiskType(
  headline: string,
  tags: string[],
): FeedItem["riskType"] {
  const text = (headline + " " + tags.join(" ")).toLowerCase();
  let bestType: FeedItem["riskType"] = "Commentary";
  let bestCount = 0;

  for (const [riskType, keywords] of Object.entries(RISK_TYPE_KEYWORDS)) {
    let count = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestType = riskType as FeedItem["riskType"];
    }
  }

  return bestType;
}
