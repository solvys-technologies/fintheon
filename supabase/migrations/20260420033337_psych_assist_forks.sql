-- [claude-code 2026-04-20] S21-T5: PsychAssist personal forks.
-- Users granted the `psych_assist_fork.edit` override can author their own
-- Coach system prompt + ER weights + tilt thresholds. One row per user max.

create table if not exists public.psych_assist_forks (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  system_prompt    text,
  er_weights       jsonb default '{}'::jsonb,
  tilt_thresholds  jsonb default '{}'::jsonb,
  notes            text,
  updated_at       timestamptz not null default now()
);

alter table public.psych_assist_forks enable row level security;

-- Self read/write. Admin endpoints additionally gate on
-- `psych_assist_fork.edit` in the user_feature_overrides table.
create policy psych_assist_forks_self on public.psych_assist_forks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
