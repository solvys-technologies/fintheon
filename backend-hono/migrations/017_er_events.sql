-- PsychAssist ER Events — deterministic scoring engine persistence
-- Stores every curse/breathing trigger and score change for audit + dashboard

create table if not exists er_events (
  id uuid default gen_random_uuid() primary key,
  user_id text not null default 'default',
  event_type text not null,              -- 'curse' | 'breathing' | 'decay_reset'
  trigger_text text,                     -- the matched phrase
  penalty numeric not null,              -- e.g. -1.25
  score_before numeric not null,
  score_after numeric not null,
  curse_count integer not null,          -- running count in current window
  decay_window_minutes numeric,          -- current decay duration
  transcript_snippet text,               -- first 200 chars of the transcript
  created_at timestamptz default now()
);

-- Index for per-user history queries
create index if not exists idx_er_events_user_created
  on er_events (user_id, created_at desc);
