-- Boardroom Threads: persistent storage for completed DAG deliberation sessions
-- [claude-code 2026-04-11] S14-T2: boardroom thread persistence to Supabase

CREATE TABLE IF NOT EXISTS boardroom_threads (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  dag_id UUID REFERENCES agent_dags(id),
  title TEXT NOT NULL DEFAULT 'Untitled Session',
  participants TEXT[] NOT NULL DEFAULT '{}',
  messages JSONB NOT NULL DEFAULT '[]',
  intervention_messages JSONB NOT NULL DEFAULT '[]',
  meeting_notes TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_boardroom_threads_user ON boardroom_threads(user_id);
CREATE INDEX idx_boardroom_threads_updated ON boardroom_threads(updated_at DESC);
CREATE INDEX idx_boardroom_threads_dag ON boardroom_threads(dag_id);

-- RLS: users can manage their own threads
ALTER TABLE boardroom_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own threads" ON boardroom_threads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own threads" ON boardroom_threads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads" ON boardroom_threads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own threads" ON boardroom_threads
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to threads" ON boardroom_threads
  FOR ALL USING (auth.role() = 'service_role');
