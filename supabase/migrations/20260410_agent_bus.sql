-- AgentBus: DAG + Task persistence for multi-agent orchestration
-- [claude-code 2026-04-10] S8-T1: agent_dags + agent_tasks tables with RLS

CREATE TABLE IF NOT EXISTS agent_dags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  surface TEXT NOT NULL CHECK (surface IN ('chat','sidebar','narrative','boardroom')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','failed','cancelled')),
  template TEXT,
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dag_id UUID NOT NULL REFERENCES agent_dags(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('analysis','scoring','synthesis','discovery','deliberation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','failed','cancelled','timeout')),
  wave INTEGER NOT NULL DEFAULT 0,
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  deps UUID[] DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error TEXT
);

CREATE INDEX idx_agent_tasks_dag ON agent_tasks(dag_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status) WHERE status IN ('pending','running');
CREATE INDEX idx_agent_dags_status ON agent_dags(status) WHERE status IN ('pending','running');

-- RLS: users can only see their own DAGs
ALTER TABLE agent_dags ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own DAGs" ON agent_dags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to DAGs" ON agent_dags
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own tasks" ON agent_tasks
  FOR SELECT USING (
    dag_id IN (SELECT id FROM agent_dags WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access to tasks" ON agent_tasks
  FOR ALL USING (auth.role() = 'service_role');
