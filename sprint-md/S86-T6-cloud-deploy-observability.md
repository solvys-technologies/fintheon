# Sprint Brief: S86-T6 -- Cloud Deploy, Observability + Rollback

## Intent

Make the cloud backend operationally safe enough to become the default runtime.
This track owns deploy readiness, health checks, rollback notes, and the smoke
tests that prove the deployed backend can replace local backend dependency for
standard users.

## Linear

- Issue: `SOL-249`
- Branch target: `sprint/S86`
- Repo brief: `@sprint-md/S86-T6-cloud-deploy-observability.md`

## Included

- Verify Fly deploy shape for `backend-hono` and document the exact command.
- Confirm required runtime env is sourced from S85 Infisical/Fly sync, without
  printing secret values.
- Add or tighten health/diagnostic checks for cloud backend, cloud Hermes,
  RiskFlow/RSS, LiveKit if used, and Desktop API-base source.
- Document rollback: restore prior Desktop API-base preference, keep local
  launchd fallback, or temporarily pin clients to remote-only cloud backend.
- Add smoke commands that a validator can run before any release decision.

## Excluded

- Do not publish Desktop artifacts.
- Do not change provider keys or rotate secrets.
- Do not force-deploy without TP approval if changes are high-risk.

## File Ownership

- `backend-hono/fly.toml` if present
- `backend-hono/package.json`
- `backend-hono/src/routes/diagnostics/`
- `backend-hono/src/services/health-service.ts`
- `scripts/desktop-release-preflight.sh`
- `scripts/update.ts`
- `docs/backend/`
- `docs/security/infisical-portless.md`

## Dependencies

- Requires T1 health contract.
- Requires T2 cloud Hermes status.

## Acceptance Criteria

- Cloud backend deploy/smoke procedure is documented and executable.
- Diagnostics expose enough state for T3/T7 to verify cloud-first runtime.
- Rollback plan is explicit and does not require a customer to debug local
  launchd.
- Secret validation is redacted.

## Validation Commands

```bash
cd backend-hono && bun run build
curl -fsS https://fintheon.fly.dev/healthz
curl -fsS https://fintheon.fly.dev/api/diagnostics | head -c 1000
bun run security:infisical:env
```
