# Sprint Brief: S80-T5 -- NarrativeFlow Toggle Shell

## Context

NarrativeFlow needs a view-toggle element that makes Desk Forecasts visible without disrupting the S79 session workspace. This track adds the shell for `Catalysts`, `Desk Forecasts`, `Coliseum`, and `Resolved`, with only Desk Forecasts functional in the private beta slice.

## Linear Scope

- **Issue naming**: `S80-T5: NarrativeFlow Toggle Shell`
- **Beta Phase**: Closed Beta
- **Linear Project**: Coliseum: Desk Forecasting & Social Intelligence
- **Linear Initiative**: Beta Closed
- **Cycle**: Beta Closed
- **Due date**: 2026-05-30
- **Assigned owner**: Codex Cloud or local Solvys Agent
- **Brief reference**: `@sprint-md/S80-T5-narrativeflow-toggle-shell.md`

## Branch Target

`sprint/S80`

## Scope -- Included

- [ ] Add a compact NarrativeFlow view toggle.
- [ ] Include views: `Catalysts`, `Desk Forecasts`, `Coliseum`, `Resolved`.
- [ ] Keep existing Catalyst/NarrativeFlow behavior as the default.
- [ ] Add a private-beta Desk Forecast list/create surface that calls S80-T4 routes.
- [ ] Show gated empty states for Coliseum and Resolved if data is not ready.
- [ ] Preserve bottom composer and catalyst drawer behavior.

## Scope -- Excluded

- Public social feed.
- Comments.
- Spaces.
- Full leaderboard.
- Public affiliate display.

## Design Constraints

- Compact labels.
- Flat Solvys Gold accents.
- No gradients, no shadows, no sparkles, no toast popups.
- Use inline status text for save/publish outcomes.

## Acceptance Criteria

- [ ] Toggle renders in NarrativeFlow without layout overlap.
- [ ] `Catalysts` preserves the existing S79 workspace behavior.
- [ ] `Desk Forecasts` lists forecasts for the active/default desk.
- [ ] Manager can open the create flow from Desk Forecasts.
- [ ] Coliseum and Resolved show gated beta states, not broken blanks.
- [ ] Mobile and desktop layouts do not overlap.

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
git diff --check
```

## Commit Format

```bash
[v6.7.11] feat: S80-T5 narrativeflow forecast toggle
```
