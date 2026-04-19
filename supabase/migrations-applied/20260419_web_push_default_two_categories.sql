-- [claude-code 2026-04-19] S24 unify: per TP — only regimeProposals + walkBackReverts default ON.
-- New push subscriptions get ONLY the two decision-critical categories checked; everything else opt-in.
-- Existing rows are backfilled to match (fresh subscribers + TP's iPhone get the same behaviour).
ALTER TABLE web_push_subscriptions
  ALTER COLUMN categories SET DEFAULT '{"regimeProposals": true, "walkBackReverts": true, "riskflow": false, "dailyBrief": false, "regimeActivations": false, "lexiconProposals": false, "toolApprovals": false}'::jsonb;

UPDATE web_push_subscriptions
SET categories = jsonb_build_object(
  'regimeProposals', true,
  'walkBackReverts', true,
  'riskflow', false,
  'dailyBrief', false,
  'regimeActivations', false,
  'lexiconProposals', false,
  'toolApprovals', false
)
WHERE categories IS NULL
   OR NOT (categories ? 'regimeProposals')
   OR NOT (categories ? 'walkBackReverts');
