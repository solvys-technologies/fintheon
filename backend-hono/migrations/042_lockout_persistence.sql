-- [claude-code 2026-05-13] S64 T3: Lockout persistence — settings + audit trail

CREATE TABLE IF NOT EXISTS user_lockout_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lockout_enabled BOOLEAN DEFAULT false,
  auto_lock_from_desk_plan BOOLEAN DEFAULT true,
  auto_release_minutes INTEGER DEFAULT 15,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_lockout_settings_user ON user_lockout_settings(user_id);

ALTER TABLE user_lockout_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_lockout_settings_owner ON user_lockout_settings;
CREATE POLICY user_lockout_settings_owner ON user_lockout_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS lockout_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT,
  triggered_by TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lockout_audit_log_user ON lockout_audit_log(user_id, created_at DESC);

ALTER TABLE lockout_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lockout_audit_log_owner ON lockout_audit_log;
CREATE POLICY lockout_audit_log_owner ON lockout_audit_log
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
