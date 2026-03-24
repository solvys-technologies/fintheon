-- Federal Reserve FOMC simulation sessions
-- Stores deliberation results, votes, and monetary policy signals for MiroFish integration

CREATE TABLE IF NOT EXISTS fed_reserve_sessions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      text NOT NULL UNIQUE,
  decision        text NOT NULL,                          -- hike-50, hike-25, hold, cut-25, cut-50
  vote_count      jsonb NOT NULL DEFAULT '{}',            -- { "hike-25": 3, "hold": 5 }
  dissent_count   integer NOT NULL DEFAULT 0,
  consensus_strength float NOT NULL DEFAULT 0,
  median_dot_plot  float NOT NULL DEFAULT 5.0,
  dot_plot_range   jsonb NOT NULL DEFAULT '{"low": 4, "high": 6}',
  monetary_policy_signal float NOT NULL DEFAULT 5.0,      -- 0-10, fed into MiroFish
  signal_confidence float NOT NULL DEFAULT 0.5,
  regime_shift_probability float NOT NULL DEFAULT 0.05,
  forward_guidance jsonb NOT NULL DEFAULT '{}',
  deliberation_rounds jsonb NOT NULL DEFAULT '[]',
  context_snapshot jsonb NOT NULL DEFAULT '{}',
  briefing_summary text NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fed_reserve_sessions_created_at ON fed_reserve_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fed_reserve_sessions_decision ON fed_reserve_sessions (decision);
