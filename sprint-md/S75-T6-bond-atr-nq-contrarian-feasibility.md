# S75-T6: Bond ATR Spike to NQ Contrarian Feasibility

## Goal

Determine whether Fintheon can use Treasury futures ATR spikes as an upstream trigger for contrarian NASDAQ futures trades, with historical timing validation before any live automation.

## Context

This is a research and architecture spike only. Do not add live execution code, do not place trades, and do not enable autonomous routing. The intended path is:

1. Study when bond futures regularly spike before the NQ setup window.
2. Define a statistically defensible alert condition for bond ATR expansion.
3. Use TradingView alerts as the real-time spike source if the historical study supports it.
4. Route any future signal through Fintheon's existing autopilot proposal and risk gates before a Rithmic/TradeSea account can execute anything.

## Instruments

- Bond trigger candidates: ZN, ZB, TN, UB where available.
- Execution candidates: NQ or MNQ only.
- Account and feed context: TradeSea account running on Rithmic data/feed access.

## Research Questions

- Which bond contracts show repeatable ATR or range expansion spikes before meaningful NQ reversals?
- What times of day do those bond spikes cluster in Eastern time?
- How far ahead of NQ movement do the bond spikes tend to occur?
- Are the events predictive enough after fees, slippage, spread, and latency assumptions?
- Does the edge survive session filters such as London handoff, US cash open, econ prints, lunch, power hour, and Globex?
- Which TradingView alert format can reliably encode the spike event with symbol, timeframe, ATR multiple, direction, and timestamp?
- Where should the alert land in Fintheon: existing `/api/autopilot/signal-ingest`, a new TradingView webhook adapter, or a staging-only research endpoint?

## Required Agent Work

- Read `AGENTS.md`, `CLAUDE.md`, `WORKSPACE.md`, `.cursor/rules/`, `docs/quantconnect/RITHMIC-GATEWAY.md`, `docs/autopilot-strategies/STRATEGY-INDEX.md`, `backend-hono/src/routes/autopilot/signal-ingest.ts`, and `backend-hono/src/services/autopilot/signal-processor.ts`.
- Inspect existing Rithmic, market data, strategy, and autopilot boundaries before proposing architecture.
- Identify the historical data needed for ZN/ZB/TN/UB and NQ/MNQ, including timeframe, minimum sample size, regular trading hours handling, and data vendor constraints.
- Propose a historical study design with exact event definitions:
  - ATR lookback.
  - Spike threshold.
  - Directional bond move definition.
  - NQ contrarian window.
  - Exclusion rules around scheduled econ prints.
  - Metrics: hit rate, expectancy, max adverse excursion, time-to-move, false-positive rate.
- Propose TradingView alert payload fields and webhook routing.
- Define risk gates that must exist before execution:
  - Paper-only first.
  - Proposal-only first.
  - No auto-execute until backtest and forward paper evidence pass.
  - Daily loss, max trades, lockout, and account-state checks.
- Deliver a concise report under `docs/autopilot-strategies/bond-atr-nq-contrarian-feasibility.md`.

## Acceptance Criteria

- A feasibility report exists with a clear `Go`, `No-Go`, or `Needs Data` recommendation.
- The report separates historical research, real-time alerting, and execution routing.
- The report explicitly says whether TradingView alerts are enough for real-time spike detection or whether Rithmic market data must be consumed directly.
- The report includes a proposed TradingView webhook JSON payload.
- The report includes a staged implementation plan that does not bypass Fintheon's existing risk gates.
- The report includes missing data/env/account prerequisites as action items, not implied success.

## Validation

- No source-code implementation is required for this spike.
- Run `git diff --check`.
- Do not run live order placement, paper order placement, or account mutation commands.

