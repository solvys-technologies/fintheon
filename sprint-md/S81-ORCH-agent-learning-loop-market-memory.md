# S81 ORCH: Agent Learning Loop and Macro Watchlist Accuracy

## Goal

Within 7 days, make Fintheon agents measurably better at retaining market lessons, detecting repeated narrative cadences, and grounding futures analysis on accurate TradingView scanner prices before they speak.

## Scope

- @backend-hono/src/services/ai/agent-instructions/index.ts
- @backend-hono/src/services/ai/agent-instructions/shared-beliefs.ts
- @backend-hono/src/routes/agent-learning/index.ts
- @backend-hono/src/services/market-data/macro-watchlist.ts
- @backend-hono/src/routes/market-scan/index.ts
- @backend-hono/src/routes/ai/handlers/chat.ts
- @sprint-md/S75-T6-bond-atr-nq-contrarian-feasibility.md
- @sprint-md/S80-T3-agentic-desk-style-core.md

## Deliverables

1. Learning loop check: daily review of `/api/agent/learning/summary?days=7` for all core agents, with stalled agents flagged.
2. Reflection quality: every major analysis stores prediction, evidence, outcome hook, second-order read, and rubric upgrade.
3. Backtest path: convert historical setups into labeled examples before any fine-tune run; preserve train/validation/test date separation.
4. Macro watchlist: TradingView scanner snapshot covers NQ, ES, YM, RTY, GC, CL, VIX, DXY, US02Y, US10Y, and US30Y.
5. Accuracy gate: agents must use the macro watchlist or fetch a scanner quote before level-specific futures/rates/vol claims.
6. Progress check: by day 7, compare new reflections against actual outcomes and promote reusable lessons into durable memory.

## Acceptance

- Chat prompts include live macro watchlist performance.
- The market memory prompt asks for second-order narrative cadence and failure mode, not generic reflection.
- Fine-tuning is blocked until labeled backtest data exists with clean splits.
- A reviewer can run the learning summary endpoint and see whether each agent is improving, stalled, or missing outcome labels.
