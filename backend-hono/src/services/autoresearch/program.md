# Autoresearch System

## Purpose

Self-evaluating IV scoring system that tracks prediction accuracy and tunes scoring weights.

## Architecture

```
News Pipeline → Scoring Observer → Observation Store
                                        ↓
Yahoo Finance ← Price Resolver ← Outcome Resolution (30min delay)
                                        ↓
                                   Fitness Evaluator
                                        ↓
                                   Backtest Engine
```

## Components

### types.ts (Canonical Types)

All types for the autoresearch system. Every module imports from here.

- `ScoringObservation` — scored event + outcome
- `FitnessResult` — per-observation accuracy
- `FitnessReport` — aggregated accuracy report
- `BacktestConfig` — backtest parameters
- `ScoringWeights` — alias for IVScoringConfig

### observation-store.ts (T2)

Persists `ScoringObservation` records to PostgreSQL with in-memory fallback.

- `storeObservation()` — upsert observation
- `updateObservationOutcome()` — fill in actual move
- `getObservations()` — fetch for backtesting

### price-resolver.ts (T2)

Resolves instrument prices at specific timestamps using Yahoo Finance intraday bars.

- `resolvePriceAt()` — get price nearest to a timestamp
- `resolveOutcome()` — get price N minutes after an event
- `resolveYahooSymbol()` — map futures symbols to Yahoo tickers

### scoring-observer.ts (T2)

Hooks into the news scoring pipeline to capture observations.

- `recordObservation()` — called when a news item is scored
- `scheduleOutcomeResolution()` — delayed price check via setTimeout
- `resolveObservationOutcome()` — manual outcome backfill

### fitness.ts (T3)

Evaluates prediction accuracy of stored observations.

- `evaluateObservation()` — direction, magnitude, bias for one observation
- `generateFitnessReport()` — aggregated stats by event type and session

### backtest-scoring.ts (T3)

Replays observations through the scoring engine with configurable weights.

- `loadScoringWeights()` — reads from config/scoring-weights.json
- `runBacktest()` — fetch observations + evaluate fitness
- `printBacktestSummary()` — human-readable output

### run-backtest.ts (T3)

CLI entry point: `bun run backend-hono/src/services/autoresearch/run-backtest.ts`

## Configuration

- **Scoring weights**: `backend-hono/src/config/scoring-weights.json`
- **IV scoring config**: `backend-hono/src/config/iv-scoring-config.json`
- Both are read-only at runtime. Modify weights and rerun backtest to tune.

## Data Flow

1. News headline arrives → parsed → IV score assigned
2. `recordObservation()` captures: headline, eventType, ivScore, vixLevel, price, predictedMove
3. After 30 minutes, `resolveOutcome()` fetches the actual price → computes actualMove
4. `runBacktest()` fetches all observations with outcomes → `generateFitnessReport()`
5. Report shows direction accuracy, magnitude error, bias by event type and session
