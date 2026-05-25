// [claude-code 2026-05-16] S68-T2: Catalyst drift types

export type DriftDirection = "positive" | "negative" | "neutral";

export interface DriftResult {
  themeId: string;
  magnitude: number;
  direction: DriftDirection;
  confidence: number;
  period: number;
  currentIPV: number;
  historicalAvgIPV: number;
}
