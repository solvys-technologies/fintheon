-- [claude-code 2026-04-24] S34-T3: base migration for economic_events.
-- Table exists in prod but has no base migration — fresh db push would otherwise break
-- for anything that ALTERs it (see feedback_trades_table_migration memory).
-- Adds country/category/event_key columns required by T3 populator + T1 filters join.

CREATE TABLE IF NOT EXISTS public.economic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE,
  time TEXT,
  forecast TEXT,
  actual TEXT,
  previous TEXT,
  detail TEXT,
  impact TEXT CHECK (impact IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.economic_events
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS event_key TEXT;

-- Backfill event_key for any pre-existing rows so the unique index can be added.
UPDATE public.economic_events
SET event_key = encode(
  sha256(convert_to(
    coalesce(name, '') || '|' ||
    coalesce(date::text, '') || '|' ||
    coalesce(time, '') || '|' ||
    coalesce(country, 'US'),
    'UTF8'
  )),
  'hex'
)
WHERE event_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_economic_events_event_key
  ON public.economic_events (event_key);

CREATE INDEX IF NOT EXISTS idx_economic_events_country_category_date
  ON public.economic_events (country, category, date DESC);

CREATE INDEX IF NOT EXISTS idx_economic_events_date
  ON public.economic_events (date DESC);

COMMENT ON TABLE public.economic_events IS
  'Forward macro calendar. Populated by econ-calendar-populator (ForexFactory weekly JSON + hourly actuals refresh). event_key is sha256 of name|date|time|country for idempotent upserts.';
