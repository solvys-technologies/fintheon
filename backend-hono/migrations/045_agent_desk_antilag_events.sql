-- [codex 2026-05-22] AgentDesk Antilag timing ledger.
-- Records TradingView-confirmed NQ + 2-of-3 yield barometer ATR spikes.

CREATE TABLE IF NOT EXISTS agent_desk_antilag_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'system',
  source TEXT NOT NULL DEFAULT 'tradingview',
  instrument TEXT NOT NULL,
  instrument_class TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL,
  triggered_business_date DATE NOT NULL,
  timeframe TEXT NOT NULL,
  atr_lookback INTEGER NOT NULL,
  atr_multiple NUMERIC(10, 4) NOT NULL,
  nq_spiked BOOLEAN NOT NULL DEFAULT false,
  barometer_spike_count INTEGER NOT NULL DEFAULT 0,
  barometers JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_desk_antilag_business_date
  ON agent_desk_antilag_events(triggered_business_date DESC);

CREATE INDEX IF NOT EXISTS idx_agent_desk_antilag_instrument_date
  ON agent_desk_antilag_events(instrument, triggered_business_date DESC);

CREATE INDEX IF NOT EXISTS idx_agent_desk_antilag_user_date
  ON agent_desk_antilag_events(user_id, triggered_business_date DESC);

ALTER TABLE agent_desk_antilag_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_desk_antilag_owner ON agent_desk_antilag_events;
CREATE POLICY agent_desk_antilag_owner ON agent_desk_antilag_events
  FOR ALL
  USING (user_id = 'system' OR auth.uid()::text = user_id)
  WITH CHECK (user_id = 'system' OR auth.uid()::text = user_id);
