-- S9-T2b: Per-instrument sentiment scores for historical analysis
-- Lazily populated when users request non-/ES instruments via the feed handler.
-- Structure: { "/GC": { "sentiment": "Bullish", "impliedPoints": 6.6 }, ... }

ALTER TABLE scored_riskflow_items
ADD COLUMN IF NOT EXISTS instrument_scores JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_scored_instrument_scores
ON scored_riskflow_items USING gin (instrument_scores);
