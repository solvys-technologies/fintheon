// Local Arbitrum types — mirror T2's migration columns. Kept local to avoid
// T9 merge conflicts (it renames frontend/types/agent-desk.ts → arbitrum.ts).
//
// Columns mirrored from arbitrum_verdicts / arbitrum_seats tables.
//
// [claude-code 2026-05-01] S56 Track A: added SeatOverride, ArbitrumHealth types for
//   the settings/health panel.

export type ArbitrumSeatRole =
  | "Lead"
  | "Forecaster"
  | "Future PM"
  | "Quant"
  | "Skeptic";

export interface ArbitrumSeat {
  role: ArbitrumSeatRole;
  model: string;
  probability: number;
  confidence: number;
  rationale: string;
  dissented?: boolean;
}

export interface ArbitrumDissent {
  seat: ArbitrumSeatRole | string;
  magnitude_pp: number;
  rationale?: string | null;
}

export type ArbitrumPhase = "convening" | "running" | "complete";

export interface ArbitrumVerdict {
  id: string;
  created_at: string;
  consensus_probability: number;
  confidence: number;
  digest_text: string;
  dissent?: ArbitrumDissent | null;
  seats?: ArbitrumSeat[];
  rounds_total?: number;
  rounds_complete?: number;
  phase?: ArbitrumPhase;
  trigger?: "scheduled" | "iv_threshold" | "manual" | string;
  question?: string;
  category?: string;
}

// ── S56 Track A: health + override types ──

export interface SeatOverride {
  seat_id: string;
  override_prompt: string;
  context_sources: string[];
  category_filter: string;
  has_override: boolean;
  updated_at: string;
}

export interface ArbitrumHealth {
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
