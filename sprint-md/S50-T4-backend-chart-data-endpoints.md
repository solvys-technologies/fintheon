# Sprint Brief: S50-T4 — Backend Chart-Data Endpoints

## Context

The frontend currently has no time-bucketed P&L series endpoint and no Arbitrum confidence-history or vote-breakdown endpoints. T2 (Performance Tab) and T3 (Arbitrum overlays) both define client-side fallbacks so they can ship without T4, but T4 is the canonical data path. T4 lands three new GET endpoints that aggregate from existing tables — no new schema, no new RLS policy, no engine changes.

## Orchestration Context

**Sprint:** S50 — Charts Refactor (Solvys-skinned Recharts). See `sprint-md/S50-ORCHESTRATION.md` for the full sprint plan.

**Your wave:** Wave 1 (foundation). You run **in parallel with T1** (Recharts foundation kit). T1 touches `frontend/`, you touch `backend-hono/` — disjoint, no coordination needed.

**What consumes your endpoints:**

- T2 (`/api/journal/pnl-series`) — Performance Tab time-bucketed P&L. T2 has a fallback to existing data hooks if you slip.
- T3 (`/api/arbitrum/confidence-history`, `/api/arbitrum/vote-breakdown/:id`) — Arbitrum overlays. T3 has a client-side fallback if you slip.

Both Wave-2 tracks ship even if T4 misses Wave 1 — but T4 is the canonical data path and the better experience.

**Sibling tracks (do not modify their files):**

- T1 owns `frontend/components/charts/**` + `frontend/lib/charts/**`. Frontend-only.
- T2 owns `frontend/components/journal/**`. Frontend-only.
- T3 owns `frontend/components/arbitrum/**`. Frontend-only.
- T5 owns mobile + unification.

**Gate to next wave:** T1 PR merged + T4 PR merged + endpoint smoke posted + TP sign-off. Then T2 and T3 can begin.

**Critical operational rule:** After your build, you MUST restart launchd (`launchctl unload && load io.solvys.fintheon-backend.plist`). New routes return 404 on `localhost:8080` until restart. Verify with `curl /api/diagnostics` before declaring done.

**Owner pool:** non-Claude-Code (Cursor / Codex / juniors). No inter-track messaging. File ownership is the only conflict-prevention layer.

## Branch Target

`s50-charts`

**Wave:** 1 (parallel with T1)
**Complexity:** Medium
**Estimated:** 3 new endpoints + 1 service helper, ~250 LOC

## Scope — Included

- [ ] Add `GET /api/journal/pnl-series` to `backend-hono/src/routes/journal/handlers.ts`:
  - Query params: `range` (7d/30d/90d, default 30d), `bucket` (day/week, default day).
  - Response: `{ series: Array<{ ts: ISO8601, pnl: number, cumulative: number }> }`.
  - Aggregate from existing journal entries / trades table — do NOT add new tables or materialized views.
  - Auth: existing journal route auth pattern (Supabase JWT).
- [ ] Add `GET /api/arbitrum/confidence-history` to `backend-hono/src/routes/arbitrum/index.ts`:
  - Query: `limit` (default 50, max 200).
  - Response: `{ history: Array<{ ts: ISO8601, verdict_id: string, confidence: number, dissent: number }> }`.
  - Read from existing verdict store via `verdict-store.ts`. If no `listRecent` helper exists, ADD one as a read-only export — do NOT modify any existing exports.
  - Auth: public (consistent with `/api/arbitrum/latest` per route comment at `routes/arbitrum/index.ts:5-7`).
- [ ] Add `GET /api/arbitrum/vote-breakdown/:verdict_id` to `backend-hono/src/routes/arbitrum/index.ts`:
  - Response: `{ seats: Array<{ role: string, weight: number, position: 'long' | 'short' | 'neutral' }> }`.
  - Derive from the verdict's seats payload (single fetch by id, project to seat shape).
  - Auth: public, same pattern.
- [ ] Validate inputs with Zod at the route boundary (match patterns from neighboring routes).
- [ ] Append one changelog entry to `src/lib/changelog.ts`.

## Scope — Excluded (DO NOT TOUCH)

