-- [claude-code 2026-04-28] S47-T5: Commentary transcript table.
-- Stores user-watched commentary metadata + optional transcript text.
-- Transcript summary is pre-computed so Arbitrum context assembly is cheap.

CREATE TABLE IF NOT EXISTS public.commentary_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL,
  source_url text,
  title text,
  watched_at timestamptz NOT NULL DEFAULT now(),
  transcript_text text,
  transcript_summary text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text,
  confidence numeric
);

-- Index for Arbitrum context assembly (recent by user)
CREATE INDEX IF NOT EXISTS idx_commentary_transcripts_user_created
  ON public.commentary_transcripts(user_id, created_at DESC);

-- Index for global stats / diagnostics
CREATE INDEX IF NOT EXISTS idx_commentary_transcripts_created_at
  ON public.commentary_transcripts(created_at DESC);

-- Enable RLS
ALTER TABLE public.commentary_transcripts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own transcripts
CREATE POLICY "commentary_transcripts_user_select"
  ON public.commentary_transcripts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own transcripts
CREATE POLICY "commentary_transcripts_user_insert"
  ON public.commentary_transcripts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own transcripts
CREATE POLICY "commentary_transcripts_user_delete"
  ON public.commentary_transcripts
  FOR DELETE
  USING (auth.uid() = user_id);
