# Sprint Brief: S83-T5 -- 5 PM Agentic Analysis Block

## Context

At 5 PM ET, Fintheon's agents should wake into a 2-3 hour desk-analysis block that runs alongside Arbitrum, scheduled crons, reflection loops, vault reads, and memo proposal generation.

## Scope

- Use `@sprint-md/S83-T5-5pm-agentic-analysis-block.md` in Linear issue descriptions.
- Branch target: `sprint/S83`.
- Extend the existing 17:00 ET CAO/Arbitrum loop instead of creating a disconnected scheduler.
- The analysis block should review:
  - trader chat activity
  - NarrativeFlow/DeskMap activity
  - trading/session activity
  - RiskFlow catalyst drift
  - watched narratives
  - vault/file-room updates
  - recent agent learning/reflection rows
- The block can create Inbox proposals for memo drafts, not auto-published memos.
- Keep Monday-Friday market-week boundaries for event windows; do not publish on a fixed weekly cadence.

## Files

- Owned: `backend-hono/src/services/cron/cao-evening-review-scheduler.ts`, `backend-hono/src/services/agentic-analysis-block/*`.
- Reference: `backend-hono/src/services/cron/arbitrum-session-scheduler.ts`, `backend-hono/src/services/cron/dispatch-scheduler.ts`, `backend-hono/src/services/agents/learning-session.ts`, `backend-hono/src/services/ai/agent-instructions/harper-extra.md`.
- Avoid: replacing PMDB/TWT, creating a second Weekly Tribune, or bypassing Inbox approval.

## Acceptance

- A single 17:00 ET path coordinates Arbitrum session review, CAO evening review, vault/file-room scan, catalyst drift review, and memo proposal checks.
- Logs identify which substeps ran and which were skipped.
- The block creates Inbox proposals only for high-impact drift or watched-narrative traction.
- The run can last 2-3 hours through queued/background subtasks without blocking HTTP requests.
- `cd backend-hono && bun run build` passes.
