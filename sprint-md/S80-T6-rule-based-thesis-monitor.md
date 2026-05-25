# Sprint Brief: S80-T6 -- Rule-Based Thesis Monitor

## Context

Desk Forecasts should feel alive. S80 adds a rule-based monitor that watches attached RiskFlow catalysts and read-only prediction-market reference movement. It should produce clear thesis status alerts without pretending Fintheon is a prediction market or trading venue.

## Linear Scope

- **Issue naming**: `S80-T6: Rule-Based Thesis Monitor`
- **Beta Phase**: Closed Beta
- **Linear Project**: Coliseum: Desk Forecasting & Social Intelligence
- **Linear Initiative**: Beta Closed
- **Cycle**: Beta Closed
- **Due date**: 2026-05-30
- **Assigned owner**: local Solvys Agent
- **Brief reference**: `@sprint-md/S80-T6-rule-based-thesis-monitor.md`

## Branch Target

`sprint/S80`

## Scope -- Included

- [ ] Add a monitor service for published Desk Forecasts.
- [ ] Check attached RiskFlow catalyst matches and recency.
- [ ] Check read-only prediction-market reference movement where a reference exists.
- [ ] Update forecast status to `gaining_support`, `thesis_proven`, `invalidated`, or `expired` when rule criteria are met.
- [ ] Emit alerts through existing bulletin/notification paths.
- [ ] Add a manual route to run the monitor for one forecast for QA.

## Scope -- Excluded

- AI adjudication.
- Real-money settlement.
- Trading execution.
- Full leaderboard scoring.
- Push notification redesign.

## Alert Wording

- `Thesis gaining support`
- `Thesis proven`
- `Thesis invalidated`

Do not use trade-result phrasing such as won, cashed, payout, buy, sell, or fill.

## Acceptance Criteria

- [ ] Monitor can run for one forecast by id.
- [ ] Matching RiskFlow evidence can move a forecast to `gaining_support`.
- [ ] Explicit validation criteria can move a forecast to `thesis_proven`.
- [ ] Expiry or failed criteria can move a forecast to `invalidated` or `expired`.
- [ ] Alerts appear through existing bulletin/notification infrastructure.
- [ ] Prediction-market data remains read-only.

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
git diff --check
```

## Commit Format

```bash
[v6.7.11] feat: S80-T6 rule based thesis monitor
```
