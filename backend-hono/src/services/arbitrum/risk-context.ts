// [Codex 2026-05-27] Builds S102 headwind/tailwind risk context for Arbitrum.
import { getFeed } from "../riskflow/feed-service.js";
import type { FeedItem } from "../../types/riskflow.js";
import type { ArbitrumRiskContext } from "./types.js";

const WINDOW_DAYS = 7 as const;

export async function loadArbitrumRiskContext(): Promise<ArbitrumRiskContext> {
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const feed = await getFeed("arbitrum-risk-context", {
    limit: 120,
    minIvScore: 2,
  });
  const items = (feed.items ?? []).filter(
    (item) => new Date(item.publishedAt).getTime() >= cutoff,
  );
  const headwinds = summarizeRisks(items, "bearish");
  const tailwinds = summarizeRisks(items, "bullish");

  return {
    riskSignalWindowDays: WINDOW_DAYS,
    headwindRisks: headwinds.length
      ? headwinds
      : ["No fresh bearish L2+ RiskFlow packet."],
    tailwindRisks: tailwinds.length
      ? tailwinds
      : ["No fresh bullish L2+ RiskFlow packet."],
    wallStreetPrepositioning: summarizePositioning(items),
    wallStreetForecasts: summarizeForecasts(items),
    rateFuturesRead:
      "Rate-futures read unavailable in current context; treat as a required confirmation input.",
    sectorRotationRisk: summarizeSectorRisk(items),
    htfLtfConfluence:
      "Required before futures entries: HTF context, LTF trigger, and event window must agree.",
    multiInstrumentCorrelation:
      "Required before futures entries: NQ, ES, YM/RTY, VIX, DXY, and rates must confirm.",
    volatilityGate: {
      vix: "Use current VIX/watchlist context before entry.",
      bonds: "Use US02Y/US10Y/US30Y or bond futures confirmation before entry.",
      greeks:
        "Public/options Greeks input pending when credentials are missing.",
      status: items.some((item) => (item.ivScore ?? 0) >= 8)
        ? "mixed"
        : "clear",
    },
    basisAdjustedGexReference: "pending-separate-gex-thread",
    firstOrderConclusion: "Chamber must produce this after seat deliberation.",
    caoSecondOrderInsight:
      "Harper must synthesize this after the first-order read.",
    eventRiskTimedEntryRead:
      "Only viable if the event window, volatility gate, and correlation agree.",
    expectedPointOpportunity:
      "Estimate after VIX, bonds, Greeks, and tape context are loaded.",
  };
}

function summarizeRisks(items: FeedItem[], sentiment: "bullish" | "bearish") {
  return items
    .filter((item) => item.sentiment === sentiment)
    .sort((a, b) => (b.ivScore ?? 0) - (a.ivScore ?? 0))
    .slice(0, 6)
    .map((item) => `[IV ${item.ivScore ?? "?"}] ${item.headline}`);
}

function summarizeForecasts(items: FeedItem[]): string[] {
  return items
    .filter((item) =>
      /forecast|consensus|estimate|expects?|rate|cpi|pce|jobs/i.test(
        item.headline,
      ),
    )
    .slice(0, 5)
    .map((item) => item.headline);
}

function summarizePositioning(items: FeedItem[]): string {
  const crowded = items.find((item) =>
    /position|crowd|hedge|dealer|short|long|futures|options/i.test(
      item.headline,
    ),
  );
  return crowded
    ? crowded.headline
    : "No explicit positioning headline in the seven-day RiskFlow packet.";
}

function summarizeSectorRisk(items: FeedItem[]): string {
  const sector = items.find((item) =>
    /rotation|banks|tech|semis|small caps|utilities|real estate|yields/i.test(
      item.headline,
    ),
  );
  return sector
    ? sector.headline
    : "No explicit sector-rotation headline in the seven-day RiskFlow packet.";
}
