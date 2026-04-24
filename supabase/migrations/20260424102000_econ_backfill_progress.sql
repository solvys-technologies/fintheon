-- [claude-code 2026-04-24] S34-T10: econ backfill progress + queue tables.
-- Drives the Monday 02:00 ET cron that pulls historical econ events (2023-Q1 → current)
-- via free-tier OpenRouter models, then hands raw output to Harper for categorization + dedup.
--
-- Depends on 20260424101000_economic_events_base.sql (T3) for event_key / country / category columns.
-- Seed: one row per (quarter × country) for 7 countries × ~13 quarters ≈ 91 rows, all status='pending'.

CREATE TABLE IF NOT EXISTS public.econ_backfill_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slice_start DATE NOT NULL,
  slice_end DATE NOT NULL,
  country TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'enriching', 'complete', 'failed')),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rows_written INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slice_start, slice_end, country)
);

CREATE INDEX IF NOT EXISTS idx_econ_backfill_progress_status_start
  ON public.econ_backfill_progress (status, slice_start);

CREATE TABLE IF NOT EXISTS public.econ_backfill_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id UUID NOT NULL REFERENCES public.econ_backfill_progress(id) ON DELETE CASCADE,
  raw_payload JSONB NOT NULL,
  normalized BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_econ_backfill_queue_progress_normalized
  ON public.econ_backfill_queue (progress_id, normalized);

-- Seed quarterly slices 2023-Q1 → current quarter × 7 watched countries.
DO $$
DECLARE
  countries TEXT[] := ARRAY['US', 'EU', 'UK', 'JP', 'NZ', 'AU', 'CA'];
  c TEXT;
  q_start DATE;
  q_end DATE;
  today DATE := current_date;
BEGIN
  FOREACH c IN ARRAY countries LOOP
    q_start := DATE '2023-01-01';
    WHILE q_start <= today LOOP
      q_end := (q_start + INTERVAL '3 months')::DATE - INTERVAL '1 day';
      IF q_end > today THEN
        q_end := today;
      END IF;

      INSERT INTO public.econ_backfill_progress (slice_start, slice_end, country, status)
      VALUES (q_start, q_end, c, 'pending')
      ON CONFLICT (slice_start, slice_end, country) DO NOTHING;

      q_start := (q_start + INTERVAL '3 months')::DATE;
    END LOOP;
  END LOOP;
END $$;

COMMENT ON TABLE public.econ_backfill_progress IS
  'S34-T10 backfill ledger. One row per (quarter × country). Scheduler claims oldest pending slices weekly and pulls historical econ events via free-tier LLM.';
COMMENT ON TABLE public.econ_backfill_queue IS
  'Raw LLM output staging area. Harper batch-normalizes into economic_events, then flips normalized=true.';
