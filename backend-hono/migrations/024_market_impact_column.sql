-- Add market_impact JSONB column to scored_riskflow_items
-- Stores NQ/ES/YM daily close performance for HIGH/CRITICAL events

ALTER TABLE scored_riskflow_items
ADD COLUMN IF NOT EXISTS market_impact JSONB DEFAULT NULL;

-- Index for finding items needing enrichment
CREATE INDEX IF NOT EXISTS idx_scored_items_market_impact_null
ON scored_riskflow_items (macro_level, created_at)
WHERE market_impact IS NULL AND macro_level >= 3;
