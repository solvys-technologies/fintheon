-- [claude-code 2026-05-03] S58-T1: encrypted user-owned AI API keys.
create table if not exists public.user_api_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  encrypted_key text not null,
  key_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider),
  constraint user_api_keys_provider_check check (provider in ('deepseek'))
);

create index if not exists user_api_keys_user_id_idx
  on public.user_api_keys (user_id);

alter table public.user_api_keys enable row level security;

drop policy if exists user_api_keys_select_own on public.user_api_keys;
create policy user_api_keys_select_own
  on public.user_api_keys for select
  using (auth.uid() = user_id);

drop policy if exists user_api_keys_insert_own on public.user_api_keys;
create policy user_api_keys_insert_own
  on public.user_api_keys for insert
  with check (auth.uid() = user_id);

drop policy if exists user_api_keys_update_own on public.user_api_keys;
create policy user_api_keys_update_own
  on public.user_api_keys for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_api_keys_delete_own on public.user_api_keys;
create policy user_api_keys_delete_own
  on public.user_api_keys for delete
  using (auth.uid() = user_id);
