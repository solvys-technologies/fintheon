-- S13-T3: Shared Memory + Analysis History FTS
-- Team-level key-value store for cross-agent memory with optional TTL

CREATE TABLE IF NOT EXISTS peer_shared_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  peer_id UUID REFERENCES claude_peers(id),
  agent_name TEXT,
  category TEXT DEFAULT 'custom',
  ttl_hours INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_memory_key ON peer_shared_memory(key);
CREATE INDEX IF NOT EXISTS idx_shared_memory_category ON peer_shared_memory(category);

-- FTS index on thought bank for cross-agent analysis search
CREATE INDEX IF NOT EXISTS idx_thought_bank_fts ON agent_thought_bank
  USING gin(to_tsvector('english', COALESCE(full_analysis, '') || ' ' || COALESCE(brief_summary, '')));
