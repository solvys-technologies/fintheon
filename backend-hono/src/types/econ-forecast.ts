// [Codex 2026-05-27] S102 PIC macro event-risk forecast contract.
// [claude-code 2026-05-15] Econ forecast types for Desk Plan replacement —
//   replaces invalidation/profit-target/entries/prices-of-interest with
//   AI-generated miss/beat scenarios and prediction text.

export interface EconForecastScenario {
  /** What the print would need to be for this scenario to materialize */
  description: string;
  /** Whether this outcome would be bullish (true) or bearish (false) for equities */
  isBullishForEquities: boolean;
  /** Probability 0-100 */
  probability: number;
}

export interface EconForecast {
  calendarConsensus: string | null;
  /** PIC forecasted actual value/tone only; thesis text belongs in aiPrediction. */
  picInternalForecast: string;
  missProbability: number;
  beatProbability: number;
  confidenceScore: number;
  forecastDeltaVsConsensus: string;
  dataCycleStage: string;
  fedMilestoneAnchor: string;
  secondOrderRead: string;
  crossAssetTransmission: string;
  whatConfirms: string;
  whatInvalidates: string;
  commandmentChecks: string[];
  /** Numerical forecast value, or "hawkish"/"dovish"/"none" for speeches */
  forecast: string;
  /** Miss scenario */
  miss: EconForecastScenario;
  /** Beat scenario */
  beat: EconForecastScenario;
  /** Other notable events happening at the same time */
  otherNotableEvents: string[];
  /** Quick AI agent prediction (1-3 sentences, actionable) */
  aiPrediction: string;
  /** ISO timestamp of when this forecast was generated */
  generatedAt: string;
}

export interface EconEventSource {
  id?: string;
  name: string;
  date?: string;
  time?: string;
  country?: string;
  impact?: string;
  category?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
  detail?: string;
}
