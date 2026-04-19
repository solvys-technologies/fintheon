-- [claude-code 2026-04-19] S27-T7 (W2d): news-worker heartbeats.
-- Each tier (breaking | standard) upserts one row per run cycle. Backend reads
-- min(last_run_at) to surface news_worker_age_seconds on /api/diagnostics.

create table if not exists public.news_worker_heartbeats (
  id uuid primary key default gen_random_uuid(),
  tier text not null,
  last_run_at timestamptz not null default now(),
  items_ingested int not null default 0,
  errors int not null default 0
);

create unique index if not exists news_worker_heartbeats_tier_idx
  on public.news_worker_heartbeats (tier);
