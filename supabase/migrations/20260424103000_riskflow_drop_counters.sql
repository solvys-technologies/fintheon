-- [claude-code 2026-04-24] S34-T4: silent-drop counters + per-source signal-noise view.
-- Counters are flushed every 60s by the backend drop-counters service and
-- read by GET /api/diagnostics/source-quality. The view joins raw vs scored
-- riskflow items over a rolling 48h window to surface promotion-rate per source.

-- ── riskflow_drop_counters: per-source, per-stage, per-reason rollups ───────

create table if not exists public.riskflow_drop_counters (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  stage text not null,                 -- persist | content-guard | central-scorer
  reason text not null,                -- dedup | missing-fields | no-market-relevance | ...
  count integer not null default 0,
  window_start timestamptz not null,
  window_end timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists riskflow_drop_counters_window_end_idx
  on public.riskflow_drop_counters (window_end desc);

create index if not exists riskflow_drop_counters_source_stage_idx
  on public.riskflow_drop_counters (source, stage);

-- ── v_source_signal_noise: rolling 48h per-source promotion rate ───────────
-- ingested  = raw items accepted into raw_riskflow_items
-- promoted  = scored items with iv_score >= 2 (below 2 = dropped-as-noise)
-- drop_rate = 1 - (promoted / ingested), clamped to [0, 1]
-- avg_score = mean iv_score across all scored items from that source

create or replace view public.v_source_signal_noise as
with raw_48h as (
  select
    coalesce(source, 'unknown') as source,
    count(*)::bigint as ingested
  from public.raw_riskflow_items
  where coalesce(fetched_at, created_at) > now() - interval '48 hours'
  group by coalesce(source, 'unknown')
),
scored_48h as (
  select
    coalesce(source, 'unknown') as source,
    count(*)::bigint as scored_total,
    count(*) filter (where iv_score >= 2)::bigint as promoted,
    avg(coalesce(iv_score, 0))::numeric(6,2) as avg_score
  from public.scored_riskflow_items
  where coalesce(analyzed_at, created_at) > now() - interval '48 hours'
  group by coalesce(source, 'unknown')
)
select
  coalesce(r.source, s.source) as source,
  coalesce(r.ingested, 0) as ingested,
  coalesce(s.scored_total, 0) as scored_total,
  coalesce(s.promoted, 0) as promoted,
  case
    when coalesce(r.ingested, 0) = 0 then 0
    else greatest(
      0,
      least(
        1,
        1 - (coalesce(s.promoted, 0)::numeric / r.ingested::numeric)
      )
    )
  end::numeric(5,4) as drop_rate,
  coalesce(s.avg_score, 0)::numeric(6,2) as avg_score
from raw_48h r
full outer join scored_48h s on s.source = r.source
order by ingested desc nulls last;

comment on view public.v_source_signal_noise is
  'S34-T4: per-source 48h ingest → promotion funnel. drop_rate = 1 - promoted/ingested.';
