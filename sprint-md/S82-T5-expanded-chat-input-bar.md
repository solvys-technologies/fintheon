# Sprint Brief: S82-T5 -- Expanded Chat Input Bar

## Context

Chat and NarrativeFlow composer surfaces should use bottom-of-screen space more intentionally while keeping message entry fast.

## Scope

- Use `@sprint-md/S82-T5-expanded-chat-input-bar.md` in Linear issue descriptions.
- Branch target: `sprint/S82`.
- Explore a compact expanded composer treatment for mobile web and desktop.
- Preserve shared composer behavior from S82 drawer work.
- Keep primary actions easy to reach and visually organized.

## Acceptance

- The composer has a clear collapsed and expanded treatment where appropriate.
- Mobile keyboard, safe-area, and desktop resizing behavior remain stable.
- Primary send, attach, tool, and context actions stay discoverable without clutter.
- The final treatment matches the rest of the chat UI.
- `npx tsc --noEmit --project frontend/tsconfig.json` passes.
