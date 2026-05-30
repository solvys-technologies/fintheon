# Sprint Brief: S86-T3 -- Desktop Cloud-First Runtime + Network Degradation

## Intent

Make Desktop usable without a local backend for ordinary workflows. Desktop
should prefer the cloud backend by default, keep local backend and Portless as
explicit developer/blocker paths, and show clear degraded state when the user's
network is down.

## Linear

- Issue: `SOL-246`
- Branch target: `sprint/S86`
- Repo brief: `@sprint-md/S86-T3-desktop-cloud-first-runtime.md`

## Included

- Update Desktop API-base resolution so standard user runtime uses the cloud
  backend unless developer mode or an explicit local override is active.
- Keep `localhost` and Portless fallbacks available for local development and
  blocker repair, but do not make them required for normal startup.
- Add or wire a network/backend status signal that Desktop surfaces can use for
  cloud reachable, degraded/offline, local fallback, and recovered states.
- Preserve app startup when the network is unavailable. Use cached last-known
  data where existing stores already support it, and make unavailable actions
  fail with clear messages.
- Ensure install/update scripts do not start a local backend as a customer
  requirement unless the user explicitly asks for local developer mode.

## Excluded

- Do not remove launchd files in this track.
- Do not remove Portless scripts.
- Do not publish a DMG.
- Do not build a new settings panel unless a compact existing surface cannot
  show the required status.

## File Ownership

- `electron/main.cjs`
- `electron/preload.cjs`
- `electron/portless-services.cjs`
- `frontend/lib/runtime-api-base.ts`
- `frontend/lib/apiClient.ts`
- `frontend/components/diagnostics/`
- `scripts/install-cli.sh`
- `scripts/update.ts`
- `scripts/fintheon-update.sh`
- `scripts/security/portless-desktop-check.mjs`

## Dependencies

- Requires T1's base-url and health contract.

## Acceptance Criteria

- Desktop can start and hit the cloud backend without local launchd backend
  health.
- Network loss produces explicit degraded/offline state and does not close the
  app.
- Network recovery restores cloud-backed requests without restarting Desktop.
- Portless remains usable for blocker repair and diagnostics, but is not the
  default requirement.
- Existing Windows remote-backend behavior is preserved.

## Validation Commands

```bash
bun run desktop:smoke
bun run portless:desktop:check
curl -fsS https://fintheon.fly.dev/healthz
```
