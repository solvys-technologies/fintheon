# Sprint Brief: S86-T1 -- Cloud Backend Contract + Local Dependency Audit

## Intent

Define the backend contract that lets Fintheon run fully from the cloud by
default. This track identifies every remaining local-backend dependency,
classifies it as cloud-ready, developer-only, or blocker-only, and publishes the
contract the other S86 tracks must follow.

## Linear

- Issue: `SOL-244`
- Branch target: `sprint/S86`
- Repo brief: `@sprint-md/S86-T1-cloud-backend-contract.md`

## Included

- Audit active routes, scripts, frontend/mobile hooks, Electron paths, and
  docs that assume `localhost:8080`, launchd, or a local Hermes process.
- Publish a compact endpoint matrix: route, auth requirement, current local
  assumption, cloud-ready status, owner track, and validation command.
- Define the backend base-url precedence for web, mobile, Desktop, and
  developer mode.
- Define the cloud health contract for `/healthz`, `/health`, and
  `/api/diagnostics` so T3/T6 can rely on consistent signals.
- Confirm the RSS/RiskFlow feed path that removes the need for a local news
  backend in ordinary customer runtime.

## Excluded

- Do not refactor call sites outside the contract/audit unless the change is a
  tiny unblocker for the contract document.
- Do not delete launchd or Portless support.
- Do not deploy.

## File Ownership

- `docs/backend/` or `docs/security/` for the contract document if needed
- `sprint-md/S86-*`
- Read-only audit targets:
  - `electron/main.cjs`
  - `electron/preload.cjs`
  - `electron/portless-services.cjs`
  - `frontend/lib/runtime-api-base.ts`
  - `frontend/lib/apiClient.ts`
  - `mobile/main.tsx`
  - `mobile/vercel.json`
  - `backend-hono/src/routes/diagnostics/index.ts`
  - `backend-hono/src/services/health-service.ts`
  - `scripts/install-cli.sh`
  - `scripts/update.ts`

## Acceptance Criteria

- Endpoint matrix exists and names every local-only exception.
- Base-url precedence is explicit for Desktop, web, mobile, and developer mode.
- Health/diagnostics contract is explicit enough for T3/T6 implementation.
- Portless is classified as blocker/developer repair only, not the default
  customer runtime.
- Changelog entry added if repo docs are changed.

## Validation Commands

```bash
rg -n "localhost:8080|127.0.0.1:8080|fintheon.fly.dev|__FINTHEON_API_BASE__|VITE_API_URL" electron frontend mobile backend-hono/src scripts docs
curl -fsS https://fintheon.fly.dev/healthz
curl -fsS https://fintheon.fly.dev/api/diagnostics | head -c 400
```
