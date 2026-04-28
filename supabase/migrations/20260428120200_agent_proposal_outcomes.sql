-- [claude-code 2026-04-28] S47-T2: Proposal/trade resolution into agent performance.
-- Tracks win/loss, resolver timestamp, market close countdown, and agent attribution
-- for both prediction-market proposals and trade ideas.

create table if not exists public.agent_proposal_outcomes (
  id uuid primary key default gen_random_uuid(),
  proposal_id text not null,
  proposal_type text not null check (proposal_type in ('prediction', 'trade', 'arbitrum')),
  agent_name text not null,
  agent_role text,
  direction text not null check (direction in ('long', 'short', 'flat')),
  instrument text not null,
  entry_price numeric,
  exit_price numeric,
  outcome text not null check (outcome in ('win', 'loss', 'push', 'expired', 'pending')),
  pnl numeric,
  resolved_at timestamptz,
  market_close_countdown_minutes integer,
  rationale text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_proposal_outcomes_proposal_idx
  on public.agent_proposal_outcomes (proposal_id, proposal_type);

create unique index if not exists agent_proposal_outcomes_unique_idx
  on public.agent_proposal_outcomes (proposal_id, proposal_type, agent_name);

create index if not exists agent_proposal_outcomes_agent_idx
  on public.agent_proposal_outcomes (agent_name, outcome, resolved_at desc);

create index if not exists agent_proposal_outcomes_pending_idx
  on public.agent_proposal_outcomes (outcome, created_at)
  where outcome = 'pending';

alter table public.agent_proposal_outcomes enable row level security;

create policy agent_proposal_outcomes_read_authed
  on public.agent_proposal_outcomes for select
  to authenticated
  using (true);

create policy agent_proposal_outcomes_service_write
  on public.agent_proposal_outcomes for all
  to service_role
  using (true)
  with check (true);
