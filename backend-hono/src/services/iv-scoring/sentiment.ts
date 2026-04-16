// [claude-code 2026-04-16] Split from systemic.ts — sentiment enforcement, instrument flipper, session baseline
// [claude-code 2026-04-16] Data constants extracted to sentiment-data.ts
import type { ParsedHeadline } from "../../types/news-analysis.js";
import { classifyEventType } from "./systemic.js";
import {
  FORCED_BEARISH,
  FORCED_BULLISH,
  CONTEXT_RULES,
  ASSET_CLASS_MAP,
  EVENT_TYPE_TO_FLIPPER,
  EVENT_SENTIMENT_REACTIONS,
  RISK_TYPE_TO_FLIPPER,
  type FlipperCategory,
} from "./sentiment-data.js";

// ============================================================================
// CONTEXTUAL SENTIMENT ENFORCEMENT
// ============================================================================

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

const SESSION_WINDOW_MS = 4 * 60 * 60 * 1000;

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
