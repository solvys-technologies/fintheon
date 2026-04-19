-- [claude-code 2026-04-19] S27-T9 W2e: per-user daily LLM budget tracking.
--   Drives the graceful budget-exceeded degrade (Opus → Sonnet for Harper + Oracle).
--   Consumed by backend-hono/src/services/ai/budget.ts + diagnostics routing widget.

create table if not exists public.user_budget_daily (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  day date not null,
  used_usd numeric(10, 6) not null default 0,
  cap_usd numeric(10, 6) not null default 20,
  degraded boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists user_budget_daily_user_day_idx
  on public.user_budget_daily (user_id, day desc);

comment on table public.user_budget_daily is
  'Per-user rolling-day LLM cost cap. Written by llm-call.ts post-invocation, read by diagnostics. Graceful degrade, never a hard cutoff. ROUTING_DISABLE_BUDGET=true bypasses entirely (TP override).';
