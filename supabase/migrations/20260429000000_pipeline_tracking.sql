-- [claude-code 2026-04-28] S48-T1: ingest_pipeline tracking — per-item pipeline label,
-- pipeline toggle state table, and indexes for stats queries.

-- Add ingest_pipeline to raw items
ALTER TABLE raw_riskflow_items ADD COLUMN IF NOT EXISTS ingest_pipeline text;

-- Add ingest_pipeline to scored items
ALTER TABLE scored_riskflow_items ADD COLUMN IF NOT EXISTS ingest_pipeline text;

-- Index for stats queries
CREATE INDEX IF NOT EXISTS idx_raw_ingest_pipeline_created
  ON raw_riskflow_items(ingest_pipeline, created_at);

CREATE INDEX IF NOT EXISTS idx_scored_ingest_pipeline_created
  ON scored_riskflow_items(ingest_pipeline, published_at);

-- Pipeline toggle state table
CREATE TABLE IF NOT EXISTS ingest_pipeline_state (
  pipeline_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- Seed default rows
-- [claude-code 2026-04-29] S48-T5: added kalshi-whale to seed so the toggle
-- shows up in the Refinement Engine pipeline list immediately. Default
-- enabled=true matches every other pipeline.
INSERT INTO ingest_pipeline_state (pipeline_id, enabled) VALUES
  ('x-syndication', true),
  ('xactions', true),
  ('agent-reach-nitter', true),
  ('browser-harness', true),
  ('rettiwt-commentary', true),
  ('economic-calendar', true),
  ('kalshi-whale', true)
ON CONFLICT (pipeline_id) DO NOTHING;
