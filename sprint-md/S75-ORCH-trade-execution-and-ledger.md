# S75-ORCH: Trade Execution and Ledger

## Priority

Fifth. This sprint follows the Rithmic core lane with trading-service integration and ledger hygiene.

## Tracks

| Track  | Linear | Owner | Scope                                 |
| ------ | ------ | ----- | ------------------------------------- |
| S75-T1 | SOL-45 | Sam   | Autopilot PnL + SL/TP proposal wiring |
| S75-T2 | SOL-46 | Sam   | Trading service ProjectX integration  |
| S75-T3 | SOL-47 | Sha   | Minimal tape backend trade execution  |
| S75-T4 | SOL-59 | Sha   | Positions API Rithmic + ProjectX      |
| S75-T5 | SOL-48 | Sam   | Journal streak days from database     |

## References

- @sprint-md/S75-ORCH-trade-execution-and-ledger.md
- @sprint-md/S62-ORCH-platform-qa-hygiene.md

## Validation

- `cd backend-hono && bun run build`
- `npx tsc --noEmit --project frontend/tsconfig.json`
- Smoke: trading service, tape execution path, positions API, journal streak calculation.
