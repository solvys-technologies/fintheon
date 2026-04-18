# Sprint Brief: S24-T1 — RiskFlow V4 Foundation (DB + Approval Routes)

## Context

RiskFlow scoring engine is being rebuilt to V4. Live diagnosis evidence from 2026-04-18:

- **349 score-10 items in the last 7 days** (~50/day). L10 has lost all signal meaning.
- **25 of 25 L10s in the last 24h came from FinancialJuice**, 14 of them POI-tagged (Trump), 14 of them geopolitical. Effectively `FJ + (POI OR geopolitical) → auto-10`.
- **Same headline scoring 10 AND 7 in different rescore runs** — the multiplicative stack (VIX × regime × commentator) produces non-deterministic scoring on identical input.
- **Regime stuck on GEO_TENSIONS**: TP manually set BULL_TREND on 2026-04-17 14:37. MDB brief generator silently overwrote it 10 hours later with `confidence=0.8` via `brief-generator.ts:187–194`. TP never informed, manual work erased.
- **No speaker novelty filter** — Powell/Trump repeats score identically to novel statements.
- **Geopolitical sentiment undirected** — "ceasefire confirmed" (bullish) and "missiles fired" (bearish) both score identically via `determineSentiment()` at `iv-scorer.ts:451–497`.

This track is the **load-bearing foundation** for T2 (intelligence) and T3 (calibration). It ships the DB schema, the approval/proposal API, and the MDB regime-lock fix — all other tracks depend on migrations from this track landing first.

## Branch Target

`s24-t1-foundation` — create as a worktree off `s20-agent-swarm-platform-ops` HEAD (which contains the prerequisite notifications scaffolding: `backend-hono/src/services/notifications/emit.ts`, `notification-service.ts`, and the `notifications` table migration at `supabase/migrations/20260418_notifications_log.sql`).

```bash
git worktree add ../fintheon-s24-t1 -b s24-t1-foundation s20-agent-swarm-platform-ops
cd ../fintheon-s24-t1
```

## Scope — Included

### DB Migrations (new file, timestamp `20260419_v4_foundation.sql`)

- `classification_matrix` — regime → rubric (stance, lexicon keywords, auto-flip rules)
  - Columns: `id uuid`, `regime_type text`, `rubric jsonb` (stance per eventType, required keywords for regime entry/exit, walk-back pairings), `active boolean`, `updated_by text`, `updated_at timestamptz`, `created_at timestamptz`
  - Seed rows for each value in `MARKET_REGIMES` (see `backend-hono/src/services/regime/regime-service.ts`).
- `regime_proposals` — agent proposes, super admin approves/denies
  - Columns: `id uuid`, `proposed_regime text`, `current_regime text`, `reason text`, `evidence jsonb` (headlines, chart_url, x_sentiment_snippet), `proposed_by text`, `status text` (`pending`/`approved`/`denied`/`auto-applied`), `approved_by uuid` nullable, `decided_at timestamptz` nullable, `applied_at timestamptz` nullable, `created_at timestamptz`.
- `lexicon_keywords` — keyword → sentiment + regime-flip flag
  - Columns: `id uuid`, `keyword text`, `phrase_pattern text` (regex optional), `sentiment text` (`bullish`/`bearish`/`neutral`), `is_matrix_flip boolean`, `target_regime text` nullable, `requires_action_verb boolean` default true, `added_by text`, `approved boolean` default false, `created_at timestamptz`, `expires_at timestamptz` nullable.
- `lexicon_proposals` — agent-proposed keyword additions pending TP approval (same shape as `regime_proposals` but for lexicon edits).
- `speaker_utterance_cache` — novelty tracking for speaker repetition filter
  - Columns: `id uuid`, `speaker text`, `headline_hash text`, `headline_text text`, `embedding vector(384)` (for cosine sim) OR fallback `tokens text[]` (for Jaccard if pgvector unavailable), `seen_at timestamptz`. Index `(speaker, seen_at DESC)`. TTL via `seen_at < now() - interval '7 days'` cleanup.
- Add `locked_by text nullable` and `locked_until timestamptz nullable` to `market_regimes`.

### Backend Routes (new files)

- `backend-hono/src/routes/regime/proposals.ts`
  - `GET /api/regime/proposals?status=pending` — list
  - `POST /api/regime/proposals` — agent creates (internal auth)
  - `POST /api/regime/proposals/:id/approve` — super admin approves, applies the regime
  - `POST /api/regime/proposals/:id/deny` — super admin denies
- `backend-hono/src/routes/lexicon/*` — same CRUD pattern for `lexicon_keywords` and `lexicon_proposals`
- `backend-hono/src/routes/classification-matrix/*` — GET matrix, PATCH rubric for a regime (super admin only)

### MDB Regime Fix

- Edit `backend-hono/src/services/brief-generator.ts:187–194` — **remove the `setRegime()` call**. Replace with: create a row in `regime_proposals` with `proposed_by='mdb_agent'`, fire a push via `emitPushAndLog` (category `regimeProposals`, severity `high`, url `/admin/approvals/{id}`). Include the MDB excerpt as `reason` and the regex-matched regime as `proposed_regime`.

