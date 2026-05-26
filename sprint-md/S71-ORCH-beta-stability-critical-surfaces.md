# S71-ORCH: Beta Stability Critical Surfaces

## Priority

Highest. This sprint contains the user-facing surfaces that should be stabilized before lower-priority catch-up work.

## Tracks

| Track  | Linear  | Owner | Scope                                                  |
| ------ | ------- | ----- | ------------------------------------------------------ |
| S71-T1 | SOL-144 | Sam   | NarrativeFlow full catalyst map + narrative boundaries |
| S71-T2 | SOL-137 | Sam   | PsychAssist reliability + scoring layout corrections   |
| S71-T3 | SOL-138 | Sha   | Lockout enforcement parity across surfaces             |
| S71-T4 | SOL-139 | Sha   | Bulletin tabs anti-lag + catalyst + event pass         |
| S71-T5 | SOL-140 | Sam   | Sidebar chat composer overflow hardening               |

## References

- @sprint-md/S71-ORCH-beta-stability-critical-surfaces.md
- @sprint-md/S71-T1-narrativeflow-full-catalyst-map.md
- @sprint-md/S62-T25-psychassist-tilt-lockout.md

## Validation

- `npx tsc --noEmit --project frontend/tsconfig.json`
- `rm -rf dist && npx vite build`
- Manual smoke: NarrativeFlow, PsychAssist, lockout, bulletin tabs, sidebar composer.
