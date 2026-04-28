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
  roleSubtitle: string;
  displayName: string;
  model: string;
  provider: ArbitrumProvider;
  weight: number;
  persona: string;
  temperature: number;
  fallback?: ArbitrumSeatFallback;
}

export interface ArbitrumSeatTranscript {
  id: ArbitrumSeatId;
  role: string;
  roleSubtitle: string;
  displayName: string;
  model: string;
  provider: ArbitrumProvider;
  weight: number;
  temperature: number;
  rounds: ArbitrumSeatRound[];
}

export interface ArbitrumSeatRound {
  round: number;
  probability: number;
  confidence: number;
  rationale: string;
  risks: string[];
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

export interface ArbitrumCommentaryContext {
  windowHours: number;
  entries: Array<{
    title: string;
    sourceUrl: string;
    watchedAt: string;
    summary: string;
  }>;
}

export interface ArbitrumDeliberateInput {
  question: string;
  category: string;
  context?: string;
  iv_simulation?: ArbitrumIvSimulation | null;
  econ_context?: ArbitrumEconContext | null;
  commentary_context?: ArbitrumCommentaryContext | null;
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
