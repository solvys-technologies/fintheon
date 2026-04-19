-- [claude-code 2026-04-19] v5.22 S1: Cross-platform user preferences backing store for
--   the shared UserPreferences contract (frontend/lib/user-preferences.ts). Separate from
--   the legacy /api/settings trading-settings pipe — this table carries theme, traderName,
--   notifications, and fusePalette overrides that must sync across desktop + mobile.

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: each user can only read + write their own row.
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_self"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_insert_self"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_update_self"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role full access (server-side upserts via the Hono /api/preferences route).
CREATE POLICY "user_preferences_service_role"
  ON public.user_preferences
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Reversible:
--   DROP POLICY "user_preferences_service_role" ON public.user_preferences;
--   DROP POLICY "user_preferences_update_self" ON public.user_preferences;
--   DROP POLICY "user_preferences_insert_self" ON public.user_preferences;
--   DROP POLICY "user_preferences_select_self" ON public.user_preferences;
--   DROP TABLE IF EXISTS public.user_preferences;
