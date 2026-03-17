-- Fix notifications table: align column names with application code
-- Code references is_read, read_at, priority, metadata but schema had read, data

ALTER TABLE IF EXISTS notifications
  RENAME COLUMN "read" TO is_read;

ALTER TABLE IF EXISTS notifications
  RENAME COLUMN data TO metadata;

ALTER TABLE IF EXISTS notifications
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Update indexes to match new column names
DROP INDEX IF EXISTS idx_notifications_read;
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
