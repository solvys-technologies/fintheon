-- [claude-code 2026-04-19] S27-T10 W2e: Skills Hub import audit trail.
--   Every importSkillFromHub() call produces a row here — status=imported|rejected|warned.
--   Scanner report stored as jsonb so future GEPA loops can retrain on scan signals.

create table if not exists public.skill_imports (
  id uuid primary key default gen_random_uuid(),
  skill_id text not null,
  version text not null,
  source_url text not null,
  imported_at timestamptz not null default now(),
  scan_report jsonb not null,
  status text not null,
  imported_by text,
  unique (skill_id, version)
);

create index if not exists skill_imports_status_idx
  on public.skill_imports (status, imported_at desc);

comment on table public.skill_imports is
  'Hub-imported skills audit trail — scanner report, status (imported|rejected|warned), actor. Read by GET /api/skills registry surface.';
