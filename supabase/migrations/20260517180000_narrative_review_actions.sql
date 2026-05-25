CREATE TABLE IF NOT EXISTS narrative_review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis_id text NOT NULL,
  action text NOT NULL,
  reason text NOT NULL,
  note text,
  actor_id text NOT NULL,
  task_id text,
  hypothesis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_narrative_review_actions_latest
  ON narrative_review_actions (hypothesis_id, created_at DESC);
