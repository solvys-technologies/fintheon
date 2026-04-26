-- [claude-code 2026-04-25] S35-Unified: cross-device notification state.
-- Adds cleared_at + dismissed_via to notifications so a "clear all" / "dismiss" on one
-- device propagates to all of a user's other devices via a __sync push event.
--
-- Reversible:
--   ALTER TABLE notifications DROP COLUMN IF EXISTS cleared_at;
--   ALTER TABLE notifications DROP COLUMN IF EXISTS dismissed_via;
--   DROP INDEX IF EXISTS idx_notifications_user_active;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_via TEXT;

-- "Active" = not read, not cleared, not suppressed. This is what the bell + toast list against.
-- The existing idx_notifications_user_unread is kept (still useful for unread count).
CREATE INDEX IF NOT EXISTS idx_notifications_user_active
  ON notifications (user_id, created_at DESC)
  WHERE read = FALSE AND cleared_at IS NULL AND suppressed = FALSE;

-- Service-role + self policies already exist on notifications; no policy changes needed
-- because cleared_at + dismissed_via are written by the user's own UPDATE (matched by user_id).
