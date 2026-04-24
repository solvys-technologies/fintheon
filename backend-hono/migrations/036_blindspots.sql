-- [claude-code 2026-04-23] S31-T6 — psych + trading blindspots tables with RLS
-- Hand-off note for TP: apply via `supabase db push` from ~/Documents/Codebases/fintheon.
-- DO NOT apply via Supabase MCP apply_migration (orphans this file).

CREATE TABLE IF NOT EXISTS psych_blindspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pattern TEXT NOT NULL,                  -- 'revenge_entry' | 'size_escalation' | 'post_loss_cluster' | 'fomo_entry' | ...
  evidence TEXT NOT NULL,                 -- short narrative from observed trades
  corrective_action TEXT NOT NULL,        -- from template
  severity INT CHECK (severity BETWEEN 1 AND 5),
  source TEXT NOT NULL DEFAULT 'template',-- 'template' | 'fluid'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trading_blindspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pattern TEXT NOT NULL,                  -- 'over_trading' | 'over_leverage' | 'high_vol_env' | 'news_trading_early' | 'plan_deviation'
  evidence TEXT NOT NULL,
  corrective_action TEXT NOT NULL,
  severity INT CHECK (severity BETWEEN 1 AND 5),
  source TEXT NOT NULL DEFAULT 'template',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psych_blindspots_user_date ON psych_blindspots(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trading_blindspots_user_date ON trading_blindspots(user_id, date DESC);

ALTER TABLE psych_blindspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_blindspots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS psych_blindspots_owner ON psych_blindspots;
DROP POLICY IF EXISTS trading_blindspots_owner ON trading_blindspots;

CREATE POLICY psych_blindspots_owner ON psych_blindspots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY trading_blindspots_owner ON trading_blindspots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
