# Sprint Brief: S86-T5 -- Realtime Transport Decision + LiveKit Gate

## Intent

Decide whether LiveKit is needed for the local-to-cloud backend move. Use it
only if a concrete realtime workflow requires room/session semantics that HTTP,
SSE, or existing fetch polling cannot cover.

## Linear

- Issue: `SOL-248`
- Branch target: `sprint/S86`
- Repo brief: `@sprint-md/S86-T5-realtime-livekit-gate.md`

## Included

- Inventory realtime or near-realtime paths: Harper streaming, voice, tool
  approvals, RiskFlow refresh, notifications, and any session presence needs.
- Write a decision record: keep HTTP/SSE/polling, use existing LiveKit token
  route, or implement a minimal LiveKit-backed room path.
- If LiveKit is justified, keep the implementation server-token only and reuse
  existing `backend-hono/src/routes/livekit/handlers.ts` boundaries.
- Add diagnostics for LiveKit configured/degraded state without exposing API
  keys or secrets.

## Excluded

- Do not add LiveKit merely because it is available.
- Do not replace Harper chat streaming if the existing path satisfies S86.
- Do not add a visible group-call UI unless a concrete accepted S86 workflow
  requires it.

## File Ownership

- `backend-hono/src/routes/livekit/`
- `frontend/types/livekit.ts`
- `backend-hono/src/services/harper-voice/`
- `frontend/lib/harper-voice.ts`
- `backend-hono/src/services/health-service.ts`
- Optional docs under `docs/backend/`

## Dependencies

- Requires T1 for backend contract.
- Requires T2 for cloud Hermes session semantics.

## Acceptance Criteria

- Decision record exists and names why LiveKit is or is not required.
- If LiveKit is used, tokens are minted only server-side and secrets stay out
  of client bundles.
- Diagnostics report configured/degraded status without leaking secrets.
- Existing chat/feed realtime behavior does not regress.

## Validation Commands

```bash
cd backend-hono && bun run build
rg -n "LIVEKIT_|LiveKit|livekit" backend-hono frontend mobile scripts docs
```
