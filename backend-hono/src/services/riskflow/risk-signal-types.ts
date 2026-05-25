export interface RiskSignal {
  id: string;
  title: string;
  summary: string;
  analysis: string;
  direction: "bullish" | "bearish" | "neutral";
  refinementStatus: "agentic" | "pending-refinement";
  score: number;
  severity: "critical" | "high" | "medium" | "low";
  source: "bulletin" | "catalyst-watch" | "risk-detector";
  relatedHeadlines: string[];
  narrativeThreads: string[];
  generatedAt: string;
}

export interface RiskSignalResult {
  signals: RiskSignal[];
  staleSignals: RiskSignal[];
  generatedAt: string;
  sourceWindow: { bulletinsHours: number; catalystsHours: number };
  inputCounts: { bulletins: number; catalysts: number };
  cached: boolean;
  stale: boolean;
  freshnessStatus: "fresh" | "empty" | "stale-cache" | "generation-error";
  diagnostics?: { staleGeneratedAt?: string | null; reason?: string };
}

export interface CatalystCandidate {
  headline: string;
  sentiment: string;
  ivScore: number;
  macroLevel: number;
  publishedAt: string;
}

export const RISK_SIGNAL_SOURCE_WINDOW = {
  bulletinsHours: 24,
  catalystsHours: 24,
};
