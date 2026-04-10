// [claude-code 2026-03-26] S2-T2: Regime detector — proposes regime changes from news flow heuristics
import type { MarketRegime } from "../../types/regime.js";
import type { FeedItem } from "../../types/riskflow.js";

export interface RegimeSignal {
  proposedRegime: MarketRegime;
  confidence: number;
  reasoning: string[];
  triggerItems: string[];
}

// ── Tag/keyword classifiers ────────────────────────────────────

const GEO_TAGS = [
  "geopolitical",
  "tariffs",
  "conflict",
  "sanctions",
  "war",
  "china",
  "trade-war",
  "nato",
];
const MACRO_TAGS = [
  "fed",
  "fomc",
  "cpi",
  "ppi",
  "nfp",
  "gdp",
  "jobless",
  "pce",
  "rates",
  "inflation",
];
const EARNINGS_TAGS = [
  "earnings",
  "revenue",
  "guidance",
  "beat",
  "miss",
  "eps",
];
const LIQUIDITY_TAGS = [
  "liquidity",
  "repo",
  "funding",
  "bank-stress",
  "credit-spread",
  "default",
];

function hasTag(item: FeedItem, tagList: string[]): boolean {
  const lower = [...item.tags, ...item.symbols].map((t) => t.toLowerCase());
  const headlineLower = item.headline.toLowerCase();
  return tagList.some((t) => lower.includes(t) || headlineLower.includes(t));
}

function isRecent(item: FeedItem, windowMs: number, now: number): boolean {
  const pub = new Date(item.publishedAt).getTime();
  return now - pub < windowMs;
}

// ── Detection heuristics ───────────────────────────────────────

export function detectRegimeFromFeed(
  items: FeedItem[],
  windowHours = 6,
): RegimeSignal | null {
  const now = Date.now();
  const windowMs = windowHours * 60 * 60 * 1000;
  const recent = items.filter((i) => isRecent(i, windowMs, now));

  if (recent.length === 0) return null;

  const signals: RegimeSignal[] = [];

  // GEO_TENSIONS: 3+ geopolitical items with macroLevel >= 3
  const geoItems = recent.filter(
    (i) => hasTag(i, GEO_TAGS) && (i.macroLevel ?? 1) >= 3,
  );
  if (geoItems.length >= 3) {
    signals.push({
      proposedRegime: "GEO_TENSIONS",
      confidence: Math.min(0.5 + geoItems.length * 0.1, 0.95),
      reasoning: [
        `${geoItems.length} geopolitical/tariff/conflict items in ${windowHours}h window`,
        `All macroLevel >= 3`,
      ],
      triggerItems: geoItems.map((i) => i.id),
    });
  }

  // MACRO_ECON: 3+ fed/cpi/nfp items with macroLevel >= 3
  const macroItems = recent.filter(
    (i) => hasTag(i, MACRO_TAGS) && (i.macroLevel ?? 1) >= 3,
  );
  if (macroItems.length >= 3) {
    signals.push({
      proposedRegime: "MACRO_ECON",
      confidence: Math.min(0.5 + macroItems.length * 0.1, 0.95),
      reasoning: [
        `${macroItems.length} macro/econ items in ${windowHours}h window`,
        `Includes: ${macroItems
          .slice(0, 3)
          .map((i) => i.headline.slice(0, 60))
          .join("; ")}`,
      ],
      triggerItems: macroItems.map((i) => i.id),
    });
  }

  // EARNINGS_SEASON: 5+ earnings items (calendar-aware: Jan/Apr/Jul/Oct)
  const earningsItems = recent.filter((i) => hasTag(i, EARNINGS_TAGS));
  const month = new Date().getMonth(); // 0-indexed
  const isEarningsMonth = [0, 3, 6, 9].includes(month); // Jan, Apr, Jul, Oct
  if (
    earningsItems.length >= 5 ||
    (earningsItems.length >= 3 && isEarningsMonth)
  ) {
    signals.push({
      proposedRegime: "EARNINGS_SEASON",
      confidence: isEarningsMonth
        ? Math.min(0.6 + earningsItems.length * 0.05, 0.9)
        : Math.min(0.4 + earningsItems.length * 0.08, 0.85),
      reasoning: [
        `${earningsItems.length} earnings items in ${windowHours}h window`,
        isEarningsMonth
          ? "Calendar confirms earnings month"
          : "High earnings volume outside typical season",
      ],
      triggerItems: earningsItems.map((i) => i.id),
    });
  }

  // RISK_OFF: 2+ bearish items with macroLevel >= 3 (VIX check would need market data)
  const bearishHighMacro = recent.filter(
    (i) => i.sentiment === "bearish" && (i.macroLevel ?? 1) >= 3,
  );
  const liquidityItems = recent.filter((i) => hasTag(i, LIQUIDITY_TAGS));
  if (bearishHighMacro.length >= 2 && liquidityItems.length >= 1) {
    signals.push({
      proposedRegime: "RISK_OFF",
      confidence: Math.min(
        0.5 + bearishHighMacro.length * 0.1 + liquidityItems.length * 0.1,
        0.9,
      ),
      reasoning: [
        `${bearishHighMacro.length} bearish high-macro items`,
        `${liquidityItems.length} liquidity/credit stress items`,
      ],
      triggerItems: [...bearishHighMacro, ...liquidityItems].map((i) => i.id),
    });
  }

  // ILLIQUID_STUPIDITY: Any liquidityStress/bankStress item with macroLevel 4
  const level4Liquidity = recent.filter(
    (i) => hasTag(i, LIQUIDITY_TAGS) && i.macroLevel === 4,
  );
  if (level4Liquidity.length >= 1) {
    signals.push({
      proposedRegime: "ILLIQUID_STUPIDITY",
      confidence: Math.min(0.7 + level4Liquidity.length * 0.1, 0.95),
      reasoning: [
        `${level4Liquidity.length} macroLevel-4 liquidity/bank stress items — near crisis territory`,
      ],
      triggerItems: level4Liquidity.map((i) => i.id),
    });
  }

  // Return highest-confidence signal
  if (signals.length === 0) return null;
  signals.sort((a, b) => b.confidence - a.confidence);
  return signals[0];
}

export function shouldProposeRegimeChange(
  current: MarketRegime,
  signal: RegimeSignal,
): boolean {
  return signal.confidence > 0.6 && signal.proposedRegime !== current;
}
