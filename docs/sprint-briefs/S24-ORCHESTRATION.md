# S24 Orchestration — RiskFlow V4 Scoring Engine Redesign

## Context

Live diagnosis on 2026-04-18 confirmed three load-bearing failures in RiskFlow scoring:

- **349 score-10 items / 7 days** — L10 has lost meaning. 25 of 25 L10s in last 24h from FinancialJuice; 14 POI-tagged (Trump); 14 geopolitical. Effectively `FJ + (POI OR geopolitical) → auto-10`.
- **Regime stuck on GEO_TENSIONS** — TP manually set BULL_TREND on 2026-04-17 14:37; MDB brief agent silently overwrote 10h later via `brief-generator.ts:187–194`. Manual work erased, no notification.
- **No speaker novelty, no walk-back pairing, undirected geopolitical sentiment** — `commentator-service.ts:80–121` returns same multiplier every time. Ceasefire and invasion both route through identical `determineSentiment()`. Walk-backs ignored.

V4 redesign ships behind a `SCORING_V4` feature flag so V3 remains a one-toggle rollback.

## Base Branch

All four worktrees branch off **`s20-agent-swarm-platform-ops`** (current HEAD) which contains the prerequisite notifications scaffolding shipped this session (`emit.ts`, `notifications_log` table at `20260418_notifications_log.sql`, `web-push-sender.ts` extensions, mobile `NotificationBell`/`NotificationDrawer`, `quiet-hours.ts` with market-hours-only defaults).

**Do not branch from `main`** — main does not yet have the notification scaffolding.

## Worktree Setup (run before spawning instances A/B/C)

```bash
cd /Users/tifos/Desktop/Codebases/fintheon
git worktree add ../fintheon-s24-t1 -b s24-t1-foundation s20-agent-swarm-platform-ops
git worktree add ../fintheon-s24-t2 -b s24-t2-intelligence s20-agent-swarm-platform-ops
git worktree add ../fintheon-s24-t3 -b s24-t3-calibration s20-agent-swarm-platform-ops
# T4 (Instance D) stays on current session's branch
```

## Track Summary

| Track                | Instance         | Branch                         | Owns                                                                                   |
| -------------------- | ---------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| T1 Foundation        | A (cold)         | `s24-t1-foundation`            | DB schema, proposals API, MDB regime-lock fix, emit category registration              |
| T2 Intelligence      | B (cold)         | `s24-t2-intelligence`          | Speaker novelty, narrative-aware sentiment, walk-back pairer, lexicon proposer         |
| T3 Calibration       | C (cold)         | `s24-t3-calibration`           | Scarcity cap, multiplier tempering, rescore-all, shadow mode, outcome tagging          |
| T4 UX + Admin + Loop | D (this session) | `s20-agent-swarm-platform-ops` | Refinement Engine rebuild, approval inbox, mobile approval surface, 2h monitoring cron |

## Wave Sequence

### Wave 1 — Foundation First (serial)

**T1 runs alone.** Its migrations land first. Other tracks stub schema dependencies locally if they need to start in parallel, but cannot commit until T1's migration file is merged.

- T1 applies `20260419_v4_foundation.sql` (5 tables + `market_regimes` column additions)
- T1 ships `/api/regime/proposals`, `/api/lexicon/proposals`, `/api/classification-matrix/*`
- T1 edits `brief-generator.ts:187–194` to propose instead of write
- T1 commits + pushes `s24-t1-foundation`

**Wave 1 done signal:** T1 branch has the migration + proposals API working locally. Curl `GET /api/regime/proposals?status=pending` returns `[]`. MDB trigger creates a proposal instead of writing a regime row.

### Wave 2 — Intelligence + Calibration + UX (parallel)

**T2, T3, T4 all start from T1's HEAD** once Wave 1 lands. These have strict file-ownership boundaries (see per-brief "Scope — Excluded") so they cannot stomp each other.

- **T2** owns `iv-scorer.ts` SCORING_V4 branch, novelty engine, walk-back pairer, lexicon proposer, `headline-parser.ts` geopolitical split.
- **T3** owns `iv-scorer.ts` L9/L10 gate (different function: `calculateMacroLevel`), rescore-all, shadow mode, outcome tagging.
- **T4** owns everything under `frontend/components/refinement/`, `frontend/components/admin/`, `mobile/components/notifications/`, and the monitoring-loop cron.

**Shared file conflict risk**: `iv-scorer.ts` is touched by both T2 and T3. T2 owns `calculateIVScore()` body (lines ~141–380, multiplier stacking, novelty, narrative-aware sentiment). T3 owns `calculateMacroLevel()` (lines ~429–446, L9/L10 gate). If either needs to touch the other's region, coordinate via PR review — do not merge both tracks without a rebase.

