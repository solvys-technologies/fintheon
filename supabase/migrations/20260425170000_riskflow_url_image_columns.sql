-- [claude-code 2026-04-25] S35-T35: news-worker has been writing 0 items for weeks because
-- persist.ts targets a `url` column on raw_riskflow_items that was never created. Diagnostics
-- log shows "Could not find the 'url' column of 'raw_riskflow_items' in the schema cache" on
-- every persist attempt. This migration adds the missing column + image_url for the new
-- expanded-card image render, and image_url on the scored copy so the scorer doesn't have
-- to re-derive it.

alter table public.raw_riskflow_items
  add column if not exists url text,
  add column if not exists image_url text;

create index if not exists raw_riskflow_items_url_idx
  on public.raw_riskflow_items (url)
  where url is not null;

alter table public.scored_riskflow_items
  add column if not exists image_url text;

-- Backfill url from the legacy `tags` array where it was being smuggled as `url:<href>`
-- (transition fallback per persist.ts comment on 2026-04-19). One-shot — new rows go
-- straight to the column.
update public.raw_riskflow_items r
set url = substring(t.tag from 5)
from (
  select id, tag
  from public.raw_riskflow_items, unnest(tags) as tag
  where tag like 'url:%'
) as t
where r.id = t.id
  and r.url is null;
