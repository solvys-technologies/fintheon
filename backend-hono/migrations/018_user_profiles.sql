-- [claude-code 2026-03-24] User profiles table for auth + app state storage
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uid TEXT UNIQUE NOT NULL,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'fintheon', 'fintheon_plus', 'fintheon_pro')),
  onboarding_complete BOOLEAN DEFAULT false,
  app_state JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_supabase_uid ON user_profiles(supabase_uid);
