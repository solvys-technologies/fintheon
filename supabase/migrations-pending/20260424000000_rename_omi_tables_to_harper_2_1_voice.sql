-- [claude-code 2026-04-24] STAGED, NOT APPLIED.
--
-- Renames the two Omi-era tables to Harper 2.1 Voice namespace. Kept in
-- supabase/migrations-pending/ so `supabase db push` does NOT pick it up
-- automatically — this is a coordinated rename that requires:
--
--   1. Code side is already shipped with the new names (this lives in the same
--      v5.23.2 deploy). Until then the INSERT/SELECT statements in
--      backend-hono/src/routes/harper-2.1-voice.ts still reference `omi_sessions`
--      and `omi_pairings`. Those strings were kept intentionally.
--
--   2. TP to move this file into supabase/migrations/ and run `supabase db push`
--      AFTER updating the code-side DB string references to the new table names
--      in the same commit. Suggested order:
--        a. git mv supabase/migrations-pending/20260424000000_...sql
--             supabase/migrations/20260424000000_...sql
--        b. sed -i '' 's/from("omi_sessions")/from("harper_2_1_voice_sessions")/g;
--                      s/from("omi_pairings")/from("harper_2_1_voice_pairings")/g;
--                      s/"omi_uid"/"harper_2_1_voice_device_uid"/g'
--             backend-hono/src/routes/harper-2.1-voice.ts
--             backend-hono/src/services/harper-2.1-voice/*.ts
--        c. supabase db push
--        d. Redeploy backend-hono to Fly.
--
-- If you just push this migration WITHOUT step (b), live queries against the
-- old names will 404 until the next code deploy. Keep the two in sync.

ALTER TABLE IF EXISTS public.omi_pairings RENAME TO harper_2_1_voice_pairings;
ALTER TABLE IF EXISTS public.harper_2_1_voice_pairings
  RENAME COLUMN omi_uid TO harper_2_1_voice_device_uid;

ALTER TABLE IF EXISTS public.omi_sessions RENAME TO harper_2_1_voice_sessions;

-- Rename the supporting indexes so they stay self-documenting.
ALTER INDEX IF EXISTS public.omi_pairings_omi_uid_idx
  RENAME TO harper_2_1_voice_pairings_device_uid_idx;
ALTER INDEX IF EXISTS public.omi_sessions_user_started_idx
  RENAME TO harper_2_1_voice_sessions_user_started_idx;
ALTER INDEX IF EXISTS public.omi_sessions_active_idx
  RENAME TO harper_2_1_voice_sessions_active_idx;
