// [claude-code 2026-04-16] S20-T3: Oracle scheduled research — type definitions

export interface OracleResearchFinding {
  id?: string;
  finding_type: FindingType;
  platform: Platform;
  contract_id: string;
  contract_title: string;
  current_price: number;
  iv_cross_score: number;
  riskflow_correlation: string;
  analysis: string;
  confidence: number;
  created_at?: string;
  expires_at?: string;
  status: FindingStatus;
}

export type FindingType =
  | "arb_opportunity"
  | "divergence_analysis"
  | "market_signal";

export type Platform = "kalshi" | "polymarket" | "cross";

export type FindingStatus = "active" | "resolved" | "expired";

export interface ScannedContract {
  platform: Platform;
  contractId: string;
  title: string;
  category: string;
  yesPrice: number;
  volume24h: number;
  priceChange24h: number;
}

export interface ArbCandidate {
  polymarketSlug: string;
  polymarketPrice: number;
  kalshiTicker: string;
  kalshiPrice: number;
  divergencePct: number;
  matchedThemes: string[];
  ivCrossScore: number;
}

/** Subjects Oracle tracks — aligned with agent dossier */
export const ORACLE_SUBJECTS = [
  "macro",
  "monetary-policy",
  "prediction-markets",
  "regime",
  "geopolitical",
  "trade-policy",
  "energy",
  "inflation",
] as const;

export type OracleSubject = (typeof ORACLE_SUBJECTS)[number];
