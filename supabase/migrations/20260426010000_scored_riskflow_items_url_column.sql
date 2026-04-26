-- [claude-code 2026-04-26] Hotfix: 20260425170000 added url to raw_riskflow_items
-- and image_url to scored_riskflow_items, but missed `url` on scored_riskflow_items.
-- persist.ts has been writing url on the scored copy too, so every writeScoredItems
-- call has been failing with `column "url" of relation "scored_riskflow_items" does
-- not exist` (visible in fly logs as a constant error stream). The central scorer
-- emits "Wrote 0 scored items to Supabase" while raw_riskflow_items keeps growing.
-- This adds the missing column + backfills url onto already-scored rows from the
-- linked raw row (when raw still exists; raw rows older than 7 days are auto-purged).

alter table public.scored_riskflow_items
  add column if not exists url text;

create index if not exists scored_riskflow_items_url_idx
  on public.scored_riskflow_items (url)
  where url is not null;

update public.scored_riskflow_items s
set url = r.url
from public.raw_riskflow_items r
where s.raw_item_id = r.id
  and s.url is null
  and r.url is not null;
