// [claude-code 2026-04-28] S48-T1: Pipeline tracking types — ingest_pipeline enum,
// pipeline state row, and per-pipeline aggregate stats.

export const INGEST_PIPELINES = [
  "x-syndication",
  "xactions",
  "agent-reach-nitter",
  "browser-harness",
  "rettiwt-commentary",
  "economic-calendar",
  "kalshi-whale", // T2 will use this
] as const;

export type IngestPipeline = (typeof INGEST_PIPELINES)[number];

export interface PipelineState {
  pipeline_id: string;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface PipelineStats {
  pipeline_id: string;
  headline_count: number;
  error_count: number;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  uptime_pct: number;
}
