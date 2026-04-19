-- [claude-code 2026-04-18] Guarded against missing scored_riskflow_items.
-- On a freshly provisioned Supabase project the base table may not exist yet
-- (it is created by the backend's feed ingestion path or by an older legacy
-- schema import), so we wrap the ALTER in a DO block that checks
-- information_schema first and no-ops with a NOTICE otherwise.
-- Catalyst promotion columns on scored_riskflow_items
-- Items graduate from "fresh headline" to "catalyst" when the promotion service runs

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scored_riskflow_items'
  ) THEN
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
  ELSE
    RAISE NOTICE 'scored_riskflow_items does not exist yet — skipping catalyst promotion columns. Re-run this migration after the base table is created.';
  END IF;
END $$;
