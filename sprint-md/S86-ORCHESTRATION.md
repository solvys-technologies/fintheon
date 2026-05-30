# S86 Orchestration: Local-to-Cloud Backend + Global Hermes

## Cloud Delegation Contract

Use Linear native "delegate to agent" / `@Codex` against GitHub branch
`sprint/S86`. Do not move issues to `In Progress (Solvys Agent)` unless TP
explicitly chooses the local watcher fallback.

Every agent must read:

- `AGENTS.md`
- `CLAUDE.md`
- `WORKSPACE.md`
- `.cursor/rules/`
- `sprint-md/SPRINT-NUMBERING.md`
- The assigned `@sprint-md/S86-*` brief

## Wave 1

`@sprint-md/S86-T1-cloud-backend-contract.md`

T1 owns the endpoint/auth/deployment contract and the local-dependency
inventory. No other implementation track should change backend routing
semantics until T1 lands its contract.

## Wave 2

`@sprint-md/S86-T2-global-hermes-runtime.md`

`@sprint-md/S86-T4-mobile-web-cloud-parity.md`

T2 owns the cloud Hermes runtime and provider/secrets boundary. T4 owns
mobile/web API parity and RSS/RiskFlow cloud behavior. These can run in
parallel after T1 because they touch different surface areas.

## Wave 3

`@sprint-md/S86-T3-desktop-cloud-first-runtime.md`

`@sprint-md/S86-T5-realtime-livekit-gate.md`

T3 owns Desktop runtime selection and network degradation. T5 owns the realtime
transport decision and any LiveKit minimum viable path. T5 must not add LiveKit
unless it is required by an S86 user workflow.

## Wave 4

`@sprint-md/S86-T6-cloud-deploy-observability.md`

T6 owns deployment and observability. It should not deploy until T1/T2 health
requirements are clear.

## Final Wave

`@sprint-md/S86-T7-unification-validation.md`

T7 is the validator. It is blocked by T1 through T6 and is the only track
allowed to reconcile cross-track integration issues. T7 must also run
`@sprint-md/S86-SURFACE-PARITY-DEMO.md` before S86 can be accepted.

## Local Watcher Fallback

Only use this fallback if TP explicitly requests local execution:

`Todo/Backlog -> In Progress (Solvys Agent) -> Awaiting Review -> Done`

The default for this sprint is Codex Cloud pickup from Linear on a phone.
