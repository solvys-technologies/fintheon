-- [claude-code 2026-04-20] S21-T5: Per-user feature override table.
-- Fintheon's feature-flag-service previously resolved only env vars → JSON blob → code default.
-- This table adds a fourth resolution layer: per-user overrides that win over all three.
-- Used first for the PsychAssist fork granted to reasoning@pricedinresearch.io.

create table if not exists public.user_feature_overrides (
  user_id    uuid not null references auth.users(id) on delete cascade,
  feature    text not null,
  enabled    boolean not null default true,
  config     jsonb default '{}'::jsonb,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature)
);

create index if not exists user_feature_overrides_feature_idx
  on public.user_feature_overrides (feature);

alter table public.user_feature_overrides enable row level security;

-- Users can read their own overrides (UI needs this to decide what to render).
create policy user_feature_overrides_self_read on public.user_feature_overrides
  for select using (auth.uid() = user_id);

-- Writes go through the service role key via the backend admin endpoints.
-- No direct client write policy on purpose.
