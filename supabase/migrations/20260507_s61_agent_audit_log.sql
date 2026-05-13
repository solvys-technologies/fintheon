-- S61-T1: Agent audit log — persistent decision trail for all tool approvals and permission changes.
-- RLS: authenticated users read own records, service_role writes.

create table if not exists agent_audit_log (
  id              uuid primary key default gen_random_uuid(),
  agent_id        text not null,
  tool_name       text not null,
  tool_input      jsonb,
  description     text,
  decision        text not null check (decision in ('approved', 'denied', 'timed_out')),
  reason          text,
  surface         text not null default 'chat',
  correlation_id  text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);

-- RLS
alter table agent_audit_log enable row level security;

-- Authenticated users can read their own records
create policy "Users read own audit records"
  on agent_audit_log for select
  to authenticated
  using (created_by = auth.uid());

-- service_role bypasses RLS for writes (default Supabase behaviour)
-- No explicit policy needed; service_role is exempt from RLS.

-- Indexes
create index if not exists idx_agent_audit_log_agent_created
  on agent_audit_log (agent_id, created_at desc);

create index if not exists idx_agent_audit_log_correlation
  on agent_audit_log (correlation_id);
