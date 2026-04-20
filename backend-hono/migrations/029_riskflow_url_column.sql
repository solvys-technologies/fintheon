-- [claude-code 2026-04-19] Real `url` column for riskflow items.
-- Source URLs were living inside `tags` as `"url:https://..."` strings, which
-- meant cards couldn't reliably render a back-link or preview. This migration
-- adds a first-class column to both raw + scored tables and indexes the
-- still-null rows so the backfill routine can find them cheaply.

ALTER TABLE raw_riskflow_items ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE scored_riskflow_items ADD COLUMN IF NOT EXISTS url TEXT;

CREATE INDEX IF NOT EXISTS idx_scored_url_null_published
  ON scored_riskflow_items(published_at)
  WHERE url IS NULL;
