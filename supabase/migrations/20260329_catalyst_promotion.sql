-- Catalyst promotion columns on scored_riskflow_items
-- Items graduate from "fresh headline" to "catalyst" when the promotion service runs

ALTER TABLE scored_riskflow_items
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- Index for promotion queries: find unpromoted scored items older than 30 min
CREATE INDEX IF NOT EXISTS idx_scored_unpromoted
  ON scored_riskflow_items (promoted_at, created_at)
  WHERE promoted_at IS NULL AND macro_level >= 2;

-- Index for narrative feed queries: promoted items sorted by published_at
CREATE INDEX IF NOT EXISTS idx_scored_promoted
  ON scored_riskflow_items (promoted_at DESC)
  WHERE promoted_at IS NOT NULL;
