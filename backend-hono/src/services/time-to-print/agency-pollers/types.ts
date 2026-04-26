// [claude-code 2026-04-25] S40-P4: agency poller shared types.

export type AgencyId = "bls" | "bea" | "frb" | "census" | "edgar" | "treasury";

export type EconEventKey =
  | "cpi"
  | "ppi"
  | "empsit"
  | "nfp"
  | "jolts"
  | "eci"
  | "prod2"
  | "gdp"
  | "pce"
  | "personal-income"
  | "fomc"
  | "retail-sales"
  | "housing-starts"
  | "durable-goods"
  | "edgar-8k"
  | "treasury-offering";

export interface AgencyReleaseDescriptor {
  agency: AgencyId;
  eventKey: EconEventKey;
  url: string;
  description: string;
}

export interface PrintExtraction {
  eventKey: EconEventKey;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  commentary?: string;
}

export interface BurstResult {
  ok: boolean;
  printedAt: string;
  extraction?: PrintExtraction;
  reason?: string;
  pollCount: number;
  durationMs: number;
}
