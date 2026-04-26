// [claude-code 2026-04-24] S35-T1: Arbitrum type surface.
// Mirrors the columns of arbitrum_verdicts (T2 migration) and the seat
// config consumed by seats.ts / facilitator.ts / gates.ts / verdict-store.ts.

import type { ArbitrumProvider } from "../hermes-service.js";

export type ArbitrumSeatId = "lead" | "forecaster" | "risk" | "quant" | "bear";

export type ArbitrumTriggerType = "event" | "session" | "manual";

export interface ArbitrumSeatFallback {
  model: string;
  provider: ArbitrumProvider;
}

export interface ArbitrumSeatConfig {
  id: ArbitrumSeatId;
  role: string;
  model: string;
  provider: ArbitrumProvider;
  weight: number;
  persona: string;
  fallback?: ArbitrumSeatFallback;
}

// [claude-code 2026-04-26] S35-T13: forward_5d added so seats project
// 5 days out from the current chamber question. Optional for backwards
// compat; older verdicts may lack it.
export interface ArbitrumForward5d {
  thesis: string;
  catalysts_to_watch: string[];
  confidence: number;
}

export interface ArbitrumSeatRound {
  round: number;
  probability: number;
  confidence: number;
  rationale: string;
  risks: string[];
  forward_5d?: ArbitrumForward5d | null;
}

export interface ArbitrumSeatTranscript {
  id: ArbitrumSeatId;
  role: string;
  model: string;
  provider: ArbitrumProvider;
  weight: number;
  rounds: ArbitrumSeatRound[];
}

export interface ArbitrumIvSimulation {
  baseline: number;
  consensus: number;
  dissent_delta?: number;
}

export interface ArbitrumEconPrintLine {
  date: string | null;
  name: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  surprise: number | null;
  direction: "beat" | "miss" | "inline" | null;
}

export interface ArbitrumEconContext {
  windowDays: number;
  prints: ArbitrumEconPrintLine[];
  upcoming: Array<{
    date: string;
    time: string | null;
    name: string;
    country: string | null;
  }>;
}

// [claude-code 2026-04-26] S35-T13: 30d RiskFlow tape + recent verdicts
// fed into every chamber run so seats reason against the full landscape.
export interface ArbitrumNewsContextRef {
  windowDays: number;
  riskflow: Array<{
    date: string | null;
    iv: number | null;
    speaker: string | null;
    source: string | null;
    headline: string;
  }>;
  verdicts: Array<{
    date: string | null;
    category: string | null;
    question: string;
    consensus: number | null;
    confidence: number | null;
    dissent: string | null;
  }>;
}

export interface ArbitrumDeliberateInput {
  question: string;
  category: string;
  context?: string;
  iv_simulation?: ArbitrumIvSimulation | null;
  econ_context?: ArbitrumEconContext | null;
  news_context?: ArbitrumNewsContextRef | null;
}

export interface ArbitrumDissent {
  seat: ArbitrumSeatId | string;
  rationale: string;
  magnitude_pp: number;
}

export interface ArbitrumGatesSurfaced {
  consensus_spread_pp: number;
  category_quality: number;
  calibration_watermark: number;
}

export interface ArbitrumTriggerSource {
  riskflow_item_id?: string | null;
  speaker?: string | null;
  iv_score?: number | null;
}

export interface ArbitrumVerdict {
  verdict_id: string;
  created_at: string;
  trigger_type: ArbitrumTriggerType;
  question: string;
  category: string;
  seats: ArbitrumSeatTranscript[];
  consensus_probability: number;
  confidence: number;
  dissent: ArbitrumDissent | null;
  gates_surfaced: ArbitrumGatesSurfaced;
  digest_text: string;
  iv_simulation?: ArbitrumIvSimulation | null;
  trigger_source?: ArbitrumTriggerSource | null;
  latency_ms?: number;
  model_cost_usd?: number;
}
