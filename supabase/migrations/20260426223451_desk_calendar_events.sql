-- [claude-code 2026-04-26] S46: TV Calendar Final Integration.
-- Captures TradingView .ics downloads intercepted by the Electron main process.
-- Desk Theme agents read from this table to form the daily theme.
-- ics_uid is the canonical idempotency key (.ics UID field), so reclicking the
-- same TV event on a different machine is a no-op.

create table if not exists public.desk_calendar_events (
  id uuid primary key default gen_random_uuid(),
  ics_uid text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz,
  title text not null,
  description text,
  source_url text,
  severity smallint,
  raw_ics text not null,
  ingested_by uuid references auth.users(id),
  ingested_at timestamptz not null default now()
);

create index if not exists desk_calendar_events_starts_at_idx
  on public.desk_calendar_events (starts_at desc);

create index if not exists desk_calendar_events_ingested_at_idx
  on public.desk_calendar_events (ingested_at desc);

alter table public.desk_calendar_events enable row level security;

create policy desk_calendar_events_read_authed
  on public.desk_calendar_events for select
  to authenticated
  using (true);

create policy desk_calendar_events_service_write
  on public.desk_calendar_events for all
  to service_role
  using (true)
  with check (true);
