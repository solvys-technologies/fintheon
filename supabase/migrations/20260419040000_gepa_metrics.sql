-- [claude-code 2026-04-19] S27-T9 W1d + T11 foundation:
--   routing_decisions — per-call telemetry written by backend-hono/src/services/ai/llm-call.ts
--   gepa_metrics      — aggregated metrics consumed by the GEPA evolutionary loop (T11)

create table if not exists public.routing_decisions (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  agent_id text not null,
  task_type text,
  model text not null,
  provider text not null,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10, 6),
  latency_ms int,
  user_feedback_score smallint,
  created_at timestamptz not null default now()
);

create index if not exists routing_decisions_agent_created_idx
  on public.routing_decisions (agent_id, created_at desc);

create index if not exists routing_decisions_conv_idx
  on public.routing_decisions (conversation_id);

-- GEPA-ready metrics table (T11 consumes for evolutionary PRs)
create table if not exists public.gepa_metrics (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  metric_name text not null,
  metric_value numeric not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  sample_size int not null,
  created_at timestamptz not null default now()
);

create index if not exists gepa_metrics_agent_metric_idx
  on public.gepa_metrics (agent_id, metric_name, window_end desc);

comment on table public.routing_decisions is
  'Per-LLM-call telemetry — written automatically by llm-call.ts. Powers the Smart Model Routing diagnostics widget (T9 W2e) and feeds GEPA (T11).';

comment on table public.gepa_metrics is
  'Aggregated agent metrics (accuracy, latency, cost_per_turn, handoff_success_rate) over a rolling window. GEPA evolutionary loop reads these to decide which SOUL parameters to evolve.';
