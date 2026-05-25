-- [claude-code 2026-05-15] S66-T1: Pre-session price + multi-plan support

ALTER TABLE day_plan_windows ADD COLUMN IF NOT EXISTS session_price NUMERIC;

ALTER TABLE day_plans ADD COLUMN IF NOT EXISTS plan_variant TEXT;
