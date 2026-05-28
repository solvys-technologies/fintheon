// [Codex 2026-05-27] S102 mandatory macro event-risk context for chamber runs.
// [claude-code 2026-05-01] S56 Track A: added SeatOverride, ArbitrumHealth, and
//   ArbitrumHealthResponse types for the settings/health panel endpoints.
// [claude-code 2026-04-24] S35-T1: Arbitrum type surface.
// Mirrors the columns of arbitrum_verdicts (T2 migration) and the seat
// config consumed by seats.ts / facilitator.ts / gates.ts / verdict-store.ts.

import type { ArbitrumProvider } from "../hermes-service.js";

export type ArbitrumSeatId = "lead" | "forecaster" | "risk" | "quant" | "bear";

export type ArbitrumTriggerType = "event" | "session" | "manual";

export type ArbitrumRunPresetId =
  | "volatility-forecast"
  | "roro"
  | "looming-swans"
  | "behavioral-policy-theme"
  | "buy-dip-sell-rip"
  | "fed-scout"
  | "signal-check";

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

export interface ArbitrumRiskContext {
  riskSignalWindowDays: 7;
  headwindRisks: string[];
  tailwindRisks: string[];
  wallStreetPrepositioning: string;
  wallStreetForecasts: string[];
  rateFuturesRead: string;
  sectorRotationRisk: string;
  htfLtfConfluence: string;
  multiInstrumentCorrelation: string;
  volatilityGate: {
    vix: string;
    bonds: string;
    greeks: string;
    status: "clear" | "mixed" | "blocked";
  };
  basisAdjustedGexReference: string | null;
  firstOrderConclusion: string;
  caoSecondOrderInsight: string;
  eventRiskTimedEntryRead: string;
  expectedPointOpportunity: string;
}

export interface ArbitrumDeliberateInput {
  question: string;
  category: string;
  context?: string;
  iv_simulation?: ArbitrumIvSimulation | null;
  econ_context?: ArbitrumEconContext | null;
  commentary_context?: ArbitrumCommentaryContext | null;
  risk_context?: ArbitrumRiskContext | null;
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
  preset_ids?: ArbitrumRunPresetId[];
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
  risk_context?: ArbitrumRiskContext | null;
  latency_ms?: number;
  model_cost_usd?: number;
}

// ── S56 Track A: seat override + health types ──

export interface SeatOverride {
  seat_id: ArbitrumSeatId;
  override_prompt: string;
  context_sources: string[];
  category_filter: string;
  updated_at: string;
}

export interface SeatOverrideRow {
  seat_id: string;
  override_prompt: string;
  context_sources: string[];
  category_filter: string;
  updated_at: string;
}

export interface ArbitrumHealthResponse {
  timestamp: string;
  api_status: {
    deepseek_reachable: boolean;
    deepseek_api_key_set: boolean;
    last_latency_ms: number | null;
    last_error: string | null;
  };
  context_injection: {
    econ_context_loaded: boolean;
    econ_prints_count: number;
    commentary_loaded: boolean;
    commentary_entries_count: number;
    iv_simulation_present: boolean;
    riskflow_feed_injected: boolean;
  };
  last_confidence: {
    verdict_id: string | null;
    created_at: string | null;
    seats: Array<{
      seat_id: string;
      probability: number;
      confidence: number;
    }>;
    chamber_confidence: number;
  } | null;
  chamber_state: "idle" | "running" | "complete";
}
