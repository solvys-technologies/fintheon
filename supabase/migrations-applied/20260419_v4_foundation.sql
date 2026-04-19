-- [claude-code 2026-04-19] S24-T1 Foundation: RiskFlow V4 — classification matrix, proposals, lexicon, novelty cache, regime-lock columns.
-- Purpose: load-bearing schema for the V4 scoring rewrite. T2/T3 consume these tables; this migration must land first.
-- Idempotent: every statement uses IF NOT EXISTS / ON CONFLICT / DO-block guards so reruns are safe.

-- pgvector (available but not installed) — enable for speaker_utterance_cache embeddings.
-- Fallback token column is kept so T2 can choose Jaccard if embeddings aren't wired yet.
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 1. classification_matrix ────────────────────────────────────
-- regime → rubric (stance per eventType, keywords required for entry/exit, walk-back pairings)
-- One row per MARKET_REGIMES enum value; rubric JSONB is fully mutable by super-admin.
CREATE TABLE IF NOT EXISTS classification_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regime_type TEXT NOT NULL UNIQUE,
  rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_classification_matrix_regime ON classification_matrix (regime_type) WHERE active = TRUE;

ALTER TABLE classification_matrix ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role full access on classification_matrix" ON classification_matrix
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authed users read classification_matrix" ON classification_matrix
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: one row per MARKET_REGIMES enum value. Rubric defaults to stance-from-DEFAULT_REGIME_MULTIPLIERS;
-- T4 admin UI will edit these live. ON CONFLICT guards reruns.
INSERT INTO classification_matrix (regime_type, rubric, updated_by) VALUES
  ('BULL_TREND',         '{"stance":{"bullish":1.0,"bearish":0.5,"neutral":0.8},"entryKeywords":[],"exitKeywords":[],"walkBackPairs":[],"eventTypeOverrides":{"geopolitical":1.3,"conflict":1.3}}'::jsonb, 'seed-s24-t1'),
  ('BEAR_TREND',         '{"stance":{"bullish":3.0,"bearish":1.0,"neutral":0.8},"entryKeywords":[],"exitKeywords":[],"walkBackPairs":[],"eventTypeOverrides":{"geopolitical":1.5,"conflict":1.5}}'::jsonb, 'seed-s24-t1'),
  ('CONSOLIDATION',      '{"stance":{"bullish":0.8,"bearish":0.8,"neutral":0.7},"entryKeywords":[],"exitKeywords":[],"walkBackPairs":[],"eventTypeOverrides":{"technicalBreak":1.5}}'::jsonb, 'seed-s24-t1'),
  ('GEO_TENSIONS',       '{"stance":{"bullish":2.5,"bearish":1.5,"neutral":1.0},"entryKeywords":["ceasefire","armistice","peace deal"],"exitKeywords":["de-escalation","withdrawal"],"walkBackPairs":[["ceasefire confirmed","ceasefire collapsed"],["truce signed","truce broken"]],"eventTypeOverrides":{"geopolitical":1.5,"tariffs":1.5,"conflict":1.5,"chinaTrade":1.5,"cpiPrint":0.3,"ppiPrint":0.3,"nfpPrint":0.3,"gdpPrint":0.3,"jobless":0.3}}'::jsonb, 'seed-s24-t1'),
  ('MACRO_ECON',         '{"stance":{"bullish":1.2,"bearish":1.2,"neutral":1.0},"entryKeywords":["rate decision","cpi","pce","nfp"],"exitKeywords":[],"walkBackPairs":[],"eventTypeOverrides":{"fedDecision":1.5,"fomc":1.5,"powellSpeak":1.5,"cpiPrint":1.5,"nfpPrint":1.5,"pcePrint":1.3,"ppiPrint":1.3,"gdpPrint":1.3,"jolts":1.2,"geopolitical":0.5,"tariffs":0.5,"conflict":0.5}}'::jsonb, 'seed-s24-t1'),
  ('RISK_OFF',           '{"stance":{"bullish":2.0,"bearish":1.3,"neutral":0.9},"entryKeywords":["credit spread","liquidity stress","bank failure"],"exitKeywords":["fed backstop","liquidity injection"],"walkBackPairs":[],"eventTypeOverrides":{"liquidityStress":1.5,"bankStress":1.5,"creditSpreadWidening":1.5}}'::jsonb, 'seed-s24-t1'),
  ('EARNINGS_SEASON',    '{"stance":{"bullish":1.0,"bearish":1.0,"neutral":0.8},"entryKeywords":["earnings","eps beat","eps miss","guidance"],"exitKeywords":[],"walkBackPairs":[],"eventTypeOverrides":{"earningsHighImpact":2.0,"earningsMidCap":1.5,"earnings":1.5,"cpiPrint":0.5,"nfpPrint":0.5,"fedDecision":0.7}}'::jsonb, 'seed-s24-t1'),
  ('ILLIQUID_STUPIDITY', '{"stance":{"bullish":3.0,"bearish":2.0,"neutral":1.0},"entryKeywords":["repo stress","funding strain","dealer balance sheet"],"exitKeywords":["fed intervention","repo facility"],"walkBackPairs":[],"eventTypeOverrides":{"liquidityStress":2.0,"bankStress":2.0,"creditSpreadWidening":1.8,"fedDecision":3.0,"fomc":2.5,"powellSpeak":2.5}}'::jsonb, 'seed-s24-t1')
