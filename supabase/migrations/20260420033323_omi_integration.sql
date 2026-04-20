-- [claude-code 2026-04-20] S21: Omi voice integration — pairings, sessions, transcript snapshots
-- Part of the Omi voice layer sprint. Adds four tables + one view that support:
--   1. Per-user Omi account pairing (OAuth linkage)
--   2. Live voice session tracking (which agent is handling what)
--   3. Transcript persistence for post-session review / Performance journal
--   4. Prosody samples used to feed the PsychAssist tilt model

-- ── omi_pairings ──────────────────────────────────────────────────────────
-- Links a Fintheon user to an Omi cloud account. One row per user max.
create table if not exists public.omi_pairings (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  omi_uid       text not null,
  access_token  text,
  refresh_token text,
  scope         text,
  paired_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists omi_pairings_omi_uid_idx
  on public.omi_pairings (omi_uid);

-- ── omi_sessions ──────────────────────────────────────────────────────────
-- Live voice session tracking. A session starts when one of the three triggers
-- fires (psych_assist / voice_assistant / performance_chat) and ends when the
-- user stops it or it times out.
create table if not exists public.omi_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  trigger             text not null check (trigger in ('psych_assist', 'voice_assistant', 'performance_chat')),
  primary_agent       text not null default 'coach',
  status              text not null default 'active' check (status in ('active', 'ended', 'error')),
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  transcript_snapshot jsonb,
  metadata            jsonb default '{}'::jsonb
);

create index if not exists omi_sessions_user_started_idx
  on public.omi_sessions (user_id, started_at desc);

create index if not exists omi_sessions_active_idx
  on public.omi_sessions (user_id)
  where status = 'active';

-- ── omi_transcript_segments ──────────────────────────────────────────────
-- Streamed segments from Omi real-time transcript webhook.
create table if not exists public.omi_transcript_segments (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.omi_sessions(id) on delete cascade,
  speaker     text,
  speaker_id  text,
  is_user     boolean not null default false,
  text        text not null,
  start_ms    int,
  end_ms      int,
  received_at timestamptz not null default now()
);

create index if not exists omi_transcript_segments_session_idx
  on public.omi_transcript_segments (session_id, received_at);

-- ── omi_prosody_samples ──────────────────────────────────────────────────
-- Voice-stress features computed from the audio-bytes webhook. Each row is one
-- windowed measurement used to nudge the PsychAssist ER/tilt score.
create table if not exists public.omi_prosody_samples (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.omi_sessions(id) on delete cascade,
  sampled_at     timestamptz not null default now(),
  arousal        real,
  pitch_variance real,
  speaking_rate  real,
  energy         real,
  frustration    real
);

create index if not exists omi_prosody_samples_session_idx
  on public.omi_prosody_samples (session_id, sampled_at);

-- RLS
alter table public.omi_pairings           enable row level security;
alter table public.omi_sessions           enable row level security;
alter table public.omi_transcript_segments enable row level security;
alter table public.omi_prosody_samples    enable row level security;

create policy omi_pairings_self on public.omi_pairings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy omi_sessions_self on public.omi_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy omi_transcripts_self on public.omi_transcript_segments
  for all using (exists (
    select 1 from public.omi_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

create policy omi_prosody_self on public.omi_prosody_samples
  for all using (exists (
    select 1 from public.omi_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));
