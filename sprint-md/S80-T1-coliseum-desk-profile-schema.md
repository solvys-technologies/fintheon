# Sprint Brief: S80-T1 -- Coliseum Desk Profile Schema

## Context

Coliseum needs a real desk identity layer before public forecasting. This track extends the existing `narrative_desks` foundation with profile metadata for how a desk presents itself, what style it claims, where it trades, and whether it has affiliate relationships. Store affiliate metadata now, but do not promote affiliate links in public UI during S80.

## Linear Scope

- **Issue naming**: `S80-T1: Coliseum Desk Profile Schema`
- **Beta Phase**: Closed Beta
- **Linear Project**: Coliseum: Desk Forecasting & Social Intelligence
- **Linear Initiative**: Beta Closed
- **Cycle**: Beta Closed
- **Due date**: 2026-05-30
- **Assigned owner**: local Solvys Agent
- **Brief reference**: `@sprint-md/S80-T1-coliseum-desk-profile-schema.md`

## Branch Target

`sprint/S80`

## Scope -- Included

- [ ] Add a Supabase migration for desk profile metadata.
- [ ] Add a Coliseum backend service folder for desk profile reads/writes.
- [ ] Add profile routes under `/api/coliseum/desks/:deskId/profile`.
- [ ] Support desk archetype classification: narrative trader, thematic investor, nothing-happens, macro, doomer, technician, contrarian, vol trader, policy watcher, fundamentalist.
- [ ] Support broker/prop firm classification as controlled fields.
- [ ] Store affiliate URL and disclosure metadata as controlled profile fields.
- [ ] Default existing `Priced In Capital` desk into a complete profile if no profile exists.

## Scope -- Excluded

- Public affiliate UI.
- Follow graph.
- Comments or Spaces.
- Forecast scoring.
- Model fine-tuning.

## Implementation Notes

- Reuse `narrative_desks.id` as the desk identity anchor.
- Use text fields and check constraints over enums.
- Keep affiliate fields nullable and disclosure-first.
- Add routes that return a useful default profile when no row exists yet.

## Acceptance Criteria

- [ ] A desk profile can be read for the default desk.
- [ ] A desk profile can be updated with archetypes, broker/prop firm classification, and disclosure metadata.
- [ ] Invalid archetype values are rejected.
- [ ] Affiliate URL cannot be saved without disclosure text.
- [ ] No public UI promotes affiliate links in this track.

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
git diff --check
```

## Commit Format

```bash
[v6.7.11] feat: S80-T1 coliseum desk profile schema
```
