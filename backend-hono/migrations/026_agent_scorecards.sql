-- Migration 026: Agent scorecards table for tracking P&L per agent trade
-- Links to trading_proposals and trade_runs for full execution lifecycle
-- Scored by Claude CLI with grade + notes

CREATE TABLE IF NOT EXISTS agent_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to execution system
  trade_id UUID REFERENCES trade_runs(id),
  proposal_id UUID REFERENCES trading_proposals(id),

  -- Agent identity
  agent_name VARCHAR(50) NOT NULL,  -- sentinel, oracle, horace, feucht, etc.

  -- Instrument & trade details
  instrument VARCHAR(20) NOT NULL,  -- /NQ, /ES, /YM, etc.
  direction VARCHAR(10) NOT NULL,   -- long, short

  -- Price data
  entry_price DECIMAL(10,2),
  exit_price DECIMAL(10,2),
  pnl_points DECIMAL(10,2),
  pnl_pct DECIMAL(6,4),

  -- Strategy context
  strategy_name VARCHAR(100),
  confluence_score INT,

  -- Claude CLI scoring
  scored_grade VARCHAR(2),          -- A, B, C, D, F
  claude_notes TEXT,                -- CLI-generated review of trade quality
  scored_at TIMESTAMPTZ,
  scored_by VARCHAR(20) DEFAULT 'claude-cli',

  -- Timing
  proposed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scorecards_agent ON agent_scorecards(agent_name);
CREATE INDEX IF NOT EXISTS idx_scorecards_instrument ON agent_scorecards(instrument);
CREATE INDEX IF NOT EXISTS idx_scorecards_grade ON agent_scorecards(scored_grade);
CREATE INDEX IF NOT EXISTS idx_scorecards_closed ON agent_scorecards(closed_at DESC);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_scorecard_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scorecard_updated ON agent_scorecards;
CREATE TRIGGER trigger_scorecard_updated
  BEFORE UPDATE ON agent_scorecards
  FOR EACH ROW
  EXECUTE FUNCTION update_scorecard_timestamp();
