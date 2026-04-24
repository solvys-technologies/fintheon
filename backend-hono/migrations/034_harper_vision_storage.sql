-- [claude-code 2026-04-23] S32-T2 Harper Vision — private storage bucket for frame PNGs
-- Companion to 030_harper_vision.sql. The frame-store service uploads captures
-- to bucket "harper-vision" at path {user_id}/{session_id}/{frameIndex}.png;
-- the bucket is private (RLS enforced via harper_vision_frames row policies).

INSERT INTO storage.buckets (id, name, public)
VALUES ('harper-vision', 'harper-vision', false)
ON CONFLICT (id) DO NOTHING;
