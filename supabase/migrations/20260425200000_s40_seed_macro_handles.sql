-- [claude-code 2026-04-25] S40-P3: seed 8 Macro handles into
-- riskflow_source_accounts so the streaming-watcher / pipeline pick them up
-- on next breaking-tier tick. Idempotent — INSERT … ON CONFLICT DO NOTHING.
--
-- Push from main worktree:
--   cd ~/Documents/Codebases/fintheon && supabase db push

INSERT INTO riskflow_source_accounts
  (handle, display_name, category, active, tier_weight, noise_score)
VALUES
  ('NickTimiraos', 'Nick Timiraos', 'Macro', TRUE, 7, 0),
  ('unusual_whales', 'unusual_whales', 'Macro', TRUE, 6, 0),
  ('WalterBloomberg', 'Walter Bloomberg', 'Macro', TRUE, 7, 0),
  ('LiveSquawk', 'LiveSquawk', 'Macro', TRUE, 6, 0),
  ('FXHedge', 'FXHedge', 'Macro', TRUE, 6, 0),
  ('WallStreetBets', 'WallStreetBets', 'Macro', TRUE, 5, 0),
  ('SquawkCNBC', 'Squawk CNBC', 'Macro', TRUE, 6, 0),
  ('zerohedge', 'zerohedge', 'Macro', TRUE, 5, 0)
ON CONFLICT (handle) DO UPDATE SET
  category = EXCLUDED.category,
  active = TRUE,
  tier_weight = GREATEST(riskflow_source_accounts.tier_weight, EXCLUDED.tier_weight),
  updated_at = NOW();
