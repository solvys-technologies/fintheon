-- S2-T4: Calibration DB tables — scoring weights, annotations, observations

CREATE TABLE IF NOT EXISTS scoring_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL UNIQUE,
  base_weight DECIMAL(4,2) NOT NULL,
  regime_overrides JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS refinement_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  riskflow_item_id TEXT NOT NULL,
  comment TEXT,
  flaw_tag TEXT,
  suggested_score DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'tp'
);
CREATE INDEX IF NOT EXISTS idx_annotation_item ON refinement_annotations(riskflow_item_id);

CREATE TABLE IF NOT EXISTS calibration_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline TEXT NOT NULL,
  event_type TEXT,
  predicted_iv_score DECIMAL(4,2),
  actual_points_move DECIMAL(8,2),
  instrument TEXT DEFAULT '/ES',
  regime_at_time TEXT,
  vix_at_time DECIMAL(6,2),
  observed_at TIMESTAMPTZ,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now()
);
