-- [claude-code 2026-04-24] SEV-1: ai_conversations/ai_messages tenancy lockdown.
--
-- Root cause: backend handlers fell back to a literal userId = 'anonymous' on
-- every unauthed request, so multiple unauthed users shared one bucket AND an
-- authed user could silently reassign anon rows to themselves on GET. This
-- migration is defense-in-depth:
--   1. Quarantine every pre-existing 'anonymous' row (archive + metadata flag)
--      so legacy anon conversations are no longer served to anyone. We do NOT
--      delete; the rows stay for TP's forensic review.
--   2. Enforce user_id uniqueness with a check that blocks any future writes
--      keyed on the literal string 'anonymous'.
--   3. Enable Row Level Security so even if a future app-level bug forgets to
--      filter by user_id, the database refuses cross-tenant reads.
--
-- Safe to apply on an empty schema (conditional on table existence).

-- 1. Quarantine legacy anonymous rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_conversations'
  ) THEN
    UPDATE public.ai_conversations
      SET
        is_archived = TRUE,
        metadata = COALESCE(metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'quarantined_at', NOW()::text,
            'quarantined_reason', 'anonymous_tenancy_lockdown_2026_04_24',
            'legacy_user_id', user_id
          ),
        user_id = 'quarantined:' || id::text
      WHERE user_id = 'anonymous';
  END IF;
END
$$;

-- 2. Block future writes with user_id = 'anonymous'.
ALTER TABLE IF EXISTS public.ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_no_anonymous;
ALTER TABLE IF EXISTS public.ai_conversations
  ADD CONSTRAINT ai_conversations_no_anonymous
  CHECK (user_id <> 'anonymous');

ALTER TABLE IF EXISTS public.ai_messages
  DROP CONSTRAINT IF EXISTS ai_messages_no_anonymous;
ALTER TABLE IF EXISTS public.ai_messages
  ADD CONSTRAINT ai_messages_no_anonymous
  CHECK (user_id IS NULL OR user_id <> 'anonymous');

-- 3. RLS as defense-in-depth.
--    The backend uses the service_role key, which bypasses RLS by design — so
--    existing code keeps working. RLS protects against a future mistake where
--    someone wires the anon key into a handler that forgets the WHERE clause.
ALTER TABLE IF EXISTS public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_conversations_owner_select ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_select ON public.ai_conversations
  FOR SELECT USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS ai_conversations_owner_modify ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_modify ON public.ai_conversations
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS ai_messages_owner_select ON public.ai_messages;
CREATE POLICY ai_messages_owner_select ON public.ai_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS ai_messages_owner_modify ON public.ai_messages;
CREATE POLICY ai_messages_owner_modify ON public.ai_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()::text
    )
  );
