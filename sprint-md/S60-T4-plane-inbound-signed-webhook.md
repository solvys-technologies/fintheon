# Sprint Brief: S60-T4 -- Plane Inbound Signed Webhook

## Context

Plane must be able to send incident/task events into Fintheon securely. Inbound webhook handling requires HMAC signature verification, replay protection, timestamp validation, and idempotent processing so duplicate deliveries do not cause duplicate autonomous actions.

## Branch Target

`s60-openagents-plane-loop`

## Scope -- Included

- [ ] Add inbound route for Plane -> Fintheon integration.
- [ ] Implement HMAC-SHA256 verification for `X-Plane-Signature` and `X-Plane-Timestamp`.
- [ ] Support `X-Plane-Key-Id` key rotation.
- [ ] Add optional GitHub-compatible fallback header `X-Hub-Signature-256`.
- [ ] Add replay window + replay cache.
- [ ] Add `correlation_id` idempotency handling for no-op duplicate events.
- [ ] Validate payload schema at boundary with Zod.

## Scope -- Excluded (DO NOT TOUCH)

- Outbound relay policy/deploy gate files (T5).
- Global route mount in `routes/index.ts` (T6).
- Any frontend/electron files.

## File Ownership

- `backend-hono/src/routes/integrations/plane/inbound.ts` [NEW -- to create]
- `backend-hono/src/routes/integrations/plane/schema.ts` [NEW -- to create]
- `backend-hono/src/routes/integrations/plane/index.ts` [NEW -- to create]
- `backend-hono/src/services/integrations/plane/signature.ts` [NEW -- to create]
- `backend-hono/src/services/integrations/plane/replay-cache.ts` [NEW -- to create]
- `backend-hono/src/services/integrations/plane/idempotency-store.ts` [NEW -- to create]
- `backend-hono/src/services/integrations/plane/inbound-processor.ts` [NEW -- to create]

## Reuse Inventory

- `backend-hono/src/boot/relay-ws.ts:19` -- existing timing-safe compare helper pattern.
- `backend-hono/src/routes/harper-ops/feature-proposals-weekly.ts:9` -- cron-secret style guard pattern.
- `backend-hono/src/routes/harper-voice.ts:44` -- public webhook route shape and robust parsing style.

## Known Issues to Preserve

- Do not alter existing auth middleware behavior for non-integration routes.
- Do not introduce any dependency that requires paid external service.
- Keep degraded behavior safe when env vars are missing.

## Implementation Steps

1. Define canonical inbound schema in `schema.ts` with strict required fields.
2. Build signature verifier using raw body bytes, canonical string `${timestamp}.${rawBody}`.
3. Enforce timestamp skew window (300s), key-id secret lookup, constant-time compare.
4. Add replay cache (short TTL) keyed by `(kid, signature, timestamp)` and/or `event_id`.
5. Add idempotency store keyed by `correlation_id` + payload hash.
6. Process accepted payload into normalized inbound event record.
7. Return status semantics:
   - `202` accepted,
   - `200` duplicate no-op,
   - `401` signature/auth failure,
   - `422` schema failure,
   - `408` stale timestamp.

## Acceptance Criteria

- [ ] Valid signed inbound event returns `202`.
- [ ] Duplicate inbound event returns `200` no-op.
- [ ] Tampered or unsigned payload is rejected with `401`.
- [ ] Stale timestamp is rejected.
- [ ] Missing/invalid fields are rejected by schema.

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build && cd ..

# Inbound smoke (replace values)
curl -i -X POST http://localhost:8080/api/integrations/plane/inbound \
  -H "Content-Type: application/json" \
  -H "X-Plane-Timestamp: <ts>" \
  -H "X-Plane-Key-Id: <kid>" \
  -H "X-Plane-Signature: sha256=<digest>" \
  -d '<payload>'
```

## Commit Format

```
[v6.1.0-alpha] feat: T4 add signed Plane inbound webhook with replay/idempotency guards
```
