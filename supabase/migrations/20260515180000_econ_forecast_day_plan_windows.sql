-- [claude-code 2026-05-15] Econ forecast: add econ_forecast JSONB column to day_plan_windows,
--   replacing the old price-heavy columns (prices_of_interest, entries, invalidation,
--   profit_target, expected_move_pct) with a single structured JSONB field containing
--   forecast/miss/beat scenarios, AI agent prediction, and other notable events.
--   Old columns retained for migration transition — NOT dropped to avoid data loss.

ALTER TABLE day_plan_windows
  ADD COLUMN IF NOT EXISTS event_name TEXT,
  ADD COLUMN IF NOT EXISTS econ_forecast JSONB;

-- Create index for querying windows with forecasts
CREATE INDEX IF NOT EXISTS idx_day_plan_windows_forecast
  ON day_plan_windows ((econ_forecast IS NOT NULL))
  WHERE econ_forecast IS NOT NULL;
