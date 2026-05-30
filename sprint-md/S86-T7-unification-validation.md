# Sprint Brief: S86-T7 -- Unification Validation + Cloud Pickup Gate

## Intent

Validate the full S86 local-to-cloud backend move after T1 through T6 land.
This track is the sprint validator and must not start until predecessor tracks
have posted validation evidence in Linear.

## Linear

- Issue: `SOL-250`
- Branch target: `sprint/S86`
- Repo brief: `@sprint-md/S86-T7-unification-validation.md`

## Included

- Review every predecessor diff and validation receipt.
- Resolve cross-track conflicts in API-base precedence, diagnostics payloads,
  cloud Hermes semantics, Desktop degraded state, and LiveKit decision.
- Run the full validation gate across backend, frontend, mobile, Desktop smoke,
  cloud health, and secret scanner.
- Confirm Linear issue descriptions and sprint docs match actual shipped
  behavior.
- Add final changelog entry with validation evidence and remaining caveats.

## Excluded

- Do not implement new feature scope beyond integration fixes required to make
  predecessor tracks work together.
- Do not publish a DMG.
- Do not mark issues Done before validation evidence is present.

## File Ownership

- `src/lib/changelog.ts`
- Any S86 docs requiring final correction
- Narrow integration fixes across T1-T6 files when needed

## Dependencies

- Blocked by S86-T1 through S86-T6.

## Acceptance Criteria

- Backend build passes.
- Frontend build passes.
- Mobile build passes.
- Desktop smoke passes or documents a precise blocker.
- Cloud health and diagnostics pass.
- Desktop standard runtime no longer requires local backend.
- Network-loss behavior is verified and documented.
- Portless remains blocker/developer repair only.
- LiveKit decision is recorded and implemented only if justified.

## Validation Commands

```bash
bun run security:secrets
cd backend-hono && bun run build
cd .. && bun run frontend:build
cd mobile && bun run build
cd .. && bun run desktop:smoke
curl -fsS https://fintheon.fly.dev/healthz
curl -fsS https://fintheon.fly.dev/api/diagnostics | head -c 1000
```
