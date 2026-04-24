# Sprint Brief: T2 — Arbitrum Supabase Migration

## Context

Arbitrum persists deliberation verdicts to a new Supabase table `arbitrum_verdicts`. This track writes the migration SQL file — one file, one commit, no other changes. T1 depends on this schema being defined but not necessarily migrated before T1 ships its code (Supabase migrations are applied by TP via `supabase db push`, not by any track).

## Branch Target

`s35-t2-arbitrum-migration` (off `s34-unified`)

## Scope — Included

- [ ] `supabase/migrations/20260424140000_arbitrum_verdicts.sql` (NEW) — single file, no other edits

Timestamp `20260424140000` = 2026-04-24 14:00:00. Use the current date/time when creating the file; 14-digit format is mandatory per memory `feedback_supabase_migration_filenames`.

## Scope — Excluded (DO NOT TOUCH)

- All TypeScript / TSX / backend code — T1, T3, T9 etc own those
- `supabase/migrations/*` OTHER than the new `arbitrum_verdicts` file
- Do NOT use `mcp__claude_ai_Supabase__apply_migration` or `execute_sql` — they orphan local files. Write the file only; TP runs `supabase db push` manually.

## Migration SQL (canonical)

```sql
-- [S35-T2] Arbitrum verdicts table — deliberation engine output
-- Replaces miroshark_deliberations (dropped in S35-T9)

CREATE TABLE IF NOT EXISTS public.arbitrum_verdicts (
  verdict_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event', 'session', 'manual')),
  question TEXT NOT NULL,
  category TEXT NOT NULL,
  seats JSONB NOT NULL DEFAULT '[]'::jsonb,
  consensus_probability NUMERIC(5,4) CHECK (consensus_probability >= 0 AND consensus_probability <= 1),
  confidence NUMERIC(5,4) CHECK (confidence >= 0 AND confidence <= 1),
  dissent JSONB,
  gates_surfaced JSONB NOT NULL DEFAULT '{}'::jsonb,
  digest_text TEXT NOT NULL,
  iv_simulation JSONB,
  trigger_source JSONB,
  latency_ms INTEGER,
  model_cost_usd NUMERIC(10,6)
);

CREATE INDEX IF NOT EXISTS idx_arbitrum_verdicts_created_at
  ON public.arbitrum_verdicts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_arbitrum_verdicts_trigger_type_created
  ON public.arbitrum_verdicts (trigger_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_arbitrum_verdicts_category
  ON public.arbitrum_verdicts (category);

-- RLS (defense-in-depth; backend uses service_role key which bypasses RLS by design)
ALTER TABLE public.arbitrum_verdicts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read verdicts (the digest is UI content, not user-owned data)
CREATE POLICY "authenticated_read_arbitrum_verdicts"
  ON public.arbitrum_verdicts
  FOR SELECT
  TO authenticated
  USING (true);

-- No client writes — only service_role inserts/updates
-- (No INSERT/UPDATE/DELETE policies = denied for authenticated; service_role bypasses)

COMMENT ON TABLE public.arbitrum_verdicts IS
  'Arbitrum deliberation engine verdicts. Replaces miroshark_deliberations (dropped in S35-T9). Backend writes via service_role; clients read the digest_text.';

COMMENT ON COLUMN public.arbitrum_verdicts.seats IS
  'JSONB array of per-seat transcripts: [{id, role, model, provider, weight, rounds: [{round, probability, confidence, rationale, risks}]}]';

COMMENT ON COLUMN public.arbitrum_verdicts.dissent IS
  'JSONB object if any seat disagreed by > 18pp from weighted mean: {seat, rationale, magnitude_pp}';

COMMENT ON COLUMN public.arbitrum_verdicts.gates_surfaced IS
  'JSONB object with signals (NOT vetoes): {consensus_spread_pp, category_quality, calibration_watermark}';

COMMENT ON COLUMN public.arbitrum_verdicts.trigger_source IS
  'JSONB capturing what fired the event trigger: {riskflow_item_id, speaker, iv_score} — null for session runs';
```

## Reuse Inventory

- Existing migration file naming pattern: grep `supabase/migrations/` for the latest file, note the 14-digit timestamp format, and mirror it.
- RLS pattern: existing `ai_conversations` and `ai_messages` tables have RLS enabled — mirror the shape of those policies.

## Known Issues to Preserve

- `trades` table has no base migration (memory: `feedback_trades_table_migration`). This migration does NOT reference `trades` — safe.
- NEVER `ALTER TABLE trades` in any migration without flagging TP first.

## Implementation Steps

1. Verify the exact current timestamp and compose the filename: `YYYYMMDDHHMMSS_arbitrum_verdicts.sql` (14 digits)
2. Write the SQL above verbatim into `supabase/migrations/<timestamp>_arbitrum_verdicts.sql`
3. Run `cat` on the new file to sanity-check formatting
4. Commit on `s35-t2-arbitrum-migration` branch

Do NOT run any migration-applying tool. TP runs `supabase db push` manually.

## Acceptance Criteria

- [ ] File exists at `supabase/migrations/<14-digit>_arbitrum_verdicts.sql`
- [ ] SQL parses (paste into any Postgres client for syntax check if uncertain)
- [ ] Filename is 14 digits + `_arbitrum_verdicts.sql`
- [ ] No other files modified

## Validation Commands

```bash
# Sanity check filename format
ls supabase/migrations/*arbitrum_verdicts* 2>/dev/null

# Verify no other changes
git status --short
```

## Commit Format

```
[v5.25.0-S35-T2] feat: Arbitrum verdicts table migration

Adds arbitrum_verdicts Supabase table with seats JSONB, dissent
detection, gates as signals, digest_text output. RLS enabled
(service_role writes, authenticated reads). Supersedes
miroshark_deliberations (dropped in S35-T9 once Arbitrum is live).
```
