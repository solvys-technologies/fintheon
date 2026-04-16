// [claude-code 2026-04-16] S20-T9: Split from iv-scoring-v2.ts — event classifier, martingale, sentiment, instrument flipper
// [claude-code 2026-03-29] S9-T2b: Instrument-aware sentiment flipper
// [claude-code 2026-03-28] S9-T2: Martingale diminishing returns + contextual sentiment enforcement

import type { ParsedHeadline } from "../../types/news-analysis.js";

// ============================================================================
// EVENT TYPE CLASSIFIER (from headline parsing)
// ============================================================================

function wordMatch(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

export function classifyEventType(parsed: ParsedHeadline): string {
  const headline = (parsed.raw ?? "").toLowerCase();
  const eventType = parsed.eventType?.toLowerCase() ?? "";

  // Black Swan detection
  if (
    headline.includes("halt") &&
    (headline.includes("datacenter") || headline.includes("trading"))
  ) {
    return "datacenterHalt";
  }
  if (headline.includes("shutdown") && headline.includes("government")) {
    return "governmentShutdown";
  }
  if (
    headline.includes("crisis") ||
    headline.includes("collapse") ||
    headline.includes("emergency")
  ) {
    return "majorCrisis";
  }

  // V3: Credit risk detection
  if (
    headline.includes("credit spread") ||
    headline.includes("credit default swap") ||
    (headline.includes("high yield") &&
      (headline.includes("spread") ||
        headline.includes("widen") ||
        headline.includes("blow"))) ||
    (headline.includes("junk bond") &&
      (headline.includes("sell") ||
        headline.includes("spread") ||
        headline.includes("stress"))) ||
    (wordMatch(headline, "cds") &&
      (headline.includes("spike") ||
        headline.includes("widen") ||
        headline.includes("surge")))
  ) {
    return "creditSpreadWidening";
  }

  // V3: Yield curve signals
  if (
    (headline.includes("yield curve") ||
      headline.includes("2s10s") ||
      wordMatch(headline, "3m10y") ||
      (headline.includes("2-year") && headline.includes("10-year"))) &&
    (headline.includes("invert") ||
      headline.includes("steepen") ||
      headline.includes("flatten") ||
      headline.includes("uninvert") ||
      headline.includes("signal"))
  ) {
    return "yieldCurveSignal";
  }

  // V3: Liquidity stress
  if (
    headline.includes("repo rate") ||
    headline.includes("ted spread") ||
    headline.includes("dollar funding") ||
    headline.includes("liquidity crunch") ||
    headline.includes("liquidity crisis") ||
    headline.includes("funding stress") ||
    (headline.includes("overnight") &&
      headline.includes("rate") &&
      headline.includes("spike"))
  ) {
    return "liquidityStress";
  }

  // V3: Bank stress
  if (
    (wordMatch(headline, "bank") || headline.includes("banking")) &&
    (headline.includes("stress") ||
      headline.includes("fail") ||
      headline.includes("run") ||
      headline.includes("insolvency") ||
      headline.includes("bailout") ||
      headline.includes("deposit flight") ||
      headline.includes("fdic"))
  ) {
    return "bankStress";
  }

  // V3: Leverage warnings
  if (
    (headline.includes("margin debt") ||
      headline.includes("leverage ratio") ||
      headline.includes("record margin") ||
      headline.includes("margin call")) &&
    (headline.includes("record") ||
      headline.includes("high") ||
      headline.includes("surge") ||
      headline.includes("warning") ||
      headline.includes("cascade"))
  ) {
    return "leverageWarning";
  }

  // Fed/Policy
  if (
    eventType === "feddecision" ||
    wordMatch(headline, "fomc") ||
    /\bfed\b/.test(headline)
  ) {
    if (headline.includes("powell")) return "powellSpeak";
    return "fedDecision";
  }

  // Geopolitical
  if (headline.includes("tariff")) return "tariffs";
  if (headline.includes("china") && wordMatch(headline, "trade"))
    return "chinaTrade";
  if (
    wordMatch(headline, "war") ||
    headline.includes("attack") ||
    headline.includes("missile")
  )
    return "conflict";
  if (eventType === "geopolitical") return "geopolitical";

  // Economic Data
  if (
    eventType === "cpiprint" ||
    wordMatch(headline, "cpi") ||
    headline.includes("consumer price index")
  )
    return "cpiPrint";
  if (
    eventType === "pceprint" ||
    wordMatch(headline, "pce") ||
    headline.includes("personal consumption")
  )
    return "pcePrint";
  if (
    eventType === "nfpprint" ||
    wordMatch(headline, "nfp") ||
    headline.includes("payrolls") ||
    headline.includes("non-farm")
  )
    return "nfpPrint";
  if (wordMatch(headline, "jolts")) return "jolts";
  if (
    eventType === "gdpprint" ||
    wordMatch(headline, "gdp") ||
    headline.includes("gross domestic")
  )
    return "gdpPrint";
  if (
    wordMatch(headline, "ism") ||
    headline.includes("institute for supply management")
  )
    return "ismPrint";

  // Political Commentary
  if (
    headline.includes("trump") ||
    headline.includes("lutnick") ||
    headline.includes("bessent") ||
    headline.includes("senate") ||
    headline.includes("congress") ||
    headline.includes("speaker") ||
    headline.includes("white house") ||
    headline.includes("mnuchin")
  ) {
    return "politicalCommentary";
  }

  // Earnings
  if (eventType === "earnings" || headline.includes("earnings")) {
    const mag7 = ["aapl", "msft", "googl", "amzn", "meta", "nvda", "tsla"];
    if (mag7.some((ticker) => headline.includes(ticker))) {
      return "earningsHighImpact";
    }
    return "earningsMidCap";
  }

  // Other
  if (headline.includes("merger") || headline.includes("acquisition"))
    return "merger";
  if (headline.includes("retail sales")) return "retailSales";

  return "other";
}

// ============================================================================
// MARTINGALE DIMINISHING RETURNS
// ============================================================================

const SESSION_WINDOW_MS = 4 * 60 * 60 * 1000;

interface SessionHeadlineEntry {
  timestamp: number;
  macroLevel: number;
  headline: string;
}

const sessionHeadlines: SessionHeadlineEntry[] = [];

const ESCALATION_KEYWORDS = [
  "military",
  "strike",
  "bomb",
  "invasion",
  "retaliate",
  "mobilize",
  "deploy",
  "attack",
  "offensive",
  "missile",
  "nuclear",
  "blockade",
  "drone",
];

export function isEscalation(headline: string): boolean {
  const lower = headline.toLowerCase();
  return ESCALATION_KEYWORDS.some((kw) => lower.includes(kw));
}

export function getMartingaleMultiplier(
  headline: string,
  macroLevel: number,
): number {
  const now = Date.now();

  while (
    sessionHeadlines.length > 0 &&
    now - sessionHeadlines[0].timestamp > SESSION_WINDOW_MS
  ) {
    sessionHeadlines.shift();
  }

  if (isEscalation(headline)) {
    sessionHeadlines.push({ timestamp: now, macroLevel, headline });
    return 1.0;
  }

  const criticalCount = sessionHeadlines.filter(
    (e) => e.macroLevel >= 3,
  ).length;

  sessionHeadlines.push({ timestamp: now, macroLevel, headline });

  if (criticalCount <= 0) return 1.0;
  if (criticalCount === 1) return 0.6;
  return 0.3;
}

// ============================================================================
// CONTEXTUAL SENTIMENT ENFORCEMENT
// ============================================================================

const FORCED_BEARISH = [
  "bomb",
  "bombing",
  "drone strike",
  "drone attack",
  "airstrike",
  "missile",
  "nuclear",
  "invasion",
  "invade",
  "destroy",
  "destruction",
  "devastat",
  "war crime",
  "genocide",
  "massacre",
  "blockade",
  "siege",
  "crash",
  "collapse",
  "meltdown",
  "default",
  "insolvency",
  "bankruptcy",
  "government shutdown",
  "contagion",
  "bank run",
  "liquidity crisis",
  "panic sell",
  "flash crash",
];

const FORCED_BULLISH = [
  "ceasefire",
  "cease fire",
  "peace deal",
  "peace agreement",
  "peace treaty",
  "de-escalat",
  "deescalat",
  "truce",
  "hostage release",
  "prisoner exchange",
  "diplomatic breakthrough",
  "diplomatic resolution",
  "stimulus package",
  "stimulus plan",
  "record high",
  "all-time high",
  "recession averted",
  "soft landing confirmed",
];

interface ContextRule {
  trigger: string;
  bullishModifiers: string[];
  bearishModifiers: string[];
}

const CONTEXT_RULES: ContextRule[] = [
  {
    trigger: "sanction",
    bullishModifiers: [
      "lift",
      "ease",
      "remov",
      "suspend",
      "waiv",
      "relax",
      "roll back",
    ],
    bearishModifiers: [
      "new",
      "impose",
      "expand",
      "escalat",
      "tighten",
      "additional",
      "sweeping",
    ],
  },
  {
    trigger: "rate",
    bullishModifiers: ["cut", "lower", "reduc", "ease", "dovish", "pause"],
    bearishModifiers: [
      "hike",
      "raise",
      "increas",
      "hawk",
      "tighten",
      "higher for longer",
    ],
  },
  {
    trigger: "tariff",
    bullishModifiers: [
      "remov",
      "reduc",
      "exempt",
      "rollback",
      "repeal",
      "suspen",
      "delay",
      "pause",
    ],
    bearishModifiers: [
      "new",
      "impose",
      "increas",
      "escalat",
      "retaliatory",
      "additional",
      "raise",
      "hike",
    ],
  },
  {
    trigger: "strike",
    bullishModifiers: ["end", "settle", "resolution", "averted"],
    bearishModifiers: [
      "military",
      "air",
      "drone",
      "missile",
      "target",
      "retaliat",
      "launch",
      "bomb",
    ],
  },
  {
    trigger: "conflict",
    bullishModifiers: [
      "resolv",
      "de-escalat",
      "peace",
      "end",
      "wind down",
      "ceasefire",
    ],
    bearishModifiers: [
      "escalat",
      "intensif",
      "spread",
      "widen",
      "new front",
      "expand",
    ],
  },
  {
    trigger: "war",
    bullishModifiers: [
      "end",
      "ceasefire",
      "peace",
      "truce",
      "withdraw",
      "retreat",
    ],
    bearishModifiers: [
      "declar",
      "escalat",
      "expand",
      "new",
      "threaten",
      "mobiliz",
    ],
  },
  {
    trigger: "trade",
    bullishModifiers: ["deal", "agreement", "pact", "cooperat", "open"],
    bearishModifiers: ["war", "disput", "restrict", "ban", "block", "retali"],
  },
  {
    trigger: "recession",
    bullishModifiers: ["averted", "avoid", "exit", "over", "end", "unlikely"],
    bearishModifiers: [
      "enter",
      "confirm",
      "fear",
      "risk",
      "deepen",
      "loom",
      "imminent",
      "warn",
    ],
  },
  {
    trigger: "shutdown",
    bullishModifiers: ["averted", "avoid", "deal", "fund", "reopen"],
    bearishModifiers: [
      "loom",
      "begin",
      "start",
      "partial",
      "full",
      "extend",
      "no deal",
    ],
  },
];

export function enforceSentiment(
  headline: string,
  currentSentiment: string,
): string {
  const lower = headline.toLowerCase();

  if (FORCED_BEARISH.some((kw) => lower.includes(kw))) {
    return "bearish";
  }

  if (FORCED_BULLISH.some((kw) => lower.includes(kw))) {
    return "bullish";
  }

  for (const rule of CONTEXT_RULES) {
    if (!lower.includes(rule.trigger)) continue;

    const hasBullishMod = rule.bullishModifiers.some((m) => lower.includes(m));
    const hasBearishMod = rule.bearishModifiers.some((m) => lower.includes(m));

    if (hasBullishMod && !hasBearishMod) return "bullish";
    if (hasBearishMod && !hasBullishMod) return "bearish";
    if (hasBullishMod && hasBearishMod) {
      const bullCount = rule.bullishModifiers.filter((m) =>
        lower.includes(m),
      ).length;
      const bearCount = rule.bearishModifiers.filter((m) =>
        lower.includes(m),
      ).length;
      if (bullCount > bearCount) return "bullish";
      if (bearCount > bullCount) return "bearish";
      return "bearish";
    }
  }
  return currentSentiment;
}

// ============================================================================
// INSTRUMENT-AWARE SENTIMENT FLIPPER
// ============================================================================

const ASSET_CLASS_MAP: Record<string, string> = {
  "/ES": "equities",
  "/MES": "equities",
  "/NQ": "equities",
  "/MNQ": "equities",
  "/YM": "equities",
  "/MYM": "equities",
  "/RTY": "equities",
  "/M2K": "equities",
  "/GC": "safe-haven",
  "/MGC": "safe-haven",
  "/SI": "precious",
  "/SIL": "precious",
  "/CL": "energy",
  "/MCL": "energy",
  "/NG": "energy",
  "/ZB": "bonds",
  "/ZN": "bonds",
  "/6E": "fx-major",
  "/6J": "fx-major",
  "/6B": "fx-major",
};

type FlipperCategory = "geopolitical" | "monetary" | "economic" | "default";

const EVENT_TYPE_TO_FLIPPER: Record<string, FlipperCategory> = {
  fedDecision: "monetary",
  fomc: "monetary",
  powellSpeak: "monetary",
  cpiPrint: "economic",
  pcePrint: "economic",
  nfpPrint: "economic",
  gdpPrint: "economic",
  ismPrint: "economic",
  jolts: "economic",
  retailSales: "economic",
  creditSpreadWidening: "economic",
  yieldCurveSignal: "economic",
  liquidityStress: "economic",
  bankStress: "economic",
  leverageWarning: "economic",
  geopolitical: "geopolitical",
  conflict: "geopolitical",
  tariffs: "geopolitical",
  chinaTrade: "geopolitical",
  governmentShutdown: "geopolitical",
  earningsHighImpact: "default",
  earningsMidCap: "default",
  merger: "default",
  sectorNews: "default",
  politicalCommentary: "default",
  datacenterHalt: "default",
  majorCrisis: "geopolitical",
  blackSwan: "geopolitical",
  other: "default",
};

type Reaction = "same" | "inverse" | null;

const EVENT_SENTIMENT_REACTIONS: Record<
  FlipperCategory,
  Record<string, Reaction>
> = {
  geopolitical: {
    equities: "same",
    "safe-haven": "inverse",
    precious: "inverse",
    bonds: "inverse",
    energy: "inverse",
    "fx-major": null,
  },
  monetary: {
    equities: "same",
    "safe-haven": "same",
    precious: "same",
    bonds: "same",
    energy: "same",
    "fx-major": "inverse",
  },
  economic: {
    equities: "same",
    "safe-haven": "inverse",
    precious: "inverse",
    bonds: "inverse",
    energy: "same",
    "fx-major": null,
  },
  default: {
    equities: "same",
    "safe-haven": null,
    precious: null,
    bonds: null,
    energy: null,
    "fx-major": null,
  },
};

const RISK_TYPE_TO_FLIPPER: Record<string, FlipperCategory> = {
  Geopolitical: "geopolitical",
  Macro: "economic",
  Credit: "economic",
  Liquidity: "economic",
  Earnings: "default",
  Technical: "default",
  Commentary: "default",
};

export function getFlipperCategory(
  headline: string,
  riskType?: string | null,
): FlipperCategory {
  const parsed = { raw: headline, eventType: riskType ?? "" } as ParsedHeadline;
  const eventType = classifyEventType(parsed);

  const precise = EVENT_TYPE_TO_FLIPPER[eventType];
  if (precise) return precise;

  if (riskType) {
    const broad = RISK_TYPE_TO_FLIPPER[riskType];
    if (broad) return broad;
  }

  return "default";
}

export function getInstrumentSentiment(
  equitySentiment: "bullish" | "bearish",
  headline: string,
  instrument: string,
  riskType?: string | null,
): "bullish" | "bearish" {
  const assetClass = ASSET_CLASS_MAP[instrument];
  if (!assetClass || assetClass === "equities") return equitySentiment;

  const category = getFlipperCategory(headline, riskType);
  const reactions = EVENT_SENTIMENT_REACTIONS[category];
  const reaction = reactions[assetClass] ?? null;

  if (reaction === "inverse") {
    return equitySentiment === "bullish" ? "bearish" : "bullish";
  }
  return equitySentiment;
}

// ============================================================================
// SESSION BASELINE FOR DELTA DISPLAY
// ============================================================================

let _sessionBaselinePoints = 0;
let _sessionBaselineTs = 0;

export function getSessionBaselinePoints(): number {
  const now = Date.now();
  if (now - _sessionBaselineTs > SESSION_WINDOW_MS) {
    _sessionBaselinePoints = 0;
    _sessionBaselineTs = now;
  }
  return _sessionBaselinePoints;
}

export function addToSessionBaseline(deltaPoints: number): void {
  const now = Date.now();
  if (now - _sessionBaselineTs > SESSION_WINDOW_MS) {
    _sessionBaselinePoints = 0;
    _sessionBaselineTs = now;
  }
  _sessionBaselinePoints += deltaPoints;
}
