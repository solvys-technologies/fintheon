-- [claude-code 2026-04-24] Tighten polymarket_predictions scope + duration.
--
-- Per TP: agents should ONLY place predictions in four buckets
-- (weather, economics, commentary, projected_data) and NEVER take a position
-- on a market that closes more than 7 days out. Analysts also need to leave
-- an audit trail — why they picked this contract and which catalyst they
-- were tracking — so performance rollups can feed back into the scoring
-- loop.
--
-- Schema exists (see 001_initial_schema.sql historical) with zero rows at
-- migration time, so ADD COLUMN is cheap and no backfill is needed.

ALTER TABLE public.polymarket_predictions
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS market_close_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reasoning TEXT,
  ADD COLUMN IF NOT EXISTS catalyst_source TEXT;

-- Allow-list of prediction categories. Mirror in backend validation
-- (routes/polymarket/index.ts) so the check fires before the INSERT.
ALTER TABLE public.polymarket_predictions
  DROP CONSTRAINT IF EXISTS polymarket_predictions_category_check;
ALTER TABLE public.polymarket_predictions
  ADD CONSTRAINT polymarket_predictions_category_check
  CHECK (
    category IS NULL OR category IN (
      'weather',
      'economics',
      'commentary',
      'projected_data'
    )
  );

-- Reject trades on contracts that settle more than 7 days from prediction
-- time. Short-term only — agents that want a long-horizon view should
-- publish a thesis doc, not a tradeable prediction.
ALTER TABLE public.polymarket_predictions
  DROP CONSTRAINT IF EXISTS polymarket_predictions_max_duration_check;
ALTER TABLE public.polymarket_predictions
  ADD CONSTRAINT polymarket_predictions_max_duration_check
  CHECK (
    market_close_at IS NULL
    OR market_close_at <= created_at + INTERVAL '7 days'
  );

-- Indexes to support per-category agent performance rollups without
-- scanning the full table.
CREATE INDEX IF NOT EXISTS polymarket_predictions_category_agent_idx
  ON public.polymarket_predictions (category, agent_name)
  WHERE resolved = true;

CREATE INDEX IF NOT EXISTS polymarket_predictions_close_at_idx
  ON public.polymarket_predictions (market_close_at)
  WHERE resolved = false;
