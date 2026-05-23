CREATE TABLE IF NOT EXISTS coliseum_desk_profiles (
  desk_id uuid PRIMARY KEY REFERENCES narrative_desks(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Priced In Capital',
  bio text NOT NULL DEFAULT 'Desk-first macro and market narrative research.',
  archetypes text[] NOT NULL DEFAULT ARRAY['macro']::text[],
  broker_classification text,
  prop_firm_classification text,
  affiliate_url text,
  affiliate_disclosure text,
  affiliate_relationship text,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    archetypes <@ ARRAY[
      'narrative trader',
      'thematic investor',
      'nothing-happens',
      'macro',
      'doomer',
      'technician',
      'contrarian',
      'vol trader',
      'policy watcher',
      'fundamentalist'
    ]::text[]
  ),
  CHECK (
    affiliate_url IS NULL OR length(coalesce(affiliate_disclosure, '')) >= 12
  )
);

CREATE TABLE IF NOT EXISTS coliseum_desk_agent_styles (
  desk_id uuid PRIMARY KEY REFERENCES narrative_desks(id) ON DELETE CASCADE,
  archetype_mix text[] NOT NULL DEFAULT ARRAY['macro']::text[],
  house_bias text,
  preferred_evidence_sources text[] NOT NULL DEFAULT ARRAY[]::text[],
  risk_posture text,
  time_horizon text,
  forbidden_claims text[] NOT NULL DEFAULT ARRAY[]::text[],
  custom_instruction text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    archetype_mix <@ ARRAY[
      'narrative trader',
      'thematic investor',
      'nothing-happens',
      'macro',
      'doomer',
      'technician',
      'contrarian',
      'vol trader',
      'policy watcher',
      'fundamentalist'
    ]::text[]
  ),
  CHECK (custom_instruction IS NULL OR length(custom_instruction) <= 600),
  CHECK (cardinality(preferred_evidence_sources) <= 8),
  CHECK (cardinality(forbidden_claims) <= 8)
);

CREATE TABLE IF NOT EXISTS coliseum_desk_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desk_id uuid NOT NULL REFERENCES narrative_desks(id) ON DELETE CASCADE,
  narrative_session_id uuid REFERENCES narrative_sessions(id) ON DELETE SET NULL,
  title text NOT NULL,
  thesis text NOT NULL,
  probability numeric CHECK (probability IS NULL OR probability BETWEEN 0 AND 100),
  direction text CHECK (direction IS NULL OR direction IN ('bullish', 'bearish', 'neutral', 'range', 'event')),
  timeframe text NOT NULL,
  validation_rule text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'published',
      'watching',
      'gaining_support',
      'thesis_proven',
      'invalidated',
      'expired'
    )
  ),
  created_by text NOT NULL,
  publisher_id text,
  published_at timestamptz,
  expires_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coliseum_forecast_catalysts (
  forecast_id uuid NOT NULL REFERENCES coliseum_desk_forecasts(id) ON DELETE CASCADE,
  riskflow_item_id text NOT NULL,
  evidence_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (forecast_id, riskflow_item_id)
);

CREATE TABLE IF NOT EXISTS coliseum_forecast_market_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES coliseum_desk_forecasts(id) ON DELETE CASCADE,
  venue text NOT NULL CHECK (venue IN ('kalshi', 'polymarket', 'prediction-market', 'other')),
  market_title text NOT NULL,
  market_url text NOT NULL,
  price_or_odds text,
  expiry timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_coliseum_timestamp()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_coliseum_desk_profiles_updated ON coliseum_desk_profiles;
CREATE TRIGGER trigger_coliseum_desk_profiles_updated
  BEFORE UPDATE ON coliseum_desk_profiles
  FOR EACH ROW EXECUTE FUNCTION update_coliseum_timestamp();

DROP TRIGGER IF EXISTS trigger_coliseum_desk_agent_styles_updated ON coliseum_desk_agent_styles;
CREATE TRIGGER trigger_coliseum_desk_agent_styles_updated
  BEFORE UPDATE ON coliseum_desk_agent_styles
  FOR EACH ROW EXECUTE FUNCTION update_coliseum_timestamp();

DROP TRIGGER IF EXISTS trigger_coliseum_desk_forecasts_updated ON coliseum_desk_forecasts;
CREATE TRIGGER trigger_coliseum_desk_forecasts_updated
  BEFORE UPDATE ON coliseum_desk_forecasts
  FOR EACH ROW EXECUTE FUNCTION update_coliseum_timestamp();

CREATE INDEX IF NOT EXISTS idx_coliseum_forecasts_desk_status
  ON coliseum_desk_forecasts (desk_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_coliseum_forecast_catalysts_item
  ON coliseum_forecast_catalysts (riskflow_item_id);
CREATE INDEX IF NOT EXISTS idx_coliseum_forecast_market_refs_forecast
  ON coliseum_forecast_market_refs (forecast_id);

INSERT INTO coliseum_desk_profiles (
  desk_id,
  display_name,
  bio,
  archetypes,
  broker_classification,
  prop_firm_classification,
  created_by
)
SELECT
  id,
  'Priced In Capital',
  'Desk-first macro and market narrative research.',
  ARRAY['macro', 'policy watcher']::text[],
  'self-directed',
  'none',
  coalesce(created_by, 'system')
FROM narrative_desks
WHERE slug = 'priced-in-capital'
ON CONFLICT (desk_id) DO NOTHING;
