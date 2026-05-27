-- ProjectX journal loop: broker credentials, sync audit, canonical trades.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS journal_broker_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'projectx',
  username VARCHAR(255),
  encrypted_api_key TEXT,
  active_account_id VARCHAR(255),
  account_name VARCHAR(255),
  status VARCHAR(40) NOT NULL DEFAULT 'needs_credentials',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_broker_user_provider
  ON journal_broker_connections (user_id, provider);

CREATE INDEX IF NOT EXISTS idx_journal_broker_user_status
  ON journal_broker_connections (user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS journal_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  account_id VARCHAR(255),
  mode VARCHAR(40) NOT NULL DEFAULT 'manual',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(40) NOT NULL DEFAULT 'running',
  fetched_count INTEGER NOT NULL DEFAULT 0,
  upserted_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_journal_sync_runs_user_provider
  ON journal_sync_runs (user_id, provider, started_at DESC);

CREATE TABLE IF NOT EXISTS trades (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255),
  provider VARCHAR(40) NOT NULL DEFAULT 'projectx',
  account_id VARCHAR(255),
  contract VARCHAR(80) NOT NULL,
  entry_at TIMESTAMPTZ NOT NULL,
  exit_at TIMESTAMPTZ,
  side VARCHAR(16) NOT NULL,
  qty NUMERIC(14, 4) NOT NULL DEFAULT 0,
  entry_price NUMERIC(18, 6) NOT NULL DEFAULT 0,
  exit_price NUMERIC(18, 6),
  realized_pnl NUMERIC(18, 2) NOT NULL DEFAULT 0,
  fees NUMERIC(18, 2) NOT NULL DEFAULT 0,
  origin VARCHAR(40) NOT NULL DEFAULT 'user',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS provider VARCHAR(40) DEFAULT 'projectx';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_id VARCHAR(255);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS fees NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_trades_user_entry
  ON trades (user_id, entry_at DESC);

CREATE INDEX IF NOT EXISTS idx_trades_user_account_entry
  ON trades (user_id, account_id, entry_at DESC);

CREATE TABLE IF NOT EXISTS projectx_activity_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  account_id INTEGER NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  event_source VARCHAR(40) DEFAULT 'signalr',
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_trade BOOLEAN DEFAULT FALSE,
  symbol VARCHAR(32),
  side VARCHAR(16),
  quantity NUMERIC(12, 2),
  price NUMERIC(12, 4),
  realized_pnl NUMERIC(14, 2),
  event_weight NUMERIC(8, 2) DEFAULT 1,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projectx_activity_events
  ADD COLUMN IF NOT EXISTS provider VARCHAR(40) NOT NULL DEFAULT 'projectx';

ALTER TABLE projectx_activity_events
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projectx_activity_user_external
  ON projectx_activity_events (user_id, account_id, external_id)
  WHERE external_id IS NOT NULL;
