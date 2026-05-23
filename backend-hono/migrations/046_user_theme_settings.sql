-- Persist cross-surface settings and named themes for desktop, web, and mobile.
ALTER TABLE IF EXISTS user_settings
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rettiwt_api_keys JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_settings_settings_gin
  ON user_settings USING GIN (settings);

CREATE INDEX IF NOT EXISTS idx_user_settings_appearance_gin
  ON user_settings USING GIN ((settings -> 'appearance'));
