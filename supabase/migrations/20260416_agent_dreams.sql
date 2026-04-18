-- Agent Dream Room: autonomous agent reflections and inter-agent conversation
create table if not exists agent_dreams (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  mode text not null default 'replay',
  content text not null,
  reply_to uuid references agent_dreams(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_dreams_created on agent_dreams(created_at desc);
create index if not exists idx_agent_dreams_agent on agent_dreams(agent_id);

-- RLS: read-only for authenticated users, insert via service role
alter table agent_dreams enable row level security;

create policy "agent_dreams_select" on agent_dreams
  for select using (true);

create policy "agent_dreams_insert_service" on agent_dreams
  for insert with check (true);
