-- [claude-code 2026-04-19] S27-T4 (W1c): source telemetry for post-Rettiwt Herald dispatcher.
-- Adds source tagging to riskflow_items, a rolling 48h comparison view, and two
-- bookkeeping tables for browser-harness fetches + quota ledger.

-- ── riskflow_items: per-source provenance ──────────────────────────────────

alter table public.riskflow_items
  add column if not exists source text,
  add column if not exists source_domain text,
  add column if not exists fetched_at timestamptz,
  add column if not exists fetch_latency_ms int;

create index if not exists riskflow_items_source_fetched_at_idx
  on public.riskflow_items (source, fetched_at desc);

-- ── 48h comparison view ────────────────────────────────────────────────────

create or replace view public.v_headline_volume_48h as
select
  source,
  count(*)::bigint         as headlines,
  avg(fetch_latency_ms)    as avg_latency_ms,
  min(fetched_at)          as earliest,
  max(fetched_at)          as latest
from public.riskflow_items
where fetched_at > now() - interval '48 hours'
group by source;

-- ── Browser fetch audit ───────────────────────────────────────────────────

create table if not exists public.browser_fetches (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  url_hash text not null,
  status int,
  latency_ms int,
  cost_usd numeric(10,4) default 0,
  self_heal_occurred boolean default false,
  cached_xpath_used boolean default false,
  failure_reason text,
  created_at timestamptz default now()
);

create index if not exists browser_fetches_domain_created_at_idx
  on public.browser_fetches (domain, created_at desc);

create index if not exists browser_fetches_created_at_idx
  on public.browser_fetches (created_at desc);

-- ── Daily quota ledger (survives restarts) ─────────────────────────────────

create table if not exists public.browser_quota_ledger (
  domain text not null,
  day date not null,
  fetches int not null default 0,
  primary key (domain, day)
);

create index if not exists browser_quota_ledger_day_idx
  on public.browser_quota_ledger (day desc);
