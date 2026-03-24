-- Psych-assist: lockout audit trail + tilt snapshots
CREATE TABLE IF NOT EXISTS lockout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  lockout_level TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  debrief_answers JSONB,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lockout_user ON lockout_sessions(user_id);

CREATE TABLE IF NOT EXISTS tilt_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  detected_signals JSONB NOT NULL,
  tilt_risk_score INT,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tilt_user ON tilt_snapshots(user_id);
