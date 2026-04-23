-- Harper Vision — Screen + Audio perception layer tables
-- [claude-code 2026-04-23] Inspired by OMI's screen_activity.rs + transcript pipeline

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Screen capture frames
CREATE TABLE IF NOT EXISTS harper_vision_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  app_name text,
  window_title text,
  image_path text,
  description text,
  description_embedding vector(1536),
  display_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Transcripts from audio capture
CREATE TABLE IF NOT EXISTS harper_vision_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  transcript text NOT NULL,
  speaker_label text,
  confidence real,
  prosody jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_harper_vision_frames_user_session
  ON harper_vision_frames(user_id, session_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_harper_vision_frames_timestamp
  ON harper_vision_frames(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_harper_vision_transcripts_user_session
  ON harper_vision_transcripts(user_id, session_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_harper_vision_transcripts_timestamp
  ON harper_vision_transcripts(timestamp DESC);

-- Vector similarity search index (IVFFlat for cosine distance)
CREATE INDEX IF NOT EXISTS idx_harper_vision_frames_embedding
  ON harper_vision_frames USING ivfflat (description_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Row Level Security (RLS) policies
ALTER TABLE harper_vision_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE harper_vision_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY harper_vision_frames_user_isolation ON harper_vision_frames
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY harper_vision_transcripts_user_isolation ON harper_vision_transcripts
  FOR ALL USING (auth.uid() = user_id);

-- Auto-cleanup: delete frames older than 24 hours
-- Run via pg_cron or application-level janitor
CREATE OR REPLACE FUNCTION cleanup_harper_vision_frames()
RETURNS void AS $$
BEGIN
  DELETE FROM harper_vision_frames
  WHERE timestamp < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_harper_vision_transcripts()
RETURNS void AS $$
BEGIN
  DELETE FROM harper_vision_transcripts
  WHERE timestamp < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql;
