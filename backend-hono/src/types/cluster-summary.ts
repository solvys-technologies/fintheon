// [claude-code 2026-04-24] S36 ClusterBeam — shared types for cluster summarizer service + route.

export type DominantSentiment = "bullish" | "bearish" | "mixed";

export interface ClusterSummaryCard {
  id: string;
  title: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  severity?: "low" | "medium" | "high";
  date?: string;
  ivScore?: number;
}

export interface ClusterSummaryInput {
  groupId: string;
  narrativeSlug?: string;
  narrativeTitle?: string;
  cards: ClusterSummaryCard[];
}

export interface ClusterSummary {
  one_liner: string;
  bullets: string[];
  dominant_sentiment: DominantSentiment;
  dominant_sentiment_confidence: number;
  notable_tickers: string[];
}

export interface ClusterSummaryResponse extends ClusterSummary {
  cached: boolean;
  ts: string;
}
