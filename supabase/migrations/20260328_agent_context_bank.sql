-- S8-T8: Agent Context Bank — unified memory storage for all agents, user-scoped partitions

CREATE TABLE IF NOT EXISTS agent_context_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_shared BOOLEAN DEFAULT false,
  is_master BOOLEAN DEFAULT false,
  exclude_from_sync BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,

  CONSTRAINT fk_agent_context_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_context_bank_user ON agent_context_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_context_bank_agent ON agent_context_bank(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_context_bank_type ON agent_context_bank(memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_context_bank_shared ON agent_context_bank(user_id, is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_agent_context_bank_master ON agent_context_bank(is_master) WHERE is_master = true;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_agent_context_bank_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_context_bank_updated_at
  BEFORE UPDATE ON agent_context_bank
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_context_bank_updated_at();
