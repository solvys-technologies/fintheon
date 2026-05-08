-- [codex 2026-05-08] Fix global econ-watch country/category uniqueness.
-- Postgres UNIQUE(country, category, user_id) allows duplicate NULL user_id
-- rows, so toggling a country/category in Refinement could leave another
-- active global duplicate behind.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY upper(country), category, COALESCE(user_id::text, 'global')
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.econ_watch_filters
)
DELETE FROM public.econ_watch_filters f
USING ranked r
WHERE f.id = r.id
  AND r.rn > 1;

UPDATE public.econ_watch_filters
SET country = upper(country)
WHERE country <> upper(country);

CREATE UNIQUE INDEX IF NOT EXISTS econ_watch_filters_global_pair_uidx
  ON public.econ_watch_filters (upper(country), category)
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS econ_watch_filters_user_pair_uidx
  ON public.econ_watch_filters (user_id, upper(country), category)
  WHERE user_id IS NOT NULL;
