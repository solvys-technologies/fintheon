-- [claude-code 2026-04-19] S27-T6 (W2d): Harper Browser Operator action cache
-- Cache hit = zero-LLM XPath replay. Miss = LLM extraction, result persisted
-- back for replay. Stale detection lives in operator.ts — this schema stays
-- simple and append-only.

create table if not exists public.action_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  url text not null,
  objective text not null,
  schema_hash text,
  xpath_sequence jsonb not null,
  extracted_data jsonb,
  success_count int not null default 0,
  failure_count int not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists action_cache_url_idx
  on public.action_cache (url);

create index if not exists action_cache_updated_at_idx
  on public.action_cache (updated_at desc);

-- Observability: every browseTask() run logs here. /api/diagnostics reads
-- the 24h slice for the cache_hit_rate_24h field.
create table if not exists public.browse_task_runs (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null,
  cache_hit boolean not null default false,
  url text not null,
  objective text not null,
  cost_usd numeric(10, 4) not null default 0,
  duration_ms int not null default 0,
  success boolean not null default false,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists browse_task_runs_created_at_idx
  on public.browse_task_runs (created_at desc);

create index if not exists browse_task_runs_cache_key_idx
  on public.browse_task_runs (cache_key);
