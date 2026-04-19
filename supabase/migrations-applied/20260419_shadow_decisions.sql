-- [claude-code 2026-04-19] S24-T3: Shadow-mode decision log.
-- Agents in shadow mode call logShadowDecision() before any real proposal. When the equivalent
-- real decision lands, resolveShadowDecision() compares proposals and sets agreed=true/false.
-- Graduation to auto-apply requires agreement_rate > 0.85 over 30d + super admin confirmation.
CREATE TABLE IF NOT EXISTS agent_shadow_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- regime_proposal | lexicon_addition | walk_back
  decision_type TEXT NOT NULL,
  -- What the agent would have proposed (full proposal payload)
  would_propose JSONB NOT NULL,
  -- What actually happened (from human/real agent). NULL until resolved.
  actual_decision JSONB,
  actual_decided_by TEXT,
  -- TRUE if would_propose semantically matches actual_decision. NULL until resolved.
  agreed BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shadow_decisions_type_created
  ON agent_shadow_decisions (decision_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_decisions_unresolved
  ON agent_shadow_decisions (decision_type, created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE agent_shadow_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agent_shadow_decisions"
  ON agent_shadow_decisions
  FOR ALL USING (auth.role() = 'service_role');
