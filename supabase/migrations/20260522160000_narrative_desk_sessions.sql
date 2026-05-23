CREATE TABLE IF NOT EXISTS narrative_desks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  color text NOT NULL DEFAULT '#c79f4a',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS narrative_desk_members (
  desk_id uuid NOT NULL REFERENCES narrative_desks(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (desk_id, user_id)
);

CREATE TABLE IF NOT EXISTS narrative_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desk_id uuid NOT NULL REFERENCES narrative_desks(id) ON DELETE CASCADE,
  title text NOT NULL,
  color text NOT NULL DEFAULT '#c79f4a',
  status text NOT NULL DEFAULT 'active',
  created_by text,
  updated_by text,
  last_opened_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS narrative_session_catalysts (
  session_id uuid NOT NULL REFERENCES narrative_sessions(id) ON DELETE CASCADE,
  riskflow_item_id text NOT NULL,
  role text NOT NULL DEFAULT 'anchor',
  conflict_score numeric,
  conflict_label text,
  selected_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, riskflow_item_id)
);

CREATE TABLE IF NOT EXISTS narrative_session_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES narrative_sessions(id) ON DELETE CASCADE,
  artifact_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, artifact_type, version)
);

CREATE TABLE IF NOT EXISTS narrative_session_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES narrative_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS narrative_agent_work_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES narrative_sessions(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  event_type text NOT NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS narrative_session_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES narrative_sessions(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  source text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS narrative_session_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES narrative_sessions(id) ON DELETE CASCADE,
  tag text NOT NULL,
  confidence numeric NOT NULL DEFAULT 1.0,
  source text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, tag, source)
);

CREATE OR REPLACE FUNCTION update_narrative_desk_session_timestamp()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_narrative_desks_updated ON narrative_desks;
CREATE TRIGGER trigger_narrative_desks_updated
  BEFORE UPDATE ON narrative_desks
  FOR EACH ROW EXECUTE FUNCTION update_narrative_desk_session_timestamp();

DROP TRIGGER IF EXISTS trigger_narrative_desk_members_updated ON narrative_desk_members;
CREATE TRIGGER trigger_narrative_desk_members_updated
  BEFORE UPDATE ON narrative_desk_members
  FOR EACH ROW EXECUTE FUNCTION update_narrative_desk_session_timestamp();

DROP TRIGGER IF EXISTS trigger_narrative_sessions_updated ON narrative_sessions;
CREATE TRIGGER trigger_narrative_sessions_updated
  BEFORE UPDATE ON narrative_sessions
  FOR EACH ROW EXECUTE FUNCTION update_narrative_desk_session_timestamp();

CREATE INDEX IF NOT EXISTS idx_narrative_sessions_desk_latest
  ON narrative_sessions (desk_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_narrative_session_catalysts_item
  ON narrative_session_catalysts (riskflow_item_id);
CREATE INDEX IF NOT EXISTS idx_narrative_session_artifacts_latest
  ON narrative_session_artifacts (session_id, artifact_type, version DESC);
CREATE INDEX IF NOT EXISTS idx_narrative_session_messages_latest
  ON narrative_session_messages (session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_narrative_agent_work_events_latest
  ON narrative_agent_work_events (session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_narrative_session_links_session
  ON narrative_session_links (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_narrative_session_tags_session
  ON narrative_session_tags (session_id, tag);

INSERT INTO narrative_desks (name, slug, color, created_by)
VALUES ('Priced In Capital', 'priced-in-capital', '#c79f4a', 'system')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  updated_at = now();
