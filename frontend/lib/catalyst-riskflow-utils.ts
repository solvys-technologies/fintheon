// [claude-code 2026-04-30] Adapters that let NarrativeFlow catalyst surfaces use
// the same RiskFlow card anatomy without changing the stored catalyst contract.
import type { CatalystCard } from "./narrative-types";
import type { FuseSeverity } from "./fuse-palette";
import type { IVStackDirection } from "../components/shared/IVStack";

export function catalystSeverityToFuse(
  severity: CatalystCard["severity"],
): FuseSeverity {
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

export function catalystFuseScore(card: CatalystCard): number {
  const marketPercent =
    card.marketImpact?.nq?.percent ??
    card.marketImpact?.es?.percent ??
    card.marketImpact?.ym?.percent;
  if (marketPercent != null && Number.isFinite(Number(marketPercent))) {
    return Math.max(1, Math.min(10, Math.abs(Number(marketPercent)) * 2));
  }
  if (card.severity === "high") return 8;
  if (card.severity === "medium") return 5;
  return 3;
}

export function catalystIvScore(card: CatalystCard): number {
  return catalystFuseScore(card);
}

export function catalystDirection(card: CatalystCard): IVStackDirection {
  const bias = card.directionBias ?? card.sentiment;
  if (bias === "bullish") return "Bullish";
  if (bias === "bearish") return "Bearish";
  return "Neutral";
}

export function catalystSourceLabel(card: CatalystCard): string {
  if (card.source === "riskflow" || card.source === "riskflow-import") {
    return "RiskFlow";
  }
  if (card.source === "brief") return "Brief";
  if (card.source === "agent") return "Agent";
  if (card.source === "research") return "Research";
  if (card.source === "rss") return "RSS";
  return "Catalyst";
}
