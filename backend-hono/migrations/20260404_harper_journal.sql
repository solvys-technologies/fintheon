-- Harper Journal — persistent inner monologue for autonomous Harper loop
-- Each entry represents an observation, decision, learning, or memo from Harper's autonomous operation.

CREATE TABLE IF NOT EXISTS harper_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type TEXT NOT NULL DEFAULT 'observation',  -- observation | decision | learning | memo | regime_shift | scoring_qa | narrative | brief_review
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}',                       -- structured metadata: { trigger, related_items, scores, instruments, confidence }
  tags TEXT[] DEFAULT '{}',                          -- searchable: scoring-qa, narrative, brief-review, regime, heartbeat, level4, vix, learning
  session_id TEXT,                                   -- links to autonomous loop session
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_harper_journal_type ON harper_journal(entry_type);
CREATE INDEX IF NOT EXISTS idx_harper_journal_created ON harper_journal(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_harper_journal_tags ON harper_journal USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_harper_journal_fts ON harper_journal
  USING gin(to_tsvector('english', COALESCE(content, '')));

-- Harper Ops Feed — action log for the Harper Ops panel visible to Chief
-- Shows autonomous actions, recommendations, alerts, and pending approvals.

CREATE TABLE IF NOT EXISTS harper_ops_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,                        -- heartbeat | analysis | alert | recommendation | execution | error
  title TEXT NOT NULL,                               -- short label (<60 chars)
  detail TEXT,                                       -- full markdown body
  severity TEXT DEFAULT 'info',                      -- info | warning | critical
  metadata JSONB DEFAULT '{}',                       -- structured payload: { task_type, related_ids, scores }
  requires_approval BOOLEAN DEFAULT false,
  approval_status TEXT,                              -- NULL | pending | approved | denied | auto
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_harper_ops_created ON harper_ops_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_harper_ops_type ON harper_ops_feed(action_type);
CREATE INDEX IF NOT EXISTS idx_harper_ops_approval ON harper_ops_feed(approval_status) WHERE requires_approval = true;
