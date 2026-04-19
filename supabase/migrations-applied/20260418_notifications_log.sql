-- [claude-code 2026-04-18] Notifications log: unified table backing in-app notification center + push history
-- Used by emit.ts for every push attempt (logged even when push is suppressed by category gate / quiet hours / dedup)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  -- Category = push preference bucket: riskflow | dailyBrief | regimeActivations | toolApprovals | chat_relay | test | system
  category TEXT NOT NULL DEFAULT 'system',
  -- Severity = filter threshold: low | medium | high | critical
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  -- Dedup key. Shape: `{category}:{normalizedId}:{timeBucket}`. Null for one-off pushes.
  fingerprint TEXT,
  event_id TEXT,
  -- True if emit.ts logged but did not push (category off, quiet hours, dedup cooldown, rate limit)
  suppressed BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_fingerprint ON notifications (fingerprint, created_at) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id) WHERE read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on notifications" ON notifications
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users mark own notifications read" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
