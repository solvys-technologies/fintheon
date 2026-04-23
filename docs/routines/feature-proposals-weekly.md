# Routine: feature-proposals-weekly

Weekly Harper-driven generator for predictive feature proposals (S31-T9 knowledge graph).

## Schedule

Sundays at 18:00 ET (after TOTT publishes).

Cron equivalent (Eastern): `0 18 * * 0`

## Endpoint

```
POST https://fintheon.fly.dev/api/harper-ops/feature-proposals-weekly
Header: X-Cron-Secret: $CRON_SECRET_TOKEN
Body: (none)
```

Local equivalent:

```
POST http://localhost:8080/api/harper-ops/feature-proposals-weekly
Header: X-Cron-Secret: $CRON_SECRET_TOKEN
```

## Behavior

1. Refreshes the `usage_intent_daily` materialized view (best-effort).
2. Loads the last 14 days of aggregated per-user surface activity.
3. For each user with a strong signal (top surface ≥25 events AND either a rising trend or a clearly dominant top surface), asks Harper for up to 3 concrete feature proposals.
4. Refuses gracefully when no signal is strong enough — Harper returns `[]` and no proposals are written.
5. Inserts accepted drafts into `feature_proposals` with up to 5 evidence event IDs per proposal.

## Response shape

```json
{
  "usersScanned": 12,
  "usersWithSignal": 4,
  "proposalsCreated": 9,
  "errors": 0
}
```

## Required environment

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — telemetry storage.
- `OPENROUTER_API_KEY` — Harper provider chain.
- `CRON_SECRET_TOKEN` — endpoint authorization.

## Failure mode

If `OPENROUTER_API_KEY` is unset, the proposer logs a warning and returns 0 proposals (no error). If Supabase is unreachable, the route returns a degraded result with `usersScanned: 0`.

## Related

- Migration: `backend-hono/migrations/039_usage_telemetry.sql`
- Service: `backend-hono/src/services/knowledge-graph/proposer.ts`
- User-facing UI: `frontend/components/settings/FeatureProposalsPanel.tsx`
- Admin fleet view: `GET /api/feature-proposals/admin/fleet?anonymize=true`
