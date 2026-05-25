# S78-ORCH: Voice, Performance, and Low-Priority Hygiene

## Priority

Lowest. This sprint contains useful but least urgent catch-up items.

## Tracks

| Track | Linear | Owner | Scope |
| --- | --- | --- | --- |
| S78-T1 | SOL-66 | Sam | Voice engine + consul-control integration review |
| S78-T2 | SOL-67 | Sam | Voice chat newest OpenAI STT model |
| S78-T3 | SOL-60 | Sha | Performance tab review + refine or strip |
| S78-T4 | SOL-76 | Sha | Empty predictions surface guard |
| S78-T5 | SOL-77 | Sam | Route logging hygiene |

## References

- @sprint-md/S78-ORCH-voice-performance-and-low-priority-hygiene.md
- @sprint-md/S27-ORCH-voice-engine.md
- @sprint-md/S50-ORCH-performance-tab.md
- @sprint-md/S62-ORCH-parity-ship-hygiene.md

## Validation

- `npx tsc --noEmit --project frontend/tsconfig.json`
- `cd backend-hono && bun run build`
- Smoke: voice path, performance tab, predictions empty state, route logs.
