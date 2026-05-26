# S76-ORCH: Mobile and Sanctum Navigation

## Priority

Sixth. This sprint groups mobile release polish with Sanctum/Narrative navigation cleanup.

## Tracks

| Track  | Linear | Owner | Scope                                                       |
| ------ | ------ | ----- | ----------------------------------------------------------- |
| S76-T1 | SOL-42 | Sam   | Mobile CAO chat stream, bubbles, caret                      |
| S76-T2 | SOL-43 | Sam   | Mobile push notifications                                   |
| S76-T3 | SOL-44 | Sha   | Deprecate LiveKit/Bulletin legacy after Fluxer confirmation |
| S76-T4 | SOL-53 | Sha   | Mobile home ticker row alignment + copy                     |
| S76-T5 | SOL-38 | Sam   | NarrativeMap pan persistence + Sanctum nav                  |

## References

- @sprint-md/S76-ORCH-mobile-and-sanctum-navigation.md
- @sprint-md/S62-T1-sanctum-layout.md
- @sprint-md/S62-ORCH-platform-qa-hygiene.md

## Validation

- `npx tsc --noEmit --project frontend/tsconfig.json`
- Mobile smoke: CAO chat, push setup state, ticker row, Sanctum navigation.
