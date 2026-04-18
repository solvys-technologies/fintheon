# Sprint Brief: S24-T3 — RiskFlow V4 Calibration + Scarcity + Shadow Mode

## Context

L10 has lost meaning. Live DB evidence from 2026-04-18:

- **349 score-10 items over 7 days.** ~50/day. 25 of 25 L10s in last 24h from FinancialJuice, 14 of them POI-tagged (Trump), 14 geopolitical.
- **Score cliff**: 25 items at score 10 in 24h, 25 at score 7, only 2 items total at score 8–9. The multiplier stack (VIX × regime × commentator) pushes everything to the ceiling or drops it to 7. No middle ground.
- **Score variance on identical input**: "Iran Blocks Strait of Hormuz Again" appeared twice posting 34 min apart, both at score 10. Other duplicate headlines got scored 10 AND 7 across runs. Non-deterministic.
- **Tier ceiling too generous**: `maxBoostedScore = Math.min(10, baseEventWeight + 4)` at `iv-scorer.ts:321`. Geopolitical base 8.5 → max 12.5 → clamped to 10. Any geopolitical + a couple multipliers hits the ceiling.

TP's rule (confirmed): **L9 and L10 are reserved for environment-changing headlines** — things that flip the classification matrix. "Talks of ceasefire" = 8 max. "Ceasefire signed and announced" = 10. L9 = probable environment-changer with mandatory review-at-next-maintenance flag.

This track builds the scarcity cap, the rescore-all migration job, shadow-mode logging, and outcome tagging. It depends on T1 migrations (`classification_matrix`, `lexicon_keywords`) to know what counts as a matrix-flipping event.

## Branch Target

`s24-t3-calibration` — worktree off T1's HEAD after T1 migrations land:

```bash
git fetch origin s24-t1-foundation
git worktree add ../fintheon-s24-t3 -b s24-t3-calibration s24-t1-foundation
cd ../fintheon-s24-t3
```

## Scope — Included

### Scarcity Cap in `calculateMacroLevel`

Edit `backend-hono/src/services/analysis/iv-scorer.ts:429–446` `calculateMacroLevel()`. New V4 gate (behind `SCORING_V4` flag):

```
L10 ⟺ (hasLevel4Emoji) OR (isMajorPrint AND confirmed-action-verb)
       OR (lexicon.matrix_flip = true AND action-verb-present)
L9  ⟺ (score >= 8.5) AND (lexicon has a matching keyword even if not matrix-flip)
       OR (isMajorPrint AND high-deviation)
L8  ⟺ (score >= 7.0) — maximum for "talks of" / "considering" / speculative framing
L7..L1: existing V3 ladder unchanged
```

**Action verb list** (required for L10 via lexicon path): `signed|confirmed|announced|declared|begins|commences|collapses|fails|ends|resigned|fired|dies|attacked|struck|launched|cuts|hikes|halts|resumes|reopens|halted|approved|rejected|passed|vetoed`.

**Hedge phrase block** (forces max L8): `talks of|discussions|considering|weighing|may|might|could|possibly|maybe|reportedly planning|rumored|suggests|sources say`.

Read lexicon from `lexicon_keywords` table (T1 migration). Cache in memory, refresh every 60s.

### Multiplier Stack Tempering (behind `SCORING_V4`)

Edit `iv-scorer.ts:260–316`. Replace multiplicative VIX × regime × commentator stack with additive compounding:

```
stackMultiplier = 1 + (vixMult - 1) + (regimeMultiplier - 1) + 0.5 * (commentatorMultiplier - 1)
score *= stackMultiplier
```

Tier ceiling stays as guardrail (`baseEventWeight + 4`). Variance should drop significantly — same input = same output.

### Rescore-All Migration Job (new file)

- `backend-hono/src/services/scoring/rescore-all.ts` (<300 lines)
  - One-shot admin endpoint: `POST /api/riskflow/rescore-all` (super admin only)
  - Idempotent — records a `rescore_runs` entry before starting; rejects if one is in-progress.
  - Reads all items from `scored_riskflow_items` in batches of 50
  - Re-runs the V4 scoring pipeline (with `SCORING_V4=true`)
  - Writes back `iv_score`, `macro_level`, `sub_scores`, `sentiment` — preserves `headline`, `created_at`, raw source fields
  - Adds a `rescored_at timestamptz` column to `scored_riskflow_items` (migration in this track: `20260419_rescore_columns.sql`)
  - Emits progress logs every 100 items

### Shadow Mode Tracking (new table + service)

- Migration `20260419_shadow_decisions.sql` — new table `agent_shadow_decisions`:
  - `id uuid`, `decision_type text` (`regime_proposal|lexicon_addition|walk_back`), `would_propose jsonb`, `actual_decision jsonb` nullable, `actual_decided_by text` nullable, `agreed boolean` nullable, `created_at timestamptz`, `resolved_at timestamptz` nullable.
- `backend-hono/src/services/scoring/shadow-mode.ts` (<200 lines)
  - `logShadowDecision(type, wouldPropose)` — called by agents in shadow mode before any real proposal
  - `resolveShadowDecision(type, actualDecision)` — called when the equivalent real decision lands; computes `agreed` by comparing proposals
  - Read endpoint: `GET /api/scoring/shadow-stats` — returns agreement rate per decision_type, rolling 30-day window.
  - When `agreement_rate > 0.85` on a decision type over 30 days, expose a flag `canAutoApply[type] = true` (T4 displays this in admin UI; graduation still requires super admin confirmation).

