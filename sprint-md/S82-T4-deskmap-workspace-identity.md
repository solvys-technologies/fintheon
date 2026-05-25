# S82-T4: DeskMap + NF-Workspace Identity

## Intent

Bring NarrativeFlow naming and surfaces in line with the new model:

- `DeskMap` / `NF-DeskMap`: the desk-wide NarrativeFlow canvas owned by the trading desk team.
- `NF-Workspaces`: persisted NarrativeFlow session workspaces that build onto the DeskMap.

## Scope

- Linear issue: `SOL-188`

- Rename the code-level map component to `DeskMap`.
- Keep the DeskMap visually aligned with the old NarrativeFlow canvas chrome: ambient canvas, header controls, Harper overlay, and bottom floating toolbar.
- Add a desk-wide faint image layer to the DeskMap so the trading desk team can personalize the shared space.
- Add NF-Workspace cover media so each session can carry an uploaded meme/GIF/photo or a CAO-generated cover.
- Replace the NarrativeFlow standalone proposals/right-rail controls with an `Analysis` dropdown:
  - `Proposals`: existing proposals rail, unchanged.
  - `Research`: the existing resizable NF-Workspace right rail.

## Acceptance

- DeskMap image metadata is stored on `narrative_desks`, not user-local preferences.
- NF-Workspace cover metadata is stored on `narrative_sessions`.
- Uploaded GIFs/images remain image URLs/data URLs and are not converted to static JPEG.
- Generated covers do not expose custom prompt controls; regeneration uses the current desk/session context.
- Research rail remains resizable when open and can be toggled from `Analysis`.
- Full-map NarrativeFlow controls remain available on the legacy full-map path.
