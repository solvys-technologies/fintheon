-- MiroShark deliberation persistence — survive backend restarts
-- [claude-code 2026-04-11] S14-T1: Persist 4-phase deliberation pipeline results

CREATE TABLE IF NOT EXISTS miroshark_deliberations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL DEFAULT 'complete',
  analyst_results JSONB,
  gov_officials_skipped BOOLEAN DEFAULT false,
  hermes_results JSONB,
  harper_scoring JSONB,
  user_injection TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_miroshark_delib_sim ON miroshark_deliberations(simulation_id);
CREATE INDEX idx_miroshark_delib_created ON miroshark_deliberations(created_at DESC);

-- RLS: service role only (deliberations are backend-internal)
ALTER TABLE miroshark_deliberations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to deliberations" ON miroshark_deliberations
  FOR ALL USING (auth.role() = 'service_role');
