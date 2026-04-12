-- Source accounts for curated X timeline polling
CREATE TABLE IF NOT EXISTS riskflow_source_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT,
  category TEXT NOT NULL DEFAULT 'Custom',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_accounts_active ON riskflow_source_accounts (active) WHERE active = true;

-- Seed with existing curated accounts
INSERT INTO riskflow_source_accounts (handle, display_name, category) VALUES
  ('financialjuice', 'FinancialJuice', 'Wire'),
  ('DeItaone', 'Walter Bloomberg', 'Wire'),
  ('NickTimiraos', 'Nick Timiraos', 'Macro'),
  ('OSINTDefender', 'OSINT Defender', 'OSINT'),
  ('SecBessent25', 'Scott Bessent', 'Geopolitical'),
  ('realDonaldTrump', 'Donald Trump', 'Geopolitical'),
  ('ABORNEOFFICIAL', 'Adam Borne', 'Geopolitical'),
  ('TheSpectatorIndex', 'The Spectator Index', 'Geopolitical'),
  ('SchizoIntel', 'SchizoIntel', 'OSINT'),
  ('MenchOSINT', 'MenchOSINT', 'OSINT'),
  ('ClashReport', 'Clash Report', 'OSINT')
ON CONFLICT (handle) DO NOTHING;
