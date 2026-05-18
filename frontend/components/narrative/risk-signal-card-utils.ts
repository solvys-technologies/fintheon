const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface RiskSignal {
  id: string;
  title: string;
  summary: string;
  analysis: string;
  direction?: "bullish" | "bearish" | "neutral";
  refinementStatus?: "agentic" | "pending-refinement";
  score: number;
  severity: "critical" | "high" | "medium" | "low";
  source: "bulletin" | "catalyst-watch" | "risk-detector";
  relatedHeadlines: string[];
  narrativeThreads: string[];
  generatedAt: string;
}

export interface RiskSignalPayload {
  signals: RiskSignal[];
  staleSignals?: RiskSignal[];
  generatedAt?: string;
  cached?: boolean;
  stale?: boolean;
  freshnessStatus?: "fresh" | "empty" | "stale-cache" | "generation-error";
  inputCounts?: { bulletins: number; catalysts: number };
}

export interface CachedSignals {
  signals: RiskSignal[];
  generatedAt: string | null;
  stale: boolean;
  freshnessStatus: RiskSignalPayload["freshnessStatus"];
}

export const SOURCE_LABEL: Record<string, string> = {
  bulletin: "Bulletin",
  "catalyst-watch": "Catalyst",
  "risk-detector": "Systemic",
};

export function scoreColor(score: number): string {
  if (score >= 8) return "var(--fintheon-bearish)";
  if (score >= 6) return "#f97316";
  if (score >= 4) return "var(--fintheon-accent)";
  return "var(--fintheon-muted)";
}

export function isFreshGenerated(generatedAt: string | null | undefined) {
  if (!generatedAt) return false;
  const generatedMs = new Date(generatedAt).getTime();
  return (
    Number.isFinite(generatedMs) && Date.now() - generatedMs < STALE_AFTER_MS
  );
}

export function formatAge(generatedAt: string | null | undefined): string {
  if (!generatedAt) return "unknown";
  const hours = Math.max(
    0,
    (Date.now() - new Date(generatedAt).getTime()) / 3_600_000,
  );
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function emptyCachedSignals(): CachedSignals {
  return {
    signals: [],
    generatedAt: null,
    stale: false,
    freshnessStatus: "empty",
  };
}
