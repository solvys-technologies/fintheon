-- [Codex 2026-05-27] Persist S102 macro event-risk context with Arbitrum verdicts.

alter table if exists public.arbitrum_verdicts
  add column if not exists risk_context jsonb;
