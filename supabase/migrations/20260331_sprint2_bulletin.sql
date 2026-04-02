-- S12-T1: Bulletin board + voting tables
CREATE TABLE IF NOT EXISTS peer_bulletin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES users(id),
  author_agent TEXT,
  desk_id UUID REFERENCES desks(id),
  content TEXT NOT NULL,
  content_parts JSONB,
  parent_id UUID REFERENCES peer_bulletin(id),
  vote_up INT DEFAULT 0,
  vote_down INT DEFAULT 0,
  vote_check INT DEFAULT 0,
  vote_x INT DEFAULT 0,
  promoted_to_proposal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bulletin_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id UUID REFERENCES peer_bulletin(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  vote_type TEXT CHECK (vote_type IN ('up', 'down', 'check', 'x')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bulletin_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_bulletin_desk ON peer_bulletin(desk_id);
CREATE INDEX IF NOT EXISTS idx_peer_bulletin_parent ON peer_bulletin(parent_id);
CREATE INDEX IF NOT EXISTS idx_bulletin_votes_bulletin ON bulletin_votes(bulletin_id);

ALTER PUBLICATION supabase_realtime ADD TABLE peer_bulletin;
