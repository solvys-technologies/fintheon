CREATE OR REPLACE FUNCTION update_narrative_user_catalyst_bank_timestamp()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS narrative_user_catalyst_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'system',
  desk_id uuid REFERENCES narrative_desks(id) ON DELETE SET NULL,
  narrative_session_id uuid REFERENCES narrative_sessions(id) ON DELETE SET NULL,
  riskflow_item_id text NOT NULL,
  role text NOT NULL DEFAULT 'candidate',
  tags text[] NOT NULL DEFAULT '{}'::text[],
  desk_fit text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  source text NOT NULL DEFAULT 'riskflow',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, desk_id, riskflow_item_id)
);

DROP TRIGGER IF EXISTS trigger_narrative_user_catalyst_bank_updated
  ON narrative_user_catalyst_bank;
CREATE TRIGGER trigger_narrative_user_catalyst_bank_updated
  BEFORE UPDATE ON narrative_user_catalyst_bank
  FOR EACH ROW EXECUTE FUNCTION update_narrative_user_catalyst_bank_timestamp();

CREATE INDEX IF NOT EXISTS idx_narrative_user_catalyst_bank_user_latest
  ON narrative_user_catalyst_bank (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_narrative_user_catalyst_bank_desk
  ON narrative_user_catalyst_bank (desk_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_narrative_user_catalyst_bank_session
  ON narrative_user_catalyst_bank (narrative_session_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_narrative_user_catalyst_bank_item
  ON narrative_user_catalyst_bank (riskflow_item_id);
CREATE INDEX IF NOT EXISTS idx_narrative_user_catalyst_bank_tags
  ON narrative_user_catalyst_bank USING gin (tags);
