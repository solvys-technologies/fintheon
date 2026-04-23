# Sprint Brief: S31-T9 — Predictive Feature Knowledge Graph

## Context

Sprint 2 (Harper 2.1). After Harper has enough context about how a user actually uses Fintheon, she should be able to **propose and scaffold new features** based on observed usage patterns. Example: the user leans heavily on RiskFlow → Harper notices the concentration and suggests (or scaffolds) new RiskFlow-adjacent features the user might want.

This is a predictive knowledge-graph style system: track user interactions, aggregate into an intent model, let Harper read from it when asked ("what should I build next?") or spontaneously when a clear pattern emerges ("I've noticed you spend 40% of your time on RiskFlow; want me to scaffold a saved-filter feature?").

Scope boundary: this track builds the **observation + storage + read API**. Harper's scaffolding behavior (actually generating code for a proposed feature) is out of scope for S31 — that's Harper-Ops territory and depends on this track's data. This track ships the foundation; scaffolding lands later.

## Branch Target

`s31-harper-2-1`

## Scope — Included

### Migration — usage event store + aggregated intent view

- [ ] `backend-hono/migrations/039_usage_telemetry.sql`:

  ```sql
  CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    surface TEXT NOT NULL,                 -- 'riskflow' | 'narrative_flow' | 'sanctum' | 'boardroom' | 'apparatus' | 'performance' | 'chat' | 'calendar' | 'miroshark' | 'harper_vision' | ...
    action TEXT NOT NULL,                  -- 'view' | 'click' | 'filter' | 'open_detail' | 'promote' | 'dismiss' | 'ask_harper' | ...
    target_id TEXT,                        -- optional: the specific item acted on
    metadata JSONB
  );
  CREATE INDEX IF NOT EXISTS idx_usage_events_user_surface ON usage_events(user_id, surface, ts DESC);
  CREATE INDEX IF NOT EXISTS idx_usage_events_ts ON usage_events(ts DESC);
  ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
  CREATE POLICY usage_events_owner ON usage_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

  CREATE TABLE IF NOT EXISTS feature_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    anchor_surface TEXT NOT NULL,           -- surface that drove the proposal
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_event_ids UUID[],              -- usage_events rows that support the proposal
    status TEXT NOT NULL DEFAULT 'proposed',-- 'proposed' | 'accepted' | 'dismissed' | 'scaffolded'
    decided_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_feature_proposals_user_status ON feature_proposals(user_id, status, proposed_at DESC);
  ALTER TABLE feature_proposals ENABLE ROW LEVEL SECURITY;
  CREATE POLICY feature_proposals_owner ON feature_proposals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ```

- [ ] Materialized view `usage_intent_daily` (optional; cheap aggregation):

  ```sql
  CREATE MATERIALIZED VIEW IF NOT EXISTS usage_intent_daily AS
  SELECT
    user_id,
    date_trunc('day', ts) AS day,
    surface,
    COUNT(*) AS events,
    COUNT(DISTINCT action) AS distinct_actions
  FROM usage_events
  GROUP BY user_id, day, surface;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_intent_daily_pk ON usage_intent_daily(user_id, day, surface);
  ```

### Client-side event emitter

- [ ] New util `frontend/lib/usage-emit.ts`:
  - `emit(surface, action, targetId?, metadata?)` — POSTs to `/api/usage-events` (batched every 5s, fire-and-forget, no UI blocking)
  - Drops to localStorage if offline, flushes on reconnect
- [ ] Wire calls at key interaction points (audit-trail style, minimal diffs):
  - RiskFlow list open / item click / filter apply / dismiss
  - NarrativeFlow card open / promote
  - Sanctum thread open
  - Chat: `ask_harper`, `ask_desk_agent`
  - Calendar: day click, event click
  - Performance tab: section open, CSV upload, screenshot upload
  - Apparatus tool opens

### Backend — intake + read API

- [ ] New route `backend-hono/src/routes/usage-events.ts`:
  - `POST /api/usage-events` — accepts a batch `[{ surface, action, targetId, metadata }]`; auth-gated; inserts rows tagged with `user_id` from auth
  - `GET /api/usage-events/intent?days=30` — returns top surfaces by event count + distinct actions + trend direction
- [ ] New route `backend-hono/src/routes/feature-proposals.ts`:
  - `GET /api/feature-proposals` — list proposals for the user (filter by status)
  - `POST /api/feature-proposals` — Harper-only (via Routine secret or admin auth); creates a proposal with evidence IDs
  - `PATCH /api/feature-proposals/:id` — user accepts/dismisses

### Proposal generator Routine

