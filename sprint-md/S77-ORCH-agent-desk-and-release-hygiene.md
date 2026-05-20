# S77-ORCH: Agent Desk and Release Hygiene

## Priority

Seventh. This sprint is release hygiene and Agent Desk cleanup after the core product lanes.

## Tracks

| Track | Linear | Owner | Scope |
| --- | --- | --- | --- |
| S77-T1 | SOL-62 | Sam | Chat Todo Drawer slide-out from composer |
| S77-T2 | SOL-49 | Sam | MiroShark rename to Agent Desk |
| S77-T3 | SOL-50 | Sha | Canonical naming docs |
| S77-T4 | SOL-51 | Sha | Modularity pass for files over 300 lines |
| S77-T5 | SOL-52 | Sam | Pre-release QA checklist |

## References

- @sprint-md/S77-ORCH-agent-desk-and-release-hygiene.md
- @sprint-md/S61-T1-mutation-contract-audit.md
- @sprint-md/S62-T11-miroshark-agent-desk-rename.md
- @sprint-md/S62-T12-canonical-naming-docs.md
- @sprint-md/S62-T13-modularity-pass.md
- @sprint-md/S62-T14-qa-checklist.md

## Validation

- `npx tsc --noEmit --project frontend/tsconfig.json`
- `rm -rf dist && npx vite build`
- Naming audit, modularity audit, QA checklist run.
