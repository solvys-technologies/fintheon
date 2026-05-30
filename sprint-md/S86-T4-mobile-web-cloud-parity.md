# Sprint Brief: S86-T4 -- Mobile/Web Cloud API + RSS Parity

## Intent

Ensure the mobile PWA and web surfaces are fully cloud-backed and do not rely on
the user's machine running a local backend. RSS/RiskFlow feed availability must
come from the deployed backend/worker path.

## Linear

- Issue: `SOL-247`
- Branch target: `sprint/S86`
- Repo brief: `@sprint-md/S86-T4-mobile-web-cloud-parity.md`

## Included

- Audit mobile and web API call sites that still bake in `localhost:8080` or
  otherwise bypass the configured cloud backend.
- Normalize mobile API behavior around relative `/api/*` calls or the deployed
  `VITE_API_URL` contract, preserving the existing mobile Vercel rewrite.
- Verify RiskFlow/RSS public feed paths work from the cloud backend and do not
  require a local news process for standard users.
- Add compact degraded states for feed/chat surfaces where a cloud request is
  unavailable.
- Keep frontend Desktop runtime bridge compatibility intact.

## Excluded

- Do not redesign mobile screens.
- Do not alter RSS scoring doctrine or source policy unless a cloud-only bug
  requires a narrow fix.
- Do not change Desktop Electron files except through a reviewed T3 contract.

## File Ownership

- `mobile/main.tsx`
- `mobile/vercel.json`
- `mobile/hooks/`
- `mobile/contexts/`
- `mobile/lib/`
- `frontend/src/marketing/fintheon-catalyst-counter.ts`
- Web/mobile hooks with hardcoded `localhost:8080` that T1 classifies as
  customer-runtime paths
- `backend-hono/src/workers/riskflow-worker/`
- `backend-hono/src/routes/riskflow/`

## Dependencies

- Requires T1's endpoint matrix.
- Coordinate with T3 before changing shared runtime API-base code.

## Acceptance Criteria

- Mobile build has no baked `localhost` API dependency for production runtime.
- RiskFlow/RSS feed works from the deployed backend path.
- Mobile/web request failures render clear degraded states.
- Existing mobile Vercel rewrite remains valid.

## Validation Commands

```bash
cd mobile && bun run build
cd ../backend-hono && bun run build
curl -fsS https://fintheon.fly.dev/api/riskflow/feed?limit=5 | head -c 500
```
