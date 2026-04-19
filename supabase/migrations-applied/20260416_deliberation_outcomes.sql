-- Deliberation Outcomes: tracks MiroShark predictions vs actual VIX for closed-loop learning
-- Reads FROM miroshark_deliberations (doesn't duplicate it)

CREATE TABLE IF NOT EXISTS deliberation_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deliberation_id UUID REFERENCES miroshark_deliberations(id),
  agent_id VARCHAR(50) NOT NULL,
  predicted_iv_score DECIMAL(4,2),
  predicted_regime_shift DECIMAL(3,2),
  predicted_category_scores JSONB,
  actual_vix_24h DECIMAL(5,2),
  actual_vix_48h DECIMAL(5,2),
  actual_vix_72h DECIMAL(5,2),
  direction_correct_24h BOOLEAN,
  direction_correct_48h BOOLEAN,
  direction_correct_72h BOOLEAN,
  magnitude_error_24h DECIMAL(5,2),
  magnitude_error_48h DECIMAL(5,2),
  magnitude_error_72h DECIMAL(5,2),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delib_outcomes_agent ON deliberation_outcomes(agent_id, created_at DESC);
CREATE INDEX idx_delib_outcomes_unresolved ON deliberation_outcomes(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_delib_outcomes_delib ON deliberation_outcomes(deliberation_id);

-- RLS: service role only
ALTER TABLE deliberation_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON deliberation_outcomes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
