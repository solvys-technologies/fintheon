# Sprint Brief: S86-T2 -- Global Hermes Cloud Runtime

## Intent

Create the server-side contract for a cloud-deployed global Hermes runtime so
Fintheon does not depend on a user's local Hermes/backend process for standard
agent workflows.

## Linear

- Issue: `SOL-245`
- Branch target: `sprint/S86`
- Repo brief: `@sprint-md/S86-T2-global-hermes-runtime.md`

## Included

- Define and implement the backend-side runtime boundary for cloud Hermes:
  provider routing, user/session identity, request IDs, timeout behavior,
  tool-approval boundaries, and health reporting.
- Keep secrets server-side and sourced through the S85 Infisical shape. Do not
  expose machine identity tokens or provider keys to Desktop/mobile/web clients.
- Preserve existing Harper/CAO chat behavior while moving ordinary runtime
  assumptions away from local-only process availability.
- Add cloud-safe failure modes: provider unavailable, auth missing, credits
  exhausted, timeout, and tool approval pending.
- Update diagnostics so Desktop/mobile can show whether cloud Hermes is
  operational, degraded, or unavailable without leaking secrets.

## Excluded

- Do not add a new visible provider picker or app UI unless it is required to
  surface a degradation state.
- Do not rewrite agent personas or prompts beyond cloud-runtime wording that is
  required to stop saying "localhost" as the only runtime.
- Do not rotate secrets.

## File Ownership

- `backend-hono/src/services/hermes/`
- `backend-hono/src/services/hermes-service.ts`
- `backend-hono/src/services/harper-handler.ts`
- `backend-hono/src/services/ai/provider-chain.ts`
- `backend-hono/src/services/ai/provider-chain-health.ts`
- `backend-hono/src/services/health-service.ts`
- `backend-hono/src/routes/harper/`
- `backend-hono/src/routes/diagnostics/`

## Dependencies

- Requires T1's cloud backend contract before final implementation.

## Acceptance Criteria

- Global Hermes runtime path is documented in code or docs and does not require
  a user's local backend.
- Diagnostics report cloud Hermes status without printing secrets.
- Existing Harper chat still works through `/api/harper/chat`.
- User/session isolation is explicit; one user's requests cannot reuse another
  user's tool approvals or conversation state.
- Provider-credit exhaustion still surfaces through the existing credit warning
  path.

## Validation Commands

```bash
cd backend-hono && bun run build
curl -fsS https://fintheon.fly.dev/api/diagnostics | head -c 800
```
