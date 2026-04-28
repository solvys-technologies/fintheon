-- S47-T1: Add method column to riskflow_source_accounts
ALTER TABLE riskflow_source_accounts
ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'rettiwt';

-- Seed official RSS sources (tracked economic publishers only)
INSERT INTO riskflow_source_accounts (handle, display_name, category, method, active) VALUES
  ('bls.gov', 'Bureau of Labor Statistics', 'Official', 'rss', true),
  ('federalreserve.gov', 'Federal Reserve', 'Official', 'rss', true),
  ('newyorkfed.org', 'New York Fed', 'Official', 'rss', true),
  ('atlantafed.org', 'Atlanta Fed', 'Official', 'rss', true)
ON CONFLICT (handle) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  method = EXCLUDED.method,
  active = EXCLUDED.active;

-- Backfill existing rows to 'rettiwt' if they were created before this migration
UPDATE riskflow_source_accounts
SET method = 'rettiwt'
WHERE method IS NULL OR method = '';
