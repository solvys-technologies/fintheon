-- RiskFlow: FinancialJuice RSS is the primary wire ingestion pipe.
-- Keep the account active for policy/scoring, but remove it from browser
-- handle polling so X auth failures cannot stall the FJ wire.

ALTER TABLE riskflow_source_accounts
ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'browser';

UPDATE riskflow_source_accounts
SET method = 'browser'
WHERE active = true
  AND handle NOT LIKE '%.%'
  AND lower(handle) <> 'financialjuice'
  AND (method IS NULL OR method IN ('', 'rettiwt'));

INSERT INTO riskflow_source_accounts (handle, display_name, category, method, active)
VALUES ('financialjuice', 'FinancialJuice', 'Wire', 'rss', true)
ON CONFLICT (handle) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  method = EXCLUDED.method,
  active = EXCLUDED.active,
  updated_at = now();