ON CONFLICT (regime_type) DO NOTHING;


-- ── 2. regime_proposals ────────────────────────────────────────
-- Agent proposes → super admin approves/denies. MDB generator now writes here instead of setRegime().
CREATE TABLE IF NOT EXISTS regime_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_regime TEXT NOT NULL,
  current_regime TEXT,
  reason TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | denied | auto-applied
  approved_by UUID,
  decided_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regime_proposals_status_created ON regime_proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_regime_proposals_pending ON regime_proposals (created_at DESC) WHERE status = 'pending';

ALTER TABLE regime_proposals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role full access on regime_proposals" ON regime_proposals
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authed users read regime_proposals" ON regime_proposals
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 3. lexicon_keywords ────────────────────────────────────────
-- Curated keyword → sentiment + regime-flip mapping. `approved=false` rows are candidates awaiting TP review.
CREATE TABLE IF NOT EXISTS lexicon_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  phrase_pattern TEXT,
  sentiment TEXT NOT NULL DEFAULT 'neutral', -- bullish | bearish | neutral
  is_matrix_flip BOOLEAN NOT NULL DEFAULT FALSE,
  target_regime TEXT,
  requires_action_verb BOOLEAN NOT NULL DEFAULT TRUE,
  added_by TEXT,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lexicon_keywords_approved ON lexicon_keywords (approved, keyword);
CREATE INDEX IF NOT EXISTS idx_lexicon_keywords_keyword_lower ON lexicon_keywords (LOWER(keyword));
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lexicon_keyword_lower ON lexicon_keywords (LOWER(keyword));

ALTER TABLE lexicon_keywords ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role full access on lexicon_keywords" ON lexicon_keywords
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authed users read lexicon_keywords" ON lexicon_keywords
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 4. lexicon_proposals ───────────────────────────────────────
-- Agent-proposed keyword additions pending TP approval. Same shape family as regime_proposals.
CREATE TABLE IF NOT EXISTS lexicon_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  phrase_pattern TEXT,
  sentiment TEXT NOT NULL DEFAULT 'neutral',
  is_matrix_flip BOOLEAN NOT NULL DEFAULT FALSE,
  target_regime TEXT,
  requires_action_verb BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | denied
  approved_by UUID,
  decided_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lexicon_proposals_status_created ON lexicon_proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lexicon_proposals_pending ON lexicon_proposals (created_at DESC) WHERE status = 'pending';

ALTER TABLE lexicon_proposals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role full access on lexicon_proposals" ON lexicon_proposals
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authed users read lexicon_proposals" ON lexicon_proposals
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 5. speaker_utterance_cache ─────────────────────────────────
-- Novelty tracking for T2's speaker-repetition filter. Both embedding + tokens columns
-- are nullable so T2 can choose cosine-sim (pgvector) or Jaccard (text[]) at runtime.
-- TTL policy: rows older than 7 days are stale — cleanup is the caller's job (nightly cron).
CREATE TABLE IF NOT EXISTS speaker_utterance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker TEXT NOT NULL,
  headline_hash TEXT NOT NULL,
  headline_text TEXT NOT NULL,
  embedding vector(384),
  tokens TEXT[],
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_speaker_utterance_speaker_seen ON speaker_utterance_cache (speaker, seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_speaker_utterance_hash ON speaker_utterance_cache (headline_hash);
-- ivfflat requires data to build; defer the vector index to a follow-up migration after seed data exists.

ALTER TABLE speaker_utterance_cache ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role full access on speaker_utterance_cache" ON speaker_utterance_cache
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 6. market_regimes regime-lock columns ──────────────────────
-- TP's manual override must hold a 24h lock so agents can't silently overwrite it (the 2026-04-17 incident).
-- locked_until > now() means proposeRegimeChange() creates a pending proposal instead of auto-applying.
ALTER TABLE market_regimes ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE market_regimes ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_market_regimes_locked_until ON market_regimes (locked_until) WHERE locked_until IS NOT NULL;
