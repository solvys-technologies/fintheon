# Sprint Brief: S80-T4 -- Desk Forecast Data Model

## Context

Desk Forecasts are formal, scored, time-bound thesis objects. They sit between NarrativeFlow and Coliseum: created from desk context, attached to RiskFlow catalysts, optionally benchmarked against read-only prediction-market data, and published only by Desk Managers or owners.

## Linear Scope

- **Issue naming**: `S80-T4: Desk Forecast Data Model`
- **Beta Phase**: Closed Beta
- **Linear Project**: Coliseum: Desk Forecasting & Social Intelligence
- **Linear Initiative**: Beta Closed
- **Cycle**: Beta Closed
- **Due date**: 2026-05-30
- **Assigned owner**: local Solvys Agent
- **Brief reference**: `@sprint-md/S80-T4-desk-forecast-data-model.md`

## Branch Target

`sprint/S80`

## Scope -- Included

- [ ] Add Desk Forecast tables tied to `narrative_desks` and optionally `narrative_sessions`.
- [ ] Store title, thesis, probability/direction, timeframe, validation rule, status, publisher, and timestamps.
- [ ] Attach RiskFlow catalysts to forecasts.
- [ ] Attach optional read-only prediction-market references with venue, market title, URL, price/odds, expiry, and fetched timestamp.
- [ ] Add forecast routes under `/api/coliseum/forecasts`.
- [ ] Add draft and publish lifecycle. Publish requires S80-T2 manager permission.

## Scope -- Excluded

- Order placement.
- Contract creation.
- Settlement or payouts.
- Comments, Spaces, and public feed.
- Automated scoring beyond storing validation inputs.

## Status Vocabulary

- `draft`
- `published`
- `watching`
- `gaining_support`
- `thesis_proven`
- `invalidated`
- `expired`

## Acceptance Criteria

- [ ] Desk member can create a draft forecast.
- [ ] Non-manager cannot publish the forecast.
- [ ] Manager or owner can publish the forecast.
- [ ] Forecast requires at least 3 RiskFlow catalysts to publish.
- [ ] Prediction-market references are read-only links/data snapshots.
- [ ] Forecast detail returns catalysts and market references.

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
git diff --check
```

## Commit Format

```bash
[v6.7.11] feat: S80-T4 desk forecast data model
```
