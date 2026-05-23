# Sprint Brief: S80-T2 -- Desk Manager Permissions

## Context

Coliseum publishing must be desk-governed. Members can draft internally, but only Desk Managers and owners can publish Desk Forecasts or Desk Remarks. This track makes the permission boundary reusable before public forecast or remark routes ship.

## Linear Scope

- **Issue naming**: `S80-T2: Desk Manager Permissions`
- **Beta Phase**: Closed Beta
- **Linear Project**: Coliseum: Desk Forecasting & Social Intelligence
- **Linear Initiative**: Beta Closed
- **Cycle**: Beta Closed
- **Due date**: 2026-05-30
- **Assigned owner**: local Solvys Agent
- **Brief reference**: `@sprint-md/S80-T2-desk-manager-permissions.md`

## Branch Target

`sprint/S80`

## Scope -- Included

- [ ] Add a reusable permission helper for `narrative_desk_members.role`.
- [ ] Treat `owner` and `manager` as publish-capable roles.
- [ ] Treat `member`, missing membership, anonymous, and unauthenticated users as not publish-capable.
- [ ] Add route guards for Coliseum profile publishing and future forecast/remark publish routes.
- [ ] Add clear 401/403 responses.

## Scope -- Excluded

- Invite UI.
- Admin panel for member management.
- Multi-tenant organization billing.
- Public profile feed.

## Implementation Notes

- Keep role as text; do not introduce enums.
- Keep the helper in Coliseum service code so forecast and remark routes can reuse it.
- If the default desk has no membership for the current user, do not silently make them manager except in explicit local/dev fallback paths already used by the repo.

## Acceptance Criteria

- [ ] Owner can pass publish guard.
- [ ] Manager can pass publish guard.
- [ ] Member cannot publish.
- [ ] Anonymous user cannot publish.
- [ ] Permission helper is reusable from profile, forecast, and remark routes.

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
git diff --check
```

## Commit Format

```bash
[v6.7.11] feat: S80-T2 desk manager permissions
```
