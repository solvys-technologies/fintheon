-- Add origin column to trades table to distinguish agent-placed vs user-placed trades
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'user'
    CHECK (origin IN ('user', 'autopilot'));

CREATE INDEX IF NOT EXISTS idx_trades_origin_entry_at
  ON trades(origin, entry_at);

-- Backfill existing rows: assume all pre-S29 trades are user-placed
UPDATE trades SET origin = 'user' WHERE origin IS NULL;