### Outcome Tagging (new table + cron hook)

- Migration `20260419_regime_outcomes.sql` — new table `regime_decision_outcomes`:
  - `id uuid`, `regime_proposal_id uuid` (FK to `regime_proposals`), `approved boolean`, `market_at_decision numeric` (SPY close or mid), `market_4h numeric` nullable, `market_24h numeric` nullable, `delta_4h_pct numeric` nullable, `delta_24h_pct numeric` nullable, `created_at`.
- `backend-hono/src/services/scoring/outcome-tagger.ts` (<200 lines)
  - Called 4h and 24h after each `regime_proposals.decided_at` via a delayed task.
  - Fetches SPY (or MQ via existing VIX-like Yahoo helper). Computes `delta_*_pct`.
  - Inserts row into `regime_decision_outcomes`.
- T4 will expose this in admin UI as "your GEO_TENSIONS overrides were right 80% / your BULL_TREND overrides were right 40%".

## Scope — Excluded (DO NOT TOUCH)

- All DB migrations except `20260419_rescore_columns.sql`, `20260419_shadow_decisions.sql`, `20260419_regime_outcomes.sql` — T1 owns foundation migration
- `backend-hono/src/services/commentator/commentator-service.ts` — T2 owns novelty
- `backend-hono/src/services/scoring/speaker-novelty.ts`, `narrative-sentiment.ts`, `walk-back-pairer.ts`, `lexicon-proposer.ts` — T2 owns
- `backend-hono/src/services/notifications/*` — T1 owns emit
- `backend-hono/src/routes/regime/proposals.ts`, `lexicon/*`, `classification-matrix/*` — T1 owns
- All frontend/mobile — T4 owns

## Known Issues to Preserve

- `EVENT_WEIGHTS` map at `iv-scorer.ts:31–79` — do NOT lower geopolitical base from 8.5. The scarcity comes from the gate + lexicon requirement, not from lowering base weights. Lowering base weights would skew all geopolitical scoring regardless of environment-changing status.
- `MAJOR_MACRO_PRINTS` list — do not expand to include geopolitical. That list is about expected scheduled prints (CPI/NFP/FOMC).
- Existing `POST /api/riskflow/rescore` endpoint — do not delete, it's used by Refinement Engine UI. Add `/rescore-all` as a new distinct endpoint.

## Implementation Steps

1. Wait for T1 migrations. Verify `classification_matrix`, `lexicon_keywords` populated.
2. Create migrations in this track: `20260419_rescore_columns.sql` (adds `rescored_at`), `20260419_shadow_decisions.sql`, `20260419_regime_outcomes.sql`.
3. Apply locally via Supabase MCP.
4. Build `calculateMacroLevel` V4 branch with action-verb + hedge-phrase + lexicon-flip logic. Feature-flag via `SCORING_V4`.
5. Build multiplier tempering (additive instead of multiplicative). Feature-flag.
6. Build `rescore-all.ts` and expose `POST /api/riskflow/rescore-all`.
7. Build `shadow-mode.ts` and `GET /api/scoring/shadow-stats`.
8. Build `outcome-tagger.ts` + delayed-task registration (use existing scheduler in `backend-hono/src/services/cron/` if present, or a simple setTimeout wrapper).
9. Changelog entries per commit.

## Acceptance Criteria

- [ ] With `SCORING_V4=true`, a synthetic headline "Talks of ceasefire between Iran and US continue" scores max L8 — NEVER L9 or L10 regardless of multipliers.
- [ ] "Ceasefire signed between Iran and US, oil flows resume" scores L10 (lexicon flip + action verb + matrix entry).
- [ ] Same headline scored 3x in a row produces identical final score (variance eliminated via additive multiplier stack).
- [ ] `POST /api/riskflow/rescore-all` completes over all 1,699 existing items. Spot check: the 349 previously-L10 items should redistribute — most should drop to L8 or L7.
- [ ] `GET /api/scoring/shadow-stats` returns `{ regime_proposal: {agreed: 0, total: 0, rate: null}, ... }` at baseline, increments as decisions flow.
- [ ] 4h after an approved regime proposal, `regime_decision_outcomes` has a row with `delta_4h_pct` populated.
- [ ] `SCORING_V4=false` — all existing behavior unchanged. Feature flag clean.

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Migration verify
psql $DATABASE_URL -c "\dt agent_shadow_decisions regime_decision_outcomes"
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='scored_riskflow_items' AND column_name='rescored_at'"

# Score gate sanity
SCORING_V4=true bun run backend-hono/scripts/scarcity-sanity.ts

# Rescore-all dry-run first (add --dry-run flag in the script)
curl -sX POST "http://localhost:8080/api/riskflow/rescore-all?dryRun=true" \
  -H "Authorization: Bearer $JWT"

# Then for real
curl -sX POST http://localhost:8080/api/riskflow/rescore-all \
  -H "Authorization: Bearer $JWT"

# Verify L10 count dropped
psql $DATABASE_URL -c "SELECT COUNT(*) FROM scored_riskflow_items WHERE iv_score >= 9.5 AND created_at > now() - interval '7 days'"
# Expected: target <50 (down from 349)
```

## Commit Format

```
[v.04.19.T3] feat: S24-T3 {component}: {description}

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
