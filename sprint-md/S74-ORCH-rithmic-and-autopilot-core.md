# S74-ORCH: Rithmic and Autopilot Core

## Priority

Fourth. This sprint is the core execution and broker-readiness lane.

## Tracks

| Track  | Linear | Owner | Scope                                    |
| ------ | ------ | ----- | ---------------------------------------- |
| S74-T1 | SOL-54 | Sam   | Ship Rithmic gateway sidecar             |
| S74-T2 | SOL-55 | Sam   | Fix GET /api/rithmic/status              |
| S74-T3 | SOL-56 | Sha   | Rithmic SL/TP bracket orders             |
| S74-T4 | SOL-57 | Sha   | Autopilot daily PnL + Rithmic risk state |
| S74-T5 | SOL-58 | Sam   | Autopilot signals real market snapshot   |

## References

- @sprint-md/S74-ORCH-rithmic-and-autopilot-core.md
- @sprint-md/S62-ORCH-platform-qa-hygiene.md

## Validation

- `cd backend-hono && bun run build`
- API smoke: Rithmic status, gateway health, autopilot risk state, signal snapshot.
