-- [claude-code 2026-04-24] S37: persistence for S24-T3 frontend group fuses + presets.
-- The scoring engine (scarcity gate, shadow mode, rescore-all) landed in S24-T3 prior;
-- what was missing was the USER-FACING storage for preset selections + active group
-- sensitivities (-1..+1 per macro/geopolitical/corporate/technical/speaker).

CREATE TABLE IF NOT EXISTS public.scoring_user_sensitivity (
  user_id       uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  macro         real        NOT NULL DEFAULT 0,
  geopolitical  real        NOT NULL DEFAULT 0,
  corporate     real        NOT NULL DEFAULT 0,
  technical     real        NOT NULL DEFAULT 0,
  speaker       real        NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scoring_user_sensitivity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scoring_user_sensitivity_owner_read ON public.scoring_user_sensitivity;
CREATE POLICY scoring_user_sensitivity_owner_read
  ON public.scoring_user_sensitivity FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS scoring_user_sensitivity_owner_write ON public.scoring_user_sensitivity;
CREATE POLICY scoring_user_sensitivity_owner_write
  ON public.scoring_user_sensitivity FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.scoring_presets (
  id            text        PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  sensitivities jsonb       NOT NULL,
  is_builtin    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scoring_presets_user_idx
  ON public.scoring_presets (user_id, created_at DESC);

ALTER TABLE public.scoring_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scoring_presets_read_own_or_builtin ON public.scoring_presets;
CREATE POLICY scoring_presets_read_own_or_builtin
  ON public.scoring_presets FOR SELECT
  TO authenticated
  USING (is_builtin = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS scoring_presets_write_own ON public.scoring_presets;
CREATE POLICY scoring_presets_write_own
  ON public.scoring_presets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_builtin = false);

DROP POLICY IF EXISTS scoring_presets_delete_own ON public.scoring_presets;
CREATE POLICY scoring_presets_delete_own
  ON public.scoring_presets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_builtin = false);
