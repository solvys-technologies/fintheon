# Sprint Brief: S83-T3 -- CAO Memo Drift Engine

## Context

RiskFlow catalyst drift already scores signal persistence. When a signal persists beyond two market sessions, or a cluster of related headlines gains traction around a watched desk narrative, Harper should draft a concise memo using the other agents' inputs.

## Scope

- Use `@sprint-md/S83-T3-cao-memo-drift-engine.md` in Linear issue descriptions.
- Branch target: `sprint/S83`.
- Add a service that identifies memo-worthy catalyst drift:
  - single RiskFlow signal drift over more than two market sessions
  - clustered headlines tied to a watched NarrativeFlow/DeskMap narrative
  - high-impact macro/company/ticker catalyst that changes the desk thesis for more than one session
- Harper is the only memo author. Oracle, Feucht, Consul, and Herald contribute compact inputs.
- Memo format:
  - ticker(s)
  - chart state
  - catalyst
  - what changed
  - why it matters
  - drift duration
  - confidence
  - cited evidence
  - next action
- Store drafts in Desk Rail Inbox; publish only after approval.

## Files

- Owned: `backend-hono/src/services/agentic-memos/*`, `backend-hono/src/routes/agentic-memos/*`.
- Reference: `backend-hono/src/services/agents/learning-session.ts`, `backend-hono/src/routes/riskflow/handlers.ts`, `backend-hono/src/services/riskflow/*`, `backend-hono/src/services/ai/agent-instructions/*`, `backend-hono/src/services/arbitrum/*`.
- Avoid: automatic public publishing, direct trade execution, and model training.

## Acceptance

- The service can explain why a memo was or was not proposed.
- Memo drafts cite source RiskFlow IDs, narrative/session IDs, and file-room/vault refs when used.
- Drafts are concise enough for one-page reading and render cleanly with Streamdown.
- No memo is published without Inbox approval.
- `cd backend-hono && bun run build` passes.
