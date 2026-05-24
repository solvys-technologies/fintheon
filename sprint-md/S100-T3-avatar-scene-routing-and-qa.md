# Sprint Brief: S100-T3 -- Avatar Scene Routing and QA

## Context

This ticket wires future CAO wolf scenes to drawer lifecycle events after the prototype language is accepted.

## Scope

- Use `@sprint-md/S100-T3-avatar-scene-routing-and-qa.md` in the Linear issue description.
- Linear issue: pending.
- Branch target: `sprint/S100`.
- Route to-do drawer open to the summon scene.
- Route to-do drawer close to the dismiss scene.
- Preserve the initial chat greeting as the only scene with pit descent.
- Add `Opt + Right Cmd` avatar toggle behavior to the integrated runtime if it is not already present.

## Acceptance

- Drawer open and close trigger the correct avatar scene once per lifecycle event.
- Toggle hides/shows avatar scenes without breaking drawer behavior.
- Visual QA confirms no overlap, clipping, or composer input obstruction across supported desktop and mobile widths.