- [ ] New service `backend-hono/src/services/knowledge-graph/proposer.ts`:
  - Runs on a weekly schedule
  - Queries `usage_intent_daily` for each user
  - Identifies dominant surfaces (top 2 by event count over last 14 days) AND anomalies (sudden spike / drop)
  - Calls Harper via provider-chain (T3) with a **strict system prompt**:
    - "Given this user's top surfaces and trend deltas, propose up to 3 concrete Fintheon feature additions that would deepen the dominant usage. Categories allowed: new data view, new filter, new automation, new card variant, new brief section, new agent invocation shortcut. Return JSON array of `{title, description, anchorSurface}`. Refuse if no signal is strong enough."
  - Writes proposals to `feature_proposals` with evidence event IDs
- [ ] New endpoint `backend-hono/src/routes/harper-ops/feature-proposals-weekly.ts` — Routine-secret-gated POST
- [ ] Routine doc `docs/routines/feature-proposals-weekly.md` — Sundays 6pm ET (for TP to wire)

### Surface to user (light touch)

- [ ] New component `frontend/components/settings/FeatureProposalsPanel.tsx`:
  - Lives in settings or a dedicated "Signals" sub-section — **not pushed** as a modal or toast
  - Lists current proposals with accept/dismiss buttons
  - Accept = writes `status='accepted'`; no code gets scaffolded in this track (deferred)
- [ ] Super-admin: fleet view of proposals (for TP) — mounted under an admin-only route; lists proposals across all users, anonymized by default, named on request

### Types

- [ ] Append to `shared/index.ts`:
  ```ts
  export interface UsageEvent {
    surface: string;
    action: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }
  export interface FeatureProposal {
    id: string;
    userId: string;
    proposedAt: string;
    anchorSurface: string;
    title: string;
    description: string;
    status: "proposed" | "accepted" | "dismissed" | "scaffolded";
    decidedAt: string | null;
  }
  ```

### Changelog + headers

- [ ] Changelog entry
- [ ] `// [claude-code 2026-04-23] S31-T9 predictive knowledge graph + feature proposals` on modified files

## Scope — Excluded (DO NOT TOUCH)

- Actual code scaffolding of accepted proposals — deferred to a later sprint
- Any desk-agent-only or frontend-only telemetry that overlaps with existing analytics (grep first; do not duplicate)
- Tools instrumented by T8's browser-harness audit — separate concern, do not merge
- PsychAssist-related telemetry — T6 owns those events (blindspots, infractions)
- Never log anything sensitive — no prices, no order IDs in metadata. Surface + action + opaque targetId only.

## Known Issues to Preserve

- Memory: `feedback_supabase_migration_filenames.md` — local SQL files, hand to TP.
- Event volume could be large: batch emissions, use fire-and-forget POST, never block UI.
- Proposer must refuse gracefully when signal is weak — no forced proposals. Pointing at a low-usage surface as "you should use this more" is the wrong behavior; skip the generation instead.
- Super-admin access must go through existing admin auth middleware (grep for admin-only route pattern).

## Implementation Steps

1. Write migration `039_usage_telemetry.sql`; hand to TP.
2. Build `usage-emit.ts` with batching + offline buffer.
3. Wire emit calls at 8–12 key interaction points (listed above). Minimal diffs — one line per site.
4. Build `/api/usage-events` POST + GET intent endpoints.
5. Build `feature-proposals` CRUD.
6. Build `proposer.ts` with strict system prompt + allowed categories.
7. Build `feature-proposals-weekly` Routine endpoint.
8. Build `FeatureProposalsPanel` (user + admin variants).
9. Smoke: emit 50 events across RiskFlow + NarrativeFlow, run proposer manually, verify proposals appear with correct evidence IDs.
10. Changelog + headers.

## Acceptance Criteria

- [ ] Migration applied; two tables + mat view + RLS live
- [ ] Client emits events from 8+ interaction points; batches hit `/api/usage-events`
- [ ] `GET /api/usage-events/intent?days=30` returns ranked surfaces
- [ ] Weekly Routine endpoint generates proposals only when signal is strong; refuses otherwise
- [ ] User can view + accept/dismiss proposals in settings panel (no push, no toast)
- [ ] Super-admin fleet view accessible under admin route; anonymizes by default
- [ ] `bun run build` + `vite build` pass
- [ ] All new files <300 lines
- [ ] Changelog entry added

## Validation Commands

```bash
cd backend-hono && bun run build && cd ..
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# Emit + read-back
curl -s -X POST http://localhost:8080/api/usage-events \
  -H "authorization: Bearer $LOCAL_TEST_JWT" \
  -H "content-type: application/json" \
  -d '[{"surface":"riskflow","action":"view"},{"surface":"riskflow","action":"filter","metadata":{"priority":"high"}}]'
curl -s "http://localhost:8080/api/usage-events/intent?days=30" -H "authorization: Bearer $LOCAL_TEST_JWT" | jq .

# Routine-gated proposer
curl -s -X POST http://localhost:8080/api/harper-ops/feature-proposals-weekly \
  -H "x-routine-secret: $ROUTINE_SECRET" | jq .
```

## Commit Format

```
[v5.23.0] feat: S31-T9 predictive knowledge graph + weekly feature proposals
```
