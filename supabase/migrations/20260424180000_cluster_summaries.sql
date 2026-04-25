-- [claude-code 2026-04-24] S36 ClusterBeam — cached AI summaries keyed by sha1(sorted cardIds)
-- Warm-cache tier for the cluster summarizer service. In-memory is first tier; this is second.

CREATE TABLE IF NOT EXISTS public.cluster_summaries (
  group_hash       text        PRIMARY KEY,
  group_id         text        NOT NULL,
  narrative_slug   text,
  summary_json     jsonb       NOT NULL,
  ts               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cluster_summaries_ts_idx
  ON public.cluster_summaries (ts DESC);

ALTER TABLE public.cluster_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cluster_summaries_read_authed ON public.cluster_summaries;
CREATE POLICY cluster_summaries_read_authed
  ON public.cluster_summaries FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS cluster_summaries_write_service ON public.cluster_summaries;
CREATE POLICY cluster_summaries_write_service
  ON public.cluster_summaries FOR INSERT
  TO service_role
  WITH CHECK (true);
