-- [claude-code 2026-04-26] S45-T1: Day Card data brain — day_plans, day_plan_windows,
-- day_plan_feedback, day_plan_streaks. Supports the prescriptive Day Card flow
-- (one trading window, prices of interest, invalidation, profit target, Desk Theme
-- message) plus the 15-min Desk Drift monitor and the green-days-only streak
-- ledger driven off ProjectX balance delta.

CREATE TABLE IF NOT EXISTS day_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL DEFAULT 'pic',
  date DATE NOT NULL,
  event_name TEXT,
  desk_theme TEXT,
  generated_by TEXT NOT NULL DEFAULT 'system',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_brief_id UUID,
  UNIQUE (team_id, date)
);

CREATE INDEX IF NOT EXISTS idx_day_plans_date ON day_plans(date DESC);

CREATE TABLE IF NOT EXISTS day_plan_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_plan_id UUID NOT NULL REFERENCES day_plans(id) ON DELETE CASCADE,
  window_index INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  prices_of_interest NUMERIC[] DEFAULT '{}',
  invalidation NUMERIC,
  profit_target NUMERIC,
  expected_move_pct NUMERIC,
  UNIQUE (day_plan_id, window_index)
);

CREATE INDEX IF NOT EXISTS idx_day_plan_windows_plan ON day_plan_windows(day_plan_id);

CREATE TABLE IF NOT EXISTS day_plan_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id UUID NOT NULL REFERENCES day_plan_windows(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('followed', 'faded', 'sat_out')),
  reason_code TEXT,
  reason_text TEXT,
  fill_price NUMERIC,
  outcome_pnl NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_day_plan_feedback_user ON day_plan_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_day_plan_feedback_window ON day_plan_feedback(window_id);

CREATE TABLE IF NOT EXISTS day_plan_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  daily_pnl NUMERIC NOT NULL DEFAULT 0,
  daily_color TEXT NOT NULL CHECK (daily_color IN ('green', 'red', 'flat')),
  streak_at_close INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_day_plan_streaks_user_date ON day_plan_streaks(user_id, date DESC);

-- ── RLS ──
ALTER TABLE day_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_plan_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_plan_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_plan_streaks ENABLE ROW LEVEL SECURITY;

-- day_plans + day_plan_windows are team-scoped (currently single team 'pic').
-- Authenticated users SELECT freely; service_role does all writes.
DROP POLICY IF EXISTS day_plans_read ON day_plans;
CREATE POLICY day_plans_read ON day_plans
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS day_plans_service_write ON day_plans;
CREATE POLICY day_plans_service_write ON day_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS day_plan_windows_read ON day_plan_windows;
CREATE POLICY day_plan_windows_read ON day_plan_windows
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS day_plan_windows_service_write ON day_plan_windows;
CREATE POLICY day_plan_windows_service_write ON day_plan_windows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Feedback + streaks are user-owned.
DROP POLICY IF EXISTS day_plan_feedback_owner ON day_plan_feedback;
CREATE POLICY day_plan_feedback_owner ON day_plan_feedback
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS day_plan_feedback_service ON day_plan_feedback;
CREATE POLICY day_plan_feedback_service ON day_plan_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS day_plan_streaks_owner ON day_plan_streaks;
CREATE POLICY day_plan_streaks_owner ON day_plan_streaks
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS day_plan_streaks_service ON day_plan_streaks;
CREATE POLICY day_plan_streaks_service ON day_plan_streaks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
