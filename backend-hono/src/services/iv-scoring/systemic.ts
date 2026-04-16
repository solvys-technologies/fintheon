// [claude-code 2026-04-16] S20-T9: Split from iv-scoring-v2.ts — event classifier, martingale
// [claude-code 2026-04-16] Sentiment, flipper, session baseline extracted to sentiment.ts
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
