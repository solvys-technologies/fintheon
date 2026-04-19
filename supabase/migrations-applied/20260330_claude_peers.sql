-- [claude-code 2026-03-30] Sprint 1: Claude Peers infra + boardroom additive columns

-- Users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT NOT NULL,
  role TEXT DEFAULT 'peer' CHECK (role IN ('admin', 'peer')),
  avatar_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Desks
CREATE TABLE IF NOT EXISTS desks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sector_focus TEXT[] DEFAULT '{}'::text[],
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Claude Peers (device registration)
CREATE TABLE IF NOT EXISTS claude_peers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  device_name TEXT NOT NULL,
  platform TEXT DEFAULT 'darwin',
  capabilities TEXT[] DEFAULT '{}'::text[],
  desk_id UUID REFERENCES desks(id),
  assigned_agents TEXT[] DEFAULT '{}'::text[],
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'away', 'offline')),
  heartbeat_at TIMESTAMPTZ DEFAULT now(),
  hermes_available BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Boardroom evolution (additive nullable columns)
ALTER TABLE boardroom_messages
  ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES boardroom_messages(id),
  ADD COLUMN IF NOT EXISTS peer_id UUID REFERENCES claude_peers(id),
  ADD COLUMN IF NOT EXISTS content_parts JSONB;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_claude_peers_user_id ON claude_peers(user_id);
CREATE INDEX IF NOT EXISTS idx_claude_peers_status ON claude_peers(status);
CREATE INDEX IF NOT EXISTS idx_claude_peers_heartbeat ON claude_peers(heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_boardroom_messages_thread_id ON boardroom_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_boardroom_messages_peer_id ON boardroom_messages(peer_id);

-- Enable Supabase Realtime on peer tables (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'claude_peers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE claude_peers;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'desks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE desks;
  END IF;
END $$;

