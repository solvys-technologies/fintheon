-- [claude-code 2026-04-19] S24-T3: Add rescored_at column to scored_riskflow_items
-- Populated by the V4 rescore-all migration job so we can distinguish V3-scored from V4-rescored items.
ALTER TABLE scored_riskflow_items
  ADD COLUMN IF NOT EXISTS rescored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scored_riskflow_items_rescored_at
  ON scored_riskflow_items (rescored_at DESC)
  WHERE rescored_at IS NOT NULL;
