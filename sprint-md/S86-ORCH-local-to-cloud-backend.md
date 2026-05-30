# S86-ORCH: Local-to-Cloud Backend + Global Hermes

## Intent

S86 moves Fintheon's default backend posture from "Desktop needs a local Hono
backend to feel complete" to "cloud backend is the normal runtime, with local
backend/Portless used only for explicit developer or blocker paths." The sprint
also defines a cloud-deployed global Hermes instance, keeps secrets behind the
S85 Infisical boundary, and makes Desktop degrade clearly during user network
loss instead of failing silently.

## Numbering

S86 follows the corrected active lane in `@sprint-md/SPRINT-NUMBERING.md`.
S100+ remains the post-beta/deferred lane and must not influence this sprint
number.

## Branch Target

`sprint/S86`

## Linear Scope

- Issue naming: `S86-ORCH: Local-to-cloud backend + global Hermes`
- Parent issue: `SOL-243`
- Project: `Beta -- Execution & integrations`
- Cycle: `8 - Beta Closed`
- Delegation: Linear native Codex Cloud delegation from branch `sprint/S86`

## Assignment Matrix

| Issue    | Linear  | Brief                                            | Owner       | Execution path | Dependencies |
| -------- | ------- | ------------------------------------------------ | ----------- | -------------- | ------------ |
| S86-ORCH | SOL-243 | @sprint-md/S86-ORCH-local-to-cloud-backend.md    | TP/Codex    | planning       | none         |
| S86-T1   | SOL-244 | @sprint-md/S86-T1-cloud-backend-contract.md      | Codex Cloud | backend audit  | none         |
| S86-T2   | SOL-245 | @sprint-md/S86-T2-global-hermes-runtime.md       | Codex Cloud | backend agent  | T1 contract  |
| S86-T3   | SOL-246 | @sprint-md/S86-T3-desktop-cloud-first-runtime.md | Codex Cloud | desktop        | T1 contract  |
| S86-T4   | SOL-247 | @sprint-md/S86-T4-mobile-web-cloud-parity.md     | Codex Cloud | mobile/web     | T1 contract  |
| S86-T5   | SOL-248 | @sprint-md/S86-T5-realtime-livekit-gate.md       | Codex Cloud | realtime       | T1, T2       |
| S86-T6   | SOL-249 | @sprint-md/S86-T6-cloud-deploy-observability.md  | Codex Cloud | ops/deploy     | T1, T2       |
| S86-T7   | SOL-250 | @sprint-md/S86-T7-unification-validation.md      | Codex Cloud | validation     | T1-T6        |

## Scope

- Make `https://fintheon.fly.dev` or the configured cloud backend the default
  runtime for Desktop, web, and mobile surfaces.
- Preserve local backend support for developer work and explicit blockers, but
  stop treating it as the normal Desktop requirement.
- Keep Portless scoped to local/backend blocker repair and diagnostics, not as
  the primary customer runtime.
- Establish one global Hermes cloud runtime contract that server routes can use
  without shipping machine identity credentials to end users.
- Evaluate LiveKit only for concrete remote realtime needs such as voice,
  collaboration rooms, or low-latency session presence. Do not add LiveKit as a
  generic backend transport if SSE/HTTP already covers the path.
- Prove network-loss behavior on Desktop: users see a clear degraded/offline
  state, cached last-known content where safe, and automatic recovery when the
  cloud backend is reachable again.

## Out of Scope

- Do not publish a DMG in this sprint.
- Do not delete local launchd backend support until every referenced local path
  has a cloud or developer-mode replacement.
- Do not rotate secrets unless S85 reopens that lane.
- Do not ship Infisical machine identity tokens inside Desktop, web, or mobile
  bundles.
- Do not use Obsidian as a human sprint workspace.

## Wave Order

1. T1 defines the cloud backend contract and local dependency inventory.
2. T2 and T4 can start after T1 publishes endpoint/auth assumptions.
3. T3 can start after T1 publishes the Desktop backend selection contract.
4. T5 starts after T1 and T2 clarify realtime/session requirements.
5. T6 starts after T1/T2 define deploy and health requirements.
6. T7 runs last and is blocked by all implementation tracks.

## Acceptance

- Every active backend-dependent Desktop/mobile/web surface has a cloud-first
  path or a documented local-only exception.
- Global Hermes has a cloud runtime contract, secrets boundary, and health
  signal.
- Desktop can start without the local backend and reaches the cloud backend for
  standard user workflows.
- Network loss produces explicit degraded/offline state and recovery, not app
  crash or silent empty panels.
- Portless remains available for local blocker repair, but is not required for
  ordinary customer runtime.
- LiveKit has a decision record and, only if justified, a minimal server-token
  path with no client-side secrets.
- T7 validates backend build, frontend/mobile type/build gates, cloud health,
  Desktop API-base selection, and offline/degraded behavior.
- T7 must run the surface parity demo in
  `@sprint-md/S86-SURFACE-PARITY-DEMO.md` and prove the same signed-in user
  has a cloud-backed, user-owned experience across Desktop, web/PWA, and mobile
  PWA.
