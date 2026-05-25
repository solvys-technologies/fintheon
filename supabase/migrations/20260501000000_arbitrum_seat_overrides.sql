-- [claude-code 2026-05-01] S56 Track A: per-seat override prompts, context source
-- toggles, and category filter — stored alongside the chamber, appended at
-- deliberation time (buildSeatSystemPrompt). Readable by any authenticated user;
-- writable only by superadmin role.

CREATE TABLE IF NOT EXISTS public.arbitrum_seat_overrides (
  seat_id TEXT PRIMARY KEY,
  override_prompt TEXT DEFAULT '',
  context_sources TEXT[] DEFAULT '{}',
  category_filter TEXT DEFAULT 'all',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.arbitrum_seat_overrides ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read overrides (they're appended to prompts, not secrets)
CREATE POLICY "authenticated_read_overrides"
  ON public.arbitrum_seat_overrides
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only superadmin can write overrides
CREATE POLICY "superadmin_write_overrides"
  ON public.arbitrum_seat_overrides
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

CREATE POLICY "superadmin_update_overrides"
  ON public.arbitrum_seat_overrides
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );
