-- Commentator registry for speaker identification + tier weighting
CREATE TABLE IF NOT EXISTS commentator_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  tier INTEGER NOT NULL DEFAULT 3 CHECK (tier BETWEEN 1 AND 3),
  role TEXT,
  institution TEXT,
  weight_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  rank INTEGER NOT NULL DEFAULT 999,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commentator_name ON commentator_registry (name);
CREATE INDEX IF NOT EXISTS idx_commentator_active ON commentator_registry (active) WHERE active = true;
