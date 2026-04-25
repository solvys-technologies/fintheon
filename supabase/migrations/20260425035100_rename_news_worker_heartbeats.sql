-- [claude-code 2026-04-24] S35-T10: Rename news_worker_heartbeats -> riskflow_worker_heartbeats
-- RiskFlow Worker is the new infra label of the News Worker. Code-side renames land in
-- this sprint; T12 owns `supabase db push` + the Fly cutover. The legacy view alias keeps
-- any pre-cutover readers (off-branch code, harper-ops, mobile) green until 2026-05-08.

alter table if exists public.news_worker_heartbeats
  rename to riskflow_worker_heartbeats;

alter index if exists public.news_worker_heartbeats_tier_idx
  rename to riskflow_worker_heartbeats_tier_idx;

-- Legacy view alias — sunset 2026-05-08. After that date, drop this view in a
-- follow-up migration once every reader is confirmed cut over.
create or replace view public.news_worker_heartbeats as
  select * from public.riskflow_worker_heartbeats;
