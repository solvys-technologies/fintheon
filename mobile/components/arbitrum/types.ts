// [claude-code 2026-05-16] Ported from desktop types for mobile arbitrum alignment.

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
