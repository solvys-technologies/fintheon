// [claude-code 2026-03-16] IV prediction types — next-session forecast layer

export interface IVPredictionScenario {
  label: string;
  probability: number;
  projectedScore: number;
}

export interface IVPrediction {
  /** Forecasted next-session IV score */
  nextSessionScore: number;
  /** Model confidence 0-1 */
  confidence: number;
  /** Probability of a regime shift (score moving ±3 or more) */
  regimeShiftProbability: number;
  /** Top scenarios ranked by probability */
  scenarios: IVPredictionScenario[];
  /** Source of the prediction */
  source: "agentDesk" | "heuristic";
  /** When the prediction was generated */
  generatedAt: string;
}
