-- [claude-code 2026-04-28] S47-T2: Desk Calendar authenticated insert policy.
-- Electron POSTs through the backend (service_role), but a narrow user-scoped
-- insert policy ensures direct client writes also work without weakening RLS.

create policy desk_calendar_events_authed_insert
  on public.desk_calendar_events for insert
  to authenticated
  with check (auth.uid() = ingested_by);