### Wave 3 — Unification Pass (Instance D owns)

Instance D (this session) performs the merge:

1. Merge T1 → a new `s24-unify` branch
2. Merge T2 → `s24-unify`, resolve any `iv-scorer.ts` overlaps
3. Merge T3 → `s24-unify`, resolve the other `iv-scorer.ts` region
4. Merge T4 → `s24-unify` (should be conflict-free given boundary discipline)
5. Full validation: migrations applied, backend build, frontend + mobile tsc + build, live push test, rescore-all on a small subset, end-to-end approval flow test
6. Open PR `s24-unify → main` for TP's final approval

## Shared State / Migration Order

1. `20260418_notifications_log.sql` — already applied (this session)
2. `20260419_v4_foundation.sql` — T1 applies in Wave 1 (5 tables + market_regimes columns)
3. `20260419_rescore_columns.sql` — T3 applies in Wave 2
4. `20260419_shadow_decisions.sql` — T3 applies in Wave 2
5. `20260419_regime_outcomes.sql` — T3 applies in Wave 2

T2 does not add migrations; it consumes T1's `speaker_utterance_cache` / `classification_matrix` / `lexicon_keywords`.

## Conflict-Prevention Contract

- No two tracks modify the same file region. Overlaps in `iv-scorer.ts` are split by function boundary.
- Migrations are append-only with monotonically increasing dates.
- Every change is behind `SCORING_V4` env flag (backend) or similar feature toggle (frontend). V3 remains executable.
- Push category additions in `emit.ts` are additive only; T1 owns the registration.

## Unification Approach

**Instance D performs the merge** (not a dedicated track). Rationale: D is the only instance that carries the session context to reason about edge-case conflicts, and D's own scope (UX + admin) is the consumer of everything the other tracks produce — so it naturally integration-tests the whole thing.

If any Wave 2 track blocks on a Wave 1 question, that instance pings TP via the session; otherwise they run fully parallel.

## Validation (Final — Wave 3)

```bash
# Clean builds across all three targets
cd /Users/tifos/Desktop/Codebases/fintheon
rm -rf frontend/dist mobile/dist
npx tsc --noEmit --project frontend/tsconfig.json
cd frontend && npx vite build && cd ..
cd mobile && npx tsc --noEmit && npx vite build && cd ..
cd backend-hono && bun run build && cd ..

# Backend restart + health
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
curl -s http://localhost:8080/api/diagnostics

# Feature flag on
# (set SCORING_V4=true in env before restart)

# End-to-end smoke
curl -sX POST http://localhost:8080/api/data/brief/generate \
  -H "Authorization: Bearer $JWT" -d '{"briefType":"MDB"}'
# Expect: regime_proposals row created, push fired to TP's phone

# Rescore-all on existing items
curl -sX POST http://localhost:8080/api/riskflow/rescore-all \
  -H "Authorization: Bearer $JWT"

# Verify L10 count collapsed
psql $DATABASE_URL -c "SELECT COUNT(*) FROM scored_riskflow_items WHERE iv_score >= 9.5 AND created_at > now() - interval '7 days'"
# Target: well under 50 (from 349 pre-V4)

# Live push to TP's phone
curl -sX POST https://fintheon.fly.dev/api/notifications/web-push/test \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"title":"RiskFlow V4 shipped","body":"L10 means something again. Admin rebuilt."}'
```

## Non-Technical Debrief

- **Wave 1** lays the rails: new database tables for proposals, the API the admin pages will call, and the fix that stops the morning brief from silently overriding TP's regime choices.
- **Wave 2** happens in parallel. One instance teaches the scorer to notice when Trump/Powell are repeating themselves and to interpret speakers through the active narratives; it also wires the real-time walk-back reverter so when a ceasefire gets walked back four hours later, the engine flips back on its own. A second instance enforces that only environment-changing headlines reach L9/L10 and rescores every existing item against the new rules so the existing 349 L10s collapse to a realistic number. A third instance rebuilds the admin cockpit with 5 group dials instead of 40 sliders, adds presets, ships the approvals inbox (desktop + mobile), and wires a monitoring routine that checks the engine every 2 hours and files proposals when something drifts.
- **Wave 3** is the merge + live test. The current session takes the four branches, reconciles any `iv-scorer.ts` conflicts, runs the full build trio, fires a push to TP's phone to confirm end-to-end delivery, and opens the PR for final approval.
