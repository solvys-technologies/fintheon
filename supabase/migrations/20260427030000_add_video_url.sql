-- [claude-code 2026-04-27] S46.4/I: add video_url to raw + scored riskflow
-- tables. Worker x-handles-browser extracts highest-bitrate mp4 from
-- extended_entities.media[].video_info.variants[] for tweets attaching a
-- video or animated_gif; central-scorer + persist + API thread it through
-- so RiskFlowDetailCard can render <video> inline (OSINT-prioritized).
ALTER TABLE raw_riskflow_items
  ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE scored_riskflow_items
  ADD COLUMN IF NOT EXISTS video_url TEXT;
