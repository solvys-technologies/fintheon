# S73-ORCH: RiskFlow and Brief Parity

## Priority

Third. This sprint focuses on market/econ data correctness and backend parity checks.

## Tracks

| Track | Linear | Owner | Scope |
| --- | --- | --- | --- |
| S73-T1 | SOL-40 | Sam | RiskFlow IV aggregate market hours + prior session score |
| S73-T2 | SOL-41 | Sam | Econ watch filter type import cleanup |
| S73-T3 | SOL-69 | Sha | Econ calendar ingest hardening |
| S73-T4 | SOL-75 | Sha | Brief generation parity |
| S73-T5 | SOL-74 | Sam | Parity endpoint smoke coverage |

## References

- @sprint-md/S73-ORCH-riskflow-and-brief-parity.md
- @sprint-md/S62-T23-execution-econ-calendar.md
- @sprint-md/S62-ORCH-parity-ship-hygiene.md
- @sprint-md/S62-ORCH-platform-qa-hygiene.md

## Validation

- `cd backend-hono && bun run build`
- `npx tsc --noEmit --project frontend/tsconfig.json`
- Smoke: RiskFlow feed, econ calendar, brief generation, parity endpoints.
