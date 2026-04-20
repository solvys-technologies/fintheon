-- [claude-code 2026-04-20] S21-T5: Seed the PsychAssist fork SuperAdmin grants
-- for reasoning@pricedinresearch.io. This is TP's fork account.
--
-- Safe to run repeatedly: ON CONFLICT DO NOTHING preserves any future edits
-- from the admin UI.
--
-- Per user spec (plan mode Q&A):
--   - Edit PsychAssist prompts/logic  → psych_assist_fork.edit
--   - Toggle feature flags for self    → psych_assist_fork.flag_toggle
--   - NOT granted: raw audio access, granting other users

do $$
declare
  reasoning_uid uuid;
begin
  select id into reasoning_uid
  from auth.users
  where lower(email) = 'reasoning@pricedinresearch.io'
  limit 1;

  if reasoning_uid is null then
    raise notice 'reasoning@pricedinresearch.io not found in auth.users — seed skipped. Run again after the account is created.';
    return;
  end if;

  insert into public.user_feature_overrides (user_id, feature, enabled, config, granted_at, updated_at)
  values
    (reasoning_uid, 'psych_assist_fork.edit',        true, '{"note":"S21 SuperAdmin fork"}'::jsonb, now(), now()),
    (reasoning_uid, 'psych_assist_fork.flag_toggle', true, '{"note":"S21 SuperAdmin fork"}'::jsonb, now(), now())
  on conflict (user_id, feature) do nothing;

  raise notice 'seeded psych_assist_fork grants for %', reasoning_uid;
end
$$;
