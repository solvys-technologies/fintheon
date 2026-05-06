# S60 Orchestration -- Open-Agents Global Chat + Plane Autonomous Loop

## Sprint Metadata

- Sprint: S60
- Branch target: `s60-openagents-plane-loop`
- Model: shared branch, parallel tracks, dedicated unification track
- Scope: frontend + backend + electron

## End State

Ship one sprint that delivers all of the following in a single integrated release:

1. Global chat runtime migration from current Strands wiring to open-agents.dev SDK, without changing Fintheon surface behavior.
2. Plane entry point in Refinement (right-justified TV icon), opening Plane in Refinement content area while sidebar CAO chat remains usable.
3. Bi-directional Plane/Fintheon signed relay with HMAC verification/signing, replay defense, idempotency, and retry/DLQ patterns.
4. Autonomous repetitive-fix loop with policy/deploy guard: never deploy unless verification passes.

## Waves

### Wave 1 (parallel)

- `@sprint-md/S60-T1-refinement-plane-surface.md`
- `@sprint-md/S60-T2-openagents-runtime-core.md`
- `@sprint-md/S60-T4-plane-inbound-signed-webhook.md`

### Wave 2 (after Wave 1, parallel)

- `@sprint-md/S60-T3-chat-input-parity-modals.md`
- `@sprint-md/S60-T5-plane-outbound-policy-loop.md`

### Wave 3 (after Wave 2)

- `@sprint-md/S60-T6-unification-validation.md`

## File Ownership Rules

- T1 owns Refinement/Plane UI + Electron popup allowlist updates.
- T2 owns runtime bridge files and global chat runtime wiring.
- T3 owns composer/input-bar/modal parity.
- T4 owns inbound Plane webhook security + ingestion.
- T5 owns outbound Plane relay + policy gate + task mapping + autopilot trigger hook.
- T6 owns shared integration files and full validation only.
- No cross-track edits outside ownership except T6.

## Global Constraints

- Never run a Vite dev server.
- Always clean dist before build: `rm -rf frontend/dist && cd frontend && bun run build && cd ..`.
- Backend build: `cd backend-hono && bun run build && cd ..`.
- Launchd backend restarts only in T6.
- Preserve recent intentional RiskFlow behavior in `src/lib/changelog.ts` entries from 2026-05-05 and 2026-05-06.

## Unification Mode

Dedicated T6 unification track is mandatory because shared route registration and end-to-end roundtrip checks require coordinated, conflict-prone touches.
