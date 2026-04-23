-- [claude-code 2026-04-23] S32-T7: watchouts — silent log of strategy-drift +
-- calendar-proximity observations. Never pushes; surfaced only on Performance tab.
-- (Brief spec numbered this 036; 036 is already taken by blindspots, using 040.)

CREATE TABLE IF NOT EXISTS watchouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_watchouts_user_ts ON watchouts(user_id, ts DESC);

ALTER TABLE watchouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watchouts_owner ON watchouts;
CREATE POLICY watchouts_owner ON watchouts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
