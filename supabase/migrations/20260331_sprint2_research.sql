-- S12-T3: Research task board
CREATE TABLE IF NOT EXISTS research_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  narrative TEXT,
  assigned_to UUID REFERENCES users(id),
  assigned_agent TEXT,
  desk_id UUID REFERENCES desks(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'deep-dive', 'complete')),
  findings JSONB,
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_tasks_desk ON research_tasks(desk_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_status ON research_tasks(status);
