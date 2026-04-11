# S14-T2: Boardroom DAG Streaming Fix

## Goal

When user writes a memo or triggers a DAG, show streamed agent output in real-time — not the raw API response string.

## Root Cause

Frontend dispatches DAG via POST but doesn't subscribe to the SSE stream at `/api/boardroom/dag/:dagId/stream`. User sees: "Boardroom DAG dispatched. Subscribe to /api/boardroom/dag/{id}/stream for real-time agent results." instead of actual content.

## What to Do

1. **Wire SSE subscription** — after DAG dispatch, immediately open EventSource to stream URL:
   - Find the boardroom component that calls `POST /api/boardroom/dag`
   - After receiving `dagId` in response, open `new EventSource(/api/boardroom/dag/${dagId}/stream)`
   - Render each SSE event as agent responses arrive (text chunks, phase updates)
   - @backend-hono/src/routes/boardroom/index.ts — verify SSE stream endpoint works

2. **Verify deliberation panel** — MiroShark debate panel should already handle SSE:
   - @frontend/components/miroshark/MiroSharkDebatePanel.tsx — verify SSE subscription works for deliberation view (polls `/api/miroshark/deliberation/:id` every 2s)

3. **Persist threads** — wire boardroomThreadStore for history:
   - @frontend/lib/boardroomThreadStore.ts — this exists but is orphaned. Wire it to persist completed DAG threads to Supabase
   - Threads persist forever, no TTL
   - Backend needs a `boardroom_threads` table or similar in Supabase

## Key Context

- @backend-hono/src/routes/boardroom/index.ts — DAG dispatch + SSE stream routes
- Boardroom uses agent-bus DAG system: `"dag.task.dispatch"`, `"dag.task.result"`, `"dag.status"` events
- `POST /api/boardroom/dag` dispatches, `GET /api/boardroom/dag/:dagId/stream` streams results

## Verify

- Trigger a memo/DAG from boardroom UI
- See agent responses stream in real-time (not raw API string)
- Thread persists in history after completion
- Can view past threads from boardroom
