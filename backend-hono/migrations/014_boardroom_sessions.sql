-- [claude-code 2026-03-23] T1: Boardroom DB schema + store service
-- Boardroom: daily agent discussion sessions with persistent messages

-- Sessions table (one per day)
CREATE TABLE IF NOT EXISTS boardroom_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date DATE NOT NULL UNIQUE,
  title VARCHAR(255) DEFAULT 'Daily Session',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS boardroom_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES boardroom_sessions(id) ON DELETE CASCADE,
  agent VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(30) DEFAULT 'chat',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_boardroom_sessions_date ON boardroom_sessions (session_date DESC);
CREATE INDEX IF NOT EXISTS idx_boardroom_messages_session ON boardroom_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_boardroom_messages_agent ON boardroom_messages (agent);
CREATE INDEX IF NOT EXISTS idx_boardroom_messages_type ON boardroom_messages (message_type);
CREATE INDEX IF NOT EXISTS idx_boardroom_messages_created ON boardroom_messages (created_at DESC);
