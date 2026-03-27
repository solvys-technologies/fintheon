-- [claude-code 2026-03-26] T1: Agent Thought Bank — per-agent deep analysis storage
-- Agents store full analysis here; boardroom gets brief summaries only.

CREATE TABLE IF NOT EXISTS agent_thought_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL DEFAULT 'chat',
  title VARCHAR(255),
  full_analysis TEXT NOT NULL,
  brief_summary TEXT NOT NULL,
  session_id UUID REFERENCES boardroom_sessions(id),
  boardroom_message_id UUID REFERENCES boardroom_messages(id),
  context_snapshot_version INTEGER,
  instruments TEXT[] DEFAULT '{}',
  confidence REAL DEFAULT 0.5,
  referenced_thought_ids UUID[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours')
);

CREATE INDEX IF NOT EXISTS idx_thoughts_agent ON agent_thought_bank(agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_thoughts_category ON agent_thought_bank(category);
CREATE INDEX IF NOT EXISTS idx_thoughts_session ON agent_thought_bank(session_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_created ON agent_thought_bank(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_thoughts_message ON agent_thought_bank(boardroom_message_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_instruments ON agent_thought_bank USING GIN(instruments);
