-- [claude-code 2026-04-24] S34-T1: Refinement Engine econ-watch filter surface.
-- Drives which econ events the populator writes to economic_events and which
-- show up in the countdown modal. Seed = 7 countries × 4 categories = 28 rows
-- all active. Global rows now (user_id NULL); nullable user_id is reserved for
-- per-user overrides in a follow-up. No ownership enforcement yet.

create table if not exists public.econ_watch_filters (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  category text not null,
  active boolean not null default true,
  user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country, category, user_id)
);

create index if not exists econ_watch_filters_country_category_idx
  on public.econ_watch_filters (country, category);

create index if not exists econ_watch_filters_active_idx
  on public.econ_watch_filters (active) where active = true;

-- Keep updated_at fresh on write.
create or replace function public.econ_watch_filters_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists econ_watch_filters_updated_at on public.econ_watch_filters;
create trigger econ_watch_filters_updated_at
  before update on public.econ_watch_filters
  for each row execute function public.econ_watch_filters_set_updated_at();

-- Seed 7 countries × 4 categories = 28 global rows. Idempotent on (country, category, user_id).
insert into public.econ_watch_filters (country, category, active, user_id)
values
  ('US',  'Fiscal',       true, null),
  ('US',  'Supply Chain', true, null),
  ('US',  'Inflation',    true, null),
  ('US',  'Job Market',   true, null),
  ('EU',  'Fiscal',       true, null),
  ('EU',  'Supply Chain', true, null),
  ('EU',  'Inflation',    true, null),
  ('EU',  'Job Market',   true, null),
  ('UK',  'Fiscal',       true, null),
  ('UK',  'Supply Chain', true, null),
  ('UK',  'Inflation',    true, null),
  ('UK',  'Job Market',   true, null),
  ('JP',  'Fiscal',       true, null),
  ('JP',  'Supply Chain', true, null),
  ('JP',  'Inflation',    true, null),
  ('JP',  'Job Market',   true, null),
  ('NZ',  'Fiscal',       true, null),
  ('NZ',  'Supply Chain', true, null),
  ('NZ',  'Inflation',    true, null),
  ('NZ',  'Job Market',   true, null),
  ('AU',  'Fiscal',       true, null),
  ('AU',  'Supply Chain', true, null),
  ('AU',  'Inflation',    true, null),
  ('AU',  'Job Market',   true, null),
  ('CA',  'Fiscal',       true, null),
  ('CA',  'Supply Chain', true, null),
  ('CA',  'Inflation',    true, null),
  ('CA',  'Job Market',   true, null)
on conflict (country, category, user_id) do nothing;
