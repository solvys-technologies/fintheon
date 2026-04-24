-- [claude-code 2026-04-23] Reconstructed base schema for `trades` table.
-- The original CREATE TABLE trades lived in backend-hono/migrations/001_initial_schema.sql
-- which was deleted in commit cdfd56e5 [v.2.01.2] "chore: Remove all backend code".
-- Every subsequent ALTER TABLE trades migration (20260422000000_trades_origin.sql and
-- the S32 blindspots/advisory/projectx-sync paths) assumes this base exists.
--
-- Schema inferred from the following callsites (authoritative):
--   backend-hono/src/services/projectx-sync.ts   (INSERT — 10 columns excl. user_id)
--   backend-hono/src/services/autopilot/autopilot-scheduler.ts (INSERT — 7 columns, origin='autopilot')
--   backend-hono/src/routes/projectx/trades.ts   (SELECT — public .get("/trades"))
--   backend-hono/src/services/blindspots/generator.ts (SELECT WHERE user_id = $1)
--
-- NOTE: backend-hono/src/routes/advisory/index.ts selects `pnl` (not realized_pnl).
--       That callsite is very likely a bug in the T7 code; this migration does NOT
--       add a `pnl` column — fix the advisory route to use realized_pnl instead.

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contract TEXT NOT NULL,
  side TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  entry_at TIMESTAMPTZ NOT NULL,
  exit_at TIMESTAMPTZ,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  realized_pnl NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- projectx-sync + autopilot-scheduler INSERT without user_id, so user_id stays nullable.
-- Blindspots / advisory queries filter WHERE user_id = auth.uid(), which simply yields
-- zero rows when user_id is NULL — that's acceptable until the INSERT paths get fixed.

CREATE INDEX IF NOT EXISTS idx_trades_user_entry_at ON trades(user_id, entry_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_entry_at      ON trades(entry_at DESC);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trades_owner ON trades;
CREATE POLICY trades_owner ON trades
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service-role writer policy so the backend-hono pool (service_role key) can INSERT
-- rows it's computed server-side without an auth.uid() context.
DROP POLICY IF EXISTS trades_service_insert ON trades;
CREATE POLICY trades_service_insert ON trades
  FOR INSERT
  TO service_role
  WITH CHECK (true);
