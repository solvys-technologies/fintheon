// [claude-code 2026-04-24] S34-T10: types for historical econ event backfill orchestrator.

export type BackfillStatus =
  | "pending"
  | "claimed"
  | "enriching"
  | "complete"
  | "failed";

export interface BackfillSlice {
  id: string;
  slice_start: string; // ISO date YYYY-MM-DD
  slice_end: string;
  country: string;
  status: BackfillStatus;
  claimed_at: string | null;
  completed_at: string | null;
  rows_written: number;
  error: string | null;
  created_at: string;
}

/** Raw LLM output for one slice, stored verbatim in econ_backfill_queue.raw_payload. */
// [claude-code 2026-04-26] S35-T12: openrouter-llama / openrouter-mistral
// dropped — no paid APIs. Slices now sourced from Hermes (Ollama Cloud
// Qwen3.5:397b-cloud) and FRED.
export interface RawSlicePayload {
  source: "hermes-qwen" | "hermes-qwen-fallback" | "fred" | "mixed";
  slice_id: string;
  country: string;
  slice_start: string;
  slice_end: string;
  fetched_at: string;
  events: RawBackfillEvent[];
}

export interface RawBackfillEvent {
  name: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM ET, null if all-day
  forecast: string | null;
  actual: string | null;
  previous: string | null;
  detail: string | null;
  impact: "low" | "medium" | "high" | null;
  source_hint?: string;
}

/** Harper-normalized event, ready for idempotent upsert into economic_events. */
export interface NormalizedBackfillEvent {
  country: string;
  category: "Fiscal" | "Supply Chain" | "Inflation" | "Job Market" | "Speaker";
  name: string;
  date: string;
  time: string | null;
  forecast: string | null;
  actual: string | null;
  previous: string | null;
  detail: string | null;
  impact: "low" | "medium" | "high" | null;
  event_key: string; // sha256(name|date|time|country)
}

export interface BackfillDiagnostics {
  last_run_at: string | null;
  slices_pending: number;
  slices_claimed: number;
  slices_enriching: number;
  slices_complete: number;
  slices_failed: number;
  rows_written_total: number;
  harper_tokens_week: number;
}
