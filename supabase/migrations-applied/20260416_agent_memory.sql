-- Agent Memory: persistent per-agent learning storage
-- Complementary to thought_bank (ephemeral 48h) — this is long-term memory

CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id VARCHAR(50) NOT NULL, -- 'oracle', 'feucht', 'consul', 'herald', 'harper'
  memory_type VARCHAR(50) NOT NULL, -- 'deliberation_output', 'accuracy_feedback', 'reflect_finding', 'learned_pattern'
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- NULL = permanent
);

CREATE INDEX idx_agent_memory_agent ON agent_memory(agent_id, memory_type);
CREATE INDEX idx_agent_memory_created ON agent_memory(created_at DESC);
CREATE INDEX idx_agent_memory_expires ON agent_memory(expires_at) WHERE expires_at IS NOT NULL;

-- RLS: service role only (agents write via backend, not direct client access)
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON agent_memory
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
