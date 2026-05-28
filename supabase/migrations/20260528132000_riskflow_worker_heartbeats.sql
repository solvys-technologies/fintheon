-- [codex 2026-05-28] Restore RiskFlow worker heartbeat table expected by
-- backend diagnostics and the standalone Fly worker.

create table if not exists public.riskflow_worker_heartbeats (
  id uuid primary key default gen_random_uuid(),
  tier text not null,
  last_run_at timestamptz not null default now(),
  items_ingested int not null default 0,
  errors int not null default 0
);

create unique index if not exists riskflow_worker_heartbeats_tier_idx
  on public.riskflow_worker_heartbeats (tier);

insert into public.riskflow_worker_heartbeats (
  tier,
  last_run_at,
  items_ingested,
  errors
)
select
  tier,
  last_run_at,
  items_ingested,
  errors
from public.news_worker_heartbeats
on conflict (tier) do update set
  last_run_at = excluded.last_run_at,
  items_ingested = excluded.items_ingested,
  errors = excluded.errors
where public.riskflow_worker_heartbeats.last_run_at < excluded.last_run_at;
