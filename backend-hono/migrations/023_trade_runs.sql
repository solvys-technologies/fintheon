-- Migration 023: Trade runs table for enriched execution tracking
-- Extends beyond execution_log with algo playbook context

CREATE TABLE IF NOT EXISTS trade_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Strategy context
  model VARCHAR(20) NOT NULL,              -- flush, ripper, 40_40_club
  symbol VARCHAR(10) NOT NULL,             -- MNQ, ES, etc.
  direction VARCHAR(5) NOT NULL,           -- long, short

  -- Scoring
  confluence_score INT NOT NULL,

  -- Price data
  entry_price DECIMAL(10,2),
  fill_price DECIMAL(10,2),
  stop_loss DECIMAL(10,2),
  take_profit DECIMAL(10,2),
  exit_price DECIMAL(10,2),
  pnl DECIMAL(10,2),

  -- Time context
  hour_of_day INT NOT NULL,
  session VARCHAR(20) NOT NULL,

  -- Algo playbook enrichment
  fib_context JSONB,                       -- HourFibContext
  signal_metadata JSONB,                   -- SignalMetadata

  -- Reconciler
  reconciler_status VARCHAR(20) NOT NULL,

  -- ML / confluence breakdown
  features_fired JSONB,                    -- every confluence point that contributed
  model_prediction JSONB,                  -- ML output if applicable

  -- Link to proposal system
  proposal_id UUID REFERENCES trading_proposals(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trade_runs_timestamp ON trade_runs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trade_runs_model ON trade_runs(model);
CREATE INDEX IF NOT EXISTS idx_trade_runs_symbol ON trade_runs(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_runs_session ON trade_runs(session);
CREATE INDEX IF NOT EXISTS idx_trade_runs_proposal ON trade_runs(proposal_id);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_trade_run_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_trade_run_updated ON trade_runs;
CREATE TRIGGER trigger_trade_run_updated
  BEFORE UPDATE ON trade_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_trade_run_timestamp();
