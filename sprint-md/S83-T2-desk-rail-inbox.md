# Sprint Brief: S83-T2 -- Desk Rail Inbox Approvals

## Context

The Consilium Desk Rail now has `Plans`, `Signals`, and `Inbox`. Inbox is the review surface for Harper-generated memo proposals and future desk approvals.

## Scope

- Use `@sprint-md/S83-T2-desk-rail-inbox.md` in Linear issue descriptions.
- Branch target: `sprint/S83`.
- Keep the Desk Rail tabs compact: `Plans`, `Signals`, `Inbox`.
- Add an inbox feed endpoint and frontend feed for pending desk approvals.
- First approval type: `agentic_memo`.
- Each inbox item includes title, desk, source signal/narrative refs, status, confidence, created time, author agent, and Streamdown-rendered draft preview.
- Add approve, request changes, and dismiss actions. Approving publishes the memo into the File Room.

## Files

- Owned: `backend-hono/src/routes/desk-inbox/*`, `backend-hono/src/services/desk-inbox/*`, `frontend/components/desk/*`, `frontend/lib/desk-inbox.ts`.
- Reference: `frontend/components/desk/DeskRail.tsx`, `frontend/components/desk/DeskPlansFeed.tsx`, `frontend/components/narrative/RiskSignalCards.tsx`, `frontend/components/chat/slots/StreamdownChat.tsx`.
- Avoid: changing RiskFlow card internals unless the inbox service needs a typed source reference.

## Acceptance

- Desk Rail shows exactly three tabs: `Plans`, `Signals`, `Inbox`.
- Inbox empty state is stable and does not resize the rail.
- Pending memo approvals render with concise previews and explicit source references.
- Approve publishes to File Room; request changes keeps the draft pending.
- `npx tsc --noEmit --project frontend/tsconfig.json` passes.
- `cd backend-hono && bun run build` passes if backend files changed.
