-- [claude-code 2026-05-15] S66-T1: User instrument preferences for global instrument selection

CREATE TABLE IF NOT EXISTS user_instrument_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_instrument TEXT NOT NULL DEFAULT '/NQ',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_instrument_prefs_user ON user_instrument_preferences(user_id);

ALTER TABLE user_instrument_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_instrument_prefs_owner ON user_instrument_preferences;
CREATE POLICY user_instrument_prefs_owner ON user_instrument_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