- T1/T2/T3 frontend.
- Schema migrations — derive from existing tables only. If aggregation is too slow, log a TODO and ship the simple version; T5 / a follow-up sprint can decide on materialized views.
- `backend-hono/src/services/arbitrum/engine.ts` and `seats.ts` (off-limits).
- Any change to RLS policies — read paths only.
- Any frontend file.
- Mobile.

## Off-Limits (hard ban)

- `backend-hono/src/services/arbitrum/engine.ts`
- `backend-hono/src/services/arbitrum/seats.ts`
- `backend-hono/src/services/arbitrum/event-trigger.ts`
- All news-poller code: `workers/riskflow-worker/*`, `services/twitter/*`, `services/browserbase/*`, `content-guard`, `central-scorer`, `publisher-blocklist` (memory `feedback_news_pollers_locked.md`)
- Any RLS policy or migration file under `supabase/migrations/`

## Reuse Inventory

- `backend-hono/src/routes/journal/handlers.ts:15-65` — existing `GET /api/journal/list` aggregation pattern. Copy the auth + Supabase client wiring verbatim.
- `backend-hono/src/services/arbitrum/verdict-store.ts` — existing read functions. Add `listRecent(limit)` next to them, mirror their style.
- `backend-hono/src/services/arbitrum/types.ts` — Verdict + SeatVote types. Reuse.
- Existing Zod schema patterns in `backend-hono/src/routes/` — match the closest existing route's style.

## Known Issues to Preserve

- `scored_riskflow_items` does NOT have `source_domain` (memory `feedback_scored_riskflow_no_source_domain.md`) — irrelevant here but a reminder NOT to assume schema fields. **Always read the migration file before assuming a column exists.** Migrations live in `supabase/migrations/`.
- The trades table base migration exists at `supabase/migrations/20260421000000_trades_base.sql` — if `pnl-series` aggregates trades, that's the canonical base. Read it before writing the query.
- Arbitrum verdicts public-read pattern is intentional (route comment at `routes/arbitrum/index.ts:5-7`).
- After backend changes, you MUST restart launchd: `launchctl unload && launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`. New routes return 404 until restart.

## Implementation Steps

1. Read `backend-hono/src/routes/journal/handlers.ts` end-to-end + `backend-hono/src/routes/journal/index.ts`.
2. Read `backend-hono/src/services/arbitrum/verdict-store.ts` + `routes/arbitrum/index.ts`.
3. Inspect `supabase/migrations/` for the trades + journal table shapes — confirm columns before writing the aggregation. Do NOT assume.
4. Add Zod schemas for the 3 new endpoints at the top of each handler file.
5. Implement `pnl-series` — group by day/week server-side via Supabase `.select(...)`. Cap query at 90 days.
6. Implement `confidence-history` — extend `verdict-store.ts` with `listRecent(limit: number): Promise<Verdict[]>` (read-only addition), use it in the route.
7. Implement `vote-breakdown/:verdict_id` — fetch single verdict by id, project to the seat shape.
8. Append one changelog entry.
9. Run backend validation block + smoke endpoints.

## Acceptance Criteria

- [ ] 3 new endpoints registered and reachable on `localhost:8080` after launchd restart.
- [ ] Zod validation rejects bad params with HTTP 400.
- [ ] `bun run build` clean (no TS errors, no missing imports).
- [ ] `verdict-store.ts` has the new `listRecent` export AND keeps all prior exports (`grep export verdict-store.ts` before/after — pre-existing exports unchanged).
- [ ] No change to `engine.ts`, `seats.ts`, `event-trigger.ts`.
- [ ] **Restart launchd backend after build** — verify with `curl http://localhost:8080/api/diagnostics`.
- [ ] **TP screenshot review:** curl outputs of all 3 endpoints + `/api/diagnostics` showing healthy.

## Validation Commands

```bash
# Build
cd backend-hono && bun run build && cd ..

# Restart launchd
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load   ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke
curl -s http://localhost:8080/api/diagnostics | head -c 200
curl -s "http://localhost:8080/api/arbitrum/confidence-history?limit=5" | head -c 400
curl -s "http://localhost:8080/api/arbitrum/vote-breakdown/<some-verdict-id>" | head -c 400
# pnl-series requires a Supabase JWT — defer to T5 smoke
```

## Commit Format

```
[v5.36.0-alpha.4] feat: T4 chart-data endpoints (pnl-series, arbitrum confidence/votes)
```
