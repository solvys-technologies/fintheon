-- [claude-code 2026-04-19] S24-T3: Regime-proposal outcome tagging.
-- 4h and 24h after a regime proposal is decided, outcome-tagger.ts writes SPY price + delta %.
-- Used by T4 admin UI: "your GEO_TENSIONS overrides were right 80% / your BULL_TREND overrides were right 40%".
-- FK is soft (no constraint) so T3 migrations can land before T1's regime_proposals table — the join is resolved at read time.
CREATE TABLE IF NOT EXISTS regime_decision_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regime_proposal_id UUID NOT NULL,
  -- Whether the proposal was approved or denied (mirrored from regime_proposals.status)
  approved BOOLEAN NOT NULL,
  -- SPY close or mid at the time of decision
  market_at_decision NUMERIC NOT NULL,
  -- SPY snapshots at 4h and 24h. NULL until the tagger fires.
  market_4h NUMERIC,
  market_24h NUMERIC,
  delta_4h_pct NUMERIC,
  delta_24h_pct NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regime_outcomes_proposal
  ON regime_decision_outcomes (regime_proposal_id);
CREATE INDEX IF NOT EXISTS idx_regime_outcomes_created
  ON regime_decision_outcomes (created_at DESC);

ALTER TABLE regime_decision_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on regime_decision_outcomes"
  ON regime_decision_outcomes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated read regime_decision_outcomes"
  ON regime_decision_outcomes
  FOR SELECT USING (auth.role() = 'authenticated');
