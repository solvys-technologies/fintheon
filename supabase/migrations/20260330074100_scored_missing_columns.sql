-- [claude-code 2026-04-18] Guarded against missing scored_riskflow_items (same
-- pattern as 20260329_catalyst_promotion.sql). Skips on fresh DBs.
-- S10-T1b: Add ALL missing columns to scored_riskflow_items
-- Fixes: "Could not find the 'agent_note' column", "column scored_riskflow_items.market_impact does not exist"
-- Also adds sub_scores, risk_type, instrument_scores that were missing from base table

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scored_riskflow_items'
  ) THEN
    ALTER TABLE scored_riskflow_items
      ADD COLUMN IF NOT EXISTS agent_note              TEXT,
      ADD COLUMN IF NOT EXISTS agent_note_generated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS econ_data               JSONB,
      ADD COLUMN IF NOT EXISTS market_impact           JSONB,
      ADD COLUMN IF NOT EXISTS sub_scores              JSONB,
      ADD COLUMN IF NOT EXISTS risk_type               TEXT,
      ADD COLUMN IF NOT EXISTS instrument_scores       JSONB;

    -- Index for market_impact queries (used by market-impact-enricher cron)
    CREATE INDEX IF NOT EXISTS idx_scored_market_impact
      ON scored_riskflow_items USING gin (market_impact)
      WHERE market_impact IS NOT NULL;

    -- Index for instrument_scores queries
    CREATE INDEX IF NOT EXISTS idx_scored_instrument_scores
      ON scored_riskflow_items USING gin (instrument_scores)
      WHERE instrument_scores IS NOT NULL;

    -- Index for risk_type filtering
    CREATE INDEX IF NOT EXISTS idx_scored_risk_type
      ON scored_riskflow_items (risk_type)
      WHERE risk_type IS NOT NULL;
  ELSE
    RAISE NOTICE 'scored_riskflow_items does not exist yet — skipping column backfill. Re-run this migration after the base table is created.';
  END IF;
END $$;
