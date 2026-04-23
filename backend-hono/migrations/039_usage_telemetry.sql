-- [claude-code 2026-04-23] S31-T9 predictive feature knowledge graph
-- Tracks per-user surface/action telemetry, aggregates a daily intent view,
-- and stores Harper-generated feature proposals derived from observed usage.
-- Telemetry is opaque (no prices, no order IDs); RLS pins all rows to auth.uid().

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  surface TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_surface ON usage_events(user_id, surface, ts DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_ts ON usage_events(ts DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usage_events_owner ON usage_events;
CREATE POLICY usage_events_owner ON usage_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS feature_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  anchor_surface TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_event_ids UUID[],
  status TEXT NOT NULL DEFAULT 'proposed',
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_feature_proposals_user_status ON feature_proposals(user_id, status, proposed_at DESC);

ALTER TABLE feature_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feature_proposals_owner ON feature_proposals;
CREATE POLICY feature_proposals_owner ON feature_proposals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS usage_intent_daily AS
SELECT
  user_id,
  date_trunc('day', ts) AS day,
  surface,
  COUNT(*) AS events,
  COUNT(DISTINCT action) AS distinct_actions
FROM usage_events
GROUP BY user_id, day, surface;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_intent_daily_pk ON usage_intent_daily(user_id, day, surface);