### emit.ts Categories (extend existing file)

- `backend-hono/src/services/notifications/emit.ts` already exists. Add supported categories: `regimeProposals`, `lexiconProposals`, `walkBackReverts`. These must **bypass quiet hours when severity is `critical`** (L10 matrix flips only). Default severity `high` respects quiet hours (see `backend-hono/src/services/notifications/quiet-hours.ts` — quiet 16:00 → 09:30 ET).

### Mobile + Desktop Admin Settings Toggles (minimal, expand in T4)

- `mobile/contexts/SettingsContext.tsx` — extend `notificationPrefs` default with `regimeProposals: true`, `lexiconProposals: true`, `walkBackReverts: true`.
- Same in `web_push_subscriptions.categories` default JSONB.

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/analysis/iv-scorer.ts` — T2 owns scoring math
- `backend-hono/src/services/commentator/commentator-service.ts` — T2 owns
- `backend-hono/src/services/riskflow/feed-service.ts` L9/L10 gate logic — T3 owns
- `frontend/components/refinement/*` — T4 owns (admin UI rebuild)
- `frontend/components/admin/*` — T4 owns
- `mobile/components/notifications/*` (except `NotificationBell`/`NotificationDrawer` which already exist) — T4 owns

## Known Issues to Preserve

- `backend-hono/src/services/notifications/emit.ts` — already shipped this session, do not rewrite. Extend only.
- `supabase/migrations/20260418_notifications_log.sql` — already committed, do not re-migrate.
- `backend-hono/src/services/notifications/quiet-hours.ts` — defaults already set to market-hours-only (16:00 → 09:30 ET). Do not change defaults.
- `backend-hono/src/services/web-push-sender.ts` — already exports `canDeliverToUser`, `getSubscribedUserIds`, `isPushEnabled`. Reuse, do not rewrite.

## Implementation Steps

1. Create migration `supabase/migrations/20260419_v4_foundation.sql` with all 5 new tables + `market_regimes` column additions.
2. Apply migration locally via Supabase MCP `apply_migration`. Verify all tables exist.
3. Seed `classification_matrix` with one row per regime in `MARKET_REGIMES` (pull the enum from `backend-hono/src/services/regime/regime-service.ts`).
4. Create `backend-hono/src/routes/regime/proposals.ts`, `lexicon/proposals.ts`, `lexicon/keywords.ts`, `classification-matrix/index.ts`. Each <300 lines. Register in `backend-hono/src/index.ts` (or route aggregator).
5. Write the proposal-fire-through-emit wrapper: `backend-hono/src/services/regime/propose.ts` — single function `proposeRegimeChange(proposedBy, proposedRegime, reason, evidence)` inserts row + calls `emitPushAndLog`.
6. Edit `brief-generator.ts:187–194` — replace `setRegime()` with `proposeRegimeChange()`. Keep all other MDB behavior.
7. Extend `mobile/contexts/SettingsContext.tsx` defaults.
8. Add changelog entry per commit in `src/lib/changelog.ts`.

## Acceptance Criteria

- [ ] All 5 new tables exist in Supabase, migration is idempotent.
- [ ] `GET /api/regime/proposals?status=pending` returns `[]` initially.
- [ ] MDB generator (`POST /api/data/brief/generate` with type=MDB) creates a `regime_proposals` row AND fires a push to TP's phone (not a silent regime write).
- [ ] `POST /api/regime/proposals/:id/approve` writes to `market_regimes` with `detected_by='manual-from-proposal'` and `locked_by=userId, locked_until=now()+24h`.
- [ ] Any attempt by MDB to propose a regime while `locked_until > now()` results in a `regime_proposals` row with `status='pending'` that sits until TP acts — it does NOT auto-apply.
- [ ] `backend-hono/src/services/notifications/emit.ts` handles `regimeProposals` and `lexiconProposals` categories with correct severity gating.
- [ ] No regression to existing `/api/riskflow/feed` endpoint — still returns scored items.

## Validation Commands

```bash
# Backend type check + build
cd backend-hono && bun run build

# Restart launchd local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
curl -s http://localhost:8080/api/diagnostics

# Migration verification
psql $DATABASE_URL -c "\dt classification_matrix regime_proposals lexicon_keywords lexicon_proposals speaker_utterance_cache"
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='market_regimes' AND column_name IN ('locked_by','locked_until');"

# Smoke test: MDB should propose, not overwrite
curl -sX POST http://localhost:8080/api/data/brief/generate \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"briefType":"MDB"}'
# Expect: market_regimes unchanged, regime_proposals gains a row, TP's phone gets a push

# Frontend type check (no UI changes here, but ensure import surface compiles)
npx tsc --noEmit --project frontend/tsconfig.json
cd mobile && npx tsc --noEmit
```

## Commit Format

```
[v.04.19.T1] feat: S24-T1 {component}: {description}

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
