-- [S35-T2] Arbitrum verdicts table — deliberation engine output
-- Replaces miroshark_deliberations (dropped in S35-T9)

CREATE TABLE IF NOT EXISTS public.arbitrum_verdicts (
  verdict_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event', 'session', 'manual')),
  question TEXT NOT NULL,
  category TEXT NOT NULL,
  seats JSONB NOT NULL DEFAULT '[]'::jsonb,
  consensus_probability NUMERIC(5,4) CHECK (consensus_probability >= 0 AND consensus_probability <= 1),
  confidence NUMERIC(5,4) CHECK (confidence >= 0 AND confidence <= 1),
  dissent JSONB,
  gates_surfaced JSONB NOT NULL DEFAULT '{}'::jsonb,
  digest_text TEXT NOT NULL,
  iv_simulation JSONB,
  trigger_source JSONB,
  latency_ms INTEGER,
  model_cost_usd NUMERIC(10,6)
);

CREATE INDEX IF NOT EXISTS idx_arbitrum_verdicts_created_at
  ON public.arbitrum_verdicts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_arbitrum_verdicts_trigger_type_created
  ON public.arbitrum_verdicts (trigger_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_arbitrum_verdicts_category
  ON public.arbitrum_verdicts (category);

-- RLS (defense-in-depth; backend uses service_role key which bypasses RLS by design)
ALTER TABLE public.arbitrum_verdicts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read verdicts (the digest is UI content, not user-owned data)
CREATE POLICY "authenticated_read_arbitrum_verdicts"
  ON public.arbitrum_verdicts
  FOR SELECT
  TO authenticated
  USING (true);

-- No client writes — only service_role inserts/updates
-- (No INSERT/UPDATE/DELETE policies = denied for authenticated; service_role bypasses)

COMMENT ON TABLE public.arbitrum_verdicts IS
  'Arbitrum deliberation engine verdicts. Replaces miroshark_deliberations (dropped in S35-T9). Backend writes via service_role; clients read the digest_text.';

COMMENT ON COLUMN public.arbitrum_verdicts.seats IS
  'JSONB array of per-seat transcripts: [{id, role, model, provider, weight, rounds: [{round, probability, confidence, rationale, risks}]}]';

COMMENT ON COLUMN public.arbitrum_verdicts.dissent IS
  'JSONB object if any seat disagreed by > 18pp from weighted mean: {seat, rationale, magnitude_pp}';

COMMENT ON COLUMN public.arbitrum_verdicts.gates_surfaced IS
  'JSONB object with signals (NOT vetoes): {consensus_spread_pp, category_quality, calibration_watermark}';

COMMENT ON COLUMN public.arbitrum_verdicts.trigger_source IS
  'JSONB capturing what fired the event trigger: {riskflow_item_id, speaker, iv_score} — null for session runs';
