# Sprint Brief: S60-T5 -- Plane Outbound Relay + Autonomous Policy Loop

## Context

Fintheon must send updates back to Plane and support autonomous repetitive-fix cycles, but never auto-deploy unless verification succeeds. This track implements outbound signing, retries, failure handling, and policy gates that decide when actions can proceed.

## Branch Target

`s60-openagents-plane-loop`

## Scope -- Included

- [ ] Add outbound relay endpoint/client for Fintheon -> Plane.
- [ ] Sign outbound payloads with same HMAC format as inbound.
- [ ] Add retry/backoff with capped attempts and DLQ fallback.
- [ ] Add policy gate for autonomous action execution.
- [ ] Add verification gate requiring frontend pass before deploy action.
- [ ] Map inbound incidents to research task board entities where applicable.
- [ ] Wire trigger points from autopilot signal flow for repetitive issue escalation.

## Scope -- Excluded (DO NOT TOUCH)

- Inbound signature/schema files owned by T4.
- Route aggregation in `routes/index.ts` owned by T6.
- Frontend/electron files.

## File Ownership

- `backend-hono/src/routes/integrations/plane/outbound.ts` [NEW -- to create]
- `backend-hono/src/services/integrations/plane/outbound-client.ts` [NEW -- to create]
- `backend-hono/src/services/integrations/plane/policy-gate.ts` [NEW -- to create]
- `backend-hono/src/services/integrations/plane/verification-gate.ts` [NEW -- to create]
- `backend-hono/src/services/integrations/plane/task-mapper.ts` [NEW -- to create]
- `backend-hono/src/routes/autopilot/signal-ingest.ts`
- `backend-hono/src/routes/autopilot/index.ts`
- `backend-hono/src/routes/research/index.ts`

## Reuse Inventory

- `backend-hono/src/routes/autopilot/signal-ingest.ts:23` -- signal ingest pattern.
- `backend-hono/src/routes/research/index.ts:24` -- task creation/update paths.
- `backend-hono/src/services/research/task-board.ts:70` -- task board service API.

## Known Issues to Preserve

- Keep autopilot behavior unchanged when integration env vars are missing.
- Do not block normal signal ingestion if Plane relay is down.
- Preserve existing research task statuses and schema.

## Implementation Steps

1. Implement outbound payload builder with `incident_id`, `correlation_id`, `event_id`, `status`, and evidence/actions fields.
2. Implement signer using `X-Plane-Timestamp`, `X-Plane-Key-Id`, `X-Plane-Signature`.
3. Add retry policy with exponential backoff + jitter, max attempts 5.
4. Add DLQ persistence/logging for hard failures.
5. Implement policy gate decision function:
   - allow notify/update always,
   - allow fix proposal under threshold,
   - deny deploy unless verification gate passes.
6. Implement verification gate check input contract (frontend pass + health checks).
7. Add task mapping from incidents into research tasks when severity/component rules match.
8. Wire non-blocking outbound triggers in autopilot flow.

## Acceptance Criteria

- [ ] Outbound events are signed and accepted by verifier mock.
- [ ] Retry and DLQ paths are exercised and logged.
- [ ] Policy gate blocks deploy when verification signal is absent/failing.
- [ ] Autopilot ingest still returns success when Plane relay is unavailable.
- [ ] Incident-to-task mapping creates/updates research tasks correctly.

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build && cd ..

# Autopilot smoke
curl -s -X POST http://localhost:8080/api/autopilot/signal-ingest \
  -H "Content-Type: application/json" \
  -d '{"source":"test","strategy":"test","direction":"long","instrument":"NQ","confidence":0.7,"entryPrice":1,"stopLoss":0.5}'
```

## Commit Format

```
[v6.1.0-alpha] feat: T5 add Plane outbound relay, policy gate, and autonomous loop safeguards
```
