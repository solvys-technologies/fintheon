-- [claude-code 2026-04-28] S47-T2: Econ synthesis cache keyed by selected event history.
-- Prevents repeated unchanged event-history context pulls for the same ticker set.

create table if not exists public.econ_synthesis_cache (
  id uuid primary key default gen_random_uuid(),
  event_family text not null,
  date_range text not null,
  selected_event_ids text[] not null default '{}',
  raw_normalized_rows jsonb not null default '[]'::jsonb,
  synthesis_text text not null,
  model text not null,
  version text not null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists econ_synthesis_cache_lookup_unique_idx
  on public.econ_synthesis_cache (event_family, date_range, version);

create index if not exists econ_synthesis_cache_user_idx
  on public.econ_synthesis_cache (user_id, updated_at desc);

alter table public.econ_synthesis_cache enable row level security;

create policy econ_synthesis_cache_read_authed
  on public.econ_synthesis_cache for select
  to authenticated
  using (user_id is null or auth.uid() = user_id);

create policy econ_synthesis_cache_service_write
  on public.econ_synthesis_cache for all
  to service_role
  using (true)
  with check (true);
