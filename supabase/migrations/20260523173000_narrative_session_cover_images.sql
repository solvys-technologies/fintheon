ALTER TABLE narrative_sessions
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS cover_image_prompt text,
  ADD COLUMN IF NOT EXISTS cover_image_updated_at timestamptz;

ALTER TABLE narrative_desks
  ADD COLUMN IF NOT EXISTS map_image_url text,
  ADD COLUMN IF NOT EXISTS map_image_prompt text,
  ADD COLUMN IF NOT EXISTS map_image_updated_at timestamptz;
