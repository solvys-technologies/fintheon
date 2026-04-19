// [claude-code 2026-04-03] Headline subject tagger for AgentDesk persona routing
// Tags headlines with subject categories so each market analyst persona
// receives a filtered headline subset (anti-groupthink routing).

export type SubjectTag =
  | "flow"
  | "vol"
  | "macro"
  | "credit"
  | "geopolitical"
  | "earnings"
  | "sentiment"
  | "structure";

const SUBJECT_PATTERNS: Record<SubjectTag, string[]> = {
  flow: [
    "dark pool",
    "darkpool",
    "order flow",
    "block trade",
    "unusual activity",
    "options flow",
    "gamma",
    "gex",
    "dealer",
    "positioning",
    "whale",
    "institutional",
    "hedge fund",
    "outflow",
    "inflow",
    "fund flow",
    "put/call",
    "put call",
    "open interest",
    "notional",
    "sweep",
  ],
  vol: [
    "vix",
    "volatility",
    "vol ",
    "ivol",
    "implied vol",
    "realized vol",
    "skew",
    "term structure",
    "vvix",
    "move index",
    "vol crush",
    "vol spike",
    "straddle",
    "strangle",
    "convexity",
    "tail risk",
    "black swan",
    "risk reversal",
    "variance swap",
  ],
  macro: [
    "fed",
    "fomc",
    "rate cut",
    "rate hike",
    "cpi",
    "ppi",
    "pce",
    "gdp",
    "nfp",
    "payrolls",
    "unemployment",
    "inflation",
    "deflation",
    "yield curve",
    "treasury",
    "bond",
    "dollar",
    "dxy",
    "yen",
    "euro",
    "boj",
    "ecb",
    "pboc",
    "rba",
    "boe",
    "central bank",
    "monetary policy",
    "quantitative",
    "tightening",
    "easing",
    "jobless claims",
    "retail sales",
    "housing",
    "ism",
    "pmi",
    "consumer confidence",
    "adp",
  ],
  credit: [
    "credit spread",
    "high yield",
    "investment grade",
    "hy ",
    "ig ",
    "cds",
    "default",
    "downgrade",
    "upgrade",
    "junk bond",
    "leverage",
    "leveraged loan",
    "distressed",
    "bankruptcy",
    "restructuring",
    "covenant",
    "lbo",
    "spread widen",
    "spread tight",
    "oas",
    "credit risk",
    "funding",
    "liquidity crisis",
    "bank run",
  ],
  geopolitical: [
    "war",
    "conflict",
    "invasion",
    "military",
    "missile",
    "nuclear",
    "tariff",
    "sanction",
    "trade war",
    "embargo",
    "nato",
    "opec",
    "ceasefire",
    "escalation",
    "de-escalation",
    "diplomatic",
    "geopolitical",
    "regime change",
    "coup",
    "election",
    "executive order",
    "legislation",
    "congress",
    "china",
    "russia",
    "iran",
    "taiwan",
    "ukraine",
    "middle east",
  ],
  earnings: [
    "earnings",
    "eps",
    "revenue",
    "guidance",
    "beat",
    "miss",
    "quarterly",
    "fiscal",
    "profit",
    "margin",
    "buyback",
    "dividend",
    "forward guidance",
    "analyst estimate",
    "whisper number",
    "pre-market",
    "after hours",
    "conference call",
    "outlook",
  ],
  sentiment: [
    "wsb",
    "wallstreetbets",
    "reddit",
    "retail",
    "meme stock",
    "short squeeze",
    "aaii",
    "bull/bear",
    "fear greed",
    "sentiment",
    "contrarian",
    "crowded trade",
    "consensus",
    "positioning survey",
    "put/call ratio",
    "smart money",
    "dumb money",
    "social media",
  ],
  structure: [
    "breakout",
    "breakdown",
    "support",
    "resistance",
    "trend",
    "reversal",
    "head and shoulders",
    "double top",
    "double bottom",
    "fibonacci",
    "moving average",
    "golden cross",
    "death cross",
    "rsi",
    "macd",
    "divergence",
    "volume profile",
    "market structure",
    "liquidity sweep",
    "gap fill",
    "range bound",
  ],
};

// Pre-lowercase all patterns for fast matching
const COMPILED_PATTERNS: [SubjectTag, string[]][] = Object.entries(
  SUBJECT_PATTERNS,
).map(([tag, patterns]) => [
  tag as SubjectTag,
  patterns.map((p) => p.toLowerCase()),
]);

/**
 * Tag a headline with subject categories for persona routing.
 * Pure keyword matching — no LLM call. Fast enough for the 30s scoring cycle.
 * Returns deduplicated array of matching subject tags.
 */
export function tagHeadlineSubjects(
  headline: string,
  existingTags: string[] = [],
): SubjectTag[] {
  const text = (headline + " " + existingTags.join(" ")).toLowerCase();
  const matched: SubjectTag[] = [];

  for (const [tag, patterns] of COMPILED_PATTERNS) {
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        matched.push(tag);
        break; // One match per category is enough
      }
    }
  }

  return matched;
}
