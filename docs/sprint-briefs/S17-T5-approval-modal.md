# Task Brief: S17-T5 — In-App Approval Modal + Cognition Stream

**Date:** 2026-04-15
**Scope:** Replace iOS/system permission popups with in-app approval modals across all Fintheon interfaces. Desktop already has `ToolApprovalCard.tsx` + `useToolApprovals.ts`; unify and enhance with "Approve All" session memory. Mobile gets new matching components + cognition stream hook. Backend relay gets tool-decision forwarding.
**Estimated files:** 5 (2 new mobile + 3 modified backend/desktop/mobile)
**Phase:** 2 (After T0 completes; can run alongside T4)
**Dependencies:** S17-T0 (Zustand store with approval state, relay requestId exposure, relay sendCommand)
**Applies to:** Desktop frontend (update existing) + Mobile (new components) + Backend relay

## Project Memory (READ FIRST)

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Sprint plan:** `/Users/tifos/.claude/plans/cosmic-snuggling-peacock.md`

## Context

The backend already has a full tool approval system:

- `tool-approval-store.ts` — Persistent permissions in `~/.fintheon/tool-permissions.json`, pending approvals as in-memory promises
- `cognition-emitter.ts` — Server-side EventEmitter, pushes `tool-approval-needed` / `tool-approval-resolved` events via SSE
- `GET /api/ai/cognition/stream?requestId=xxx` — SSE endpoint for cognition events
- `POST /api/harper/tool-decision` — Accepts `{ approvalId, decision }` to resolve pending approvals
- 30-second auto-approve timeout prevents hanging

The desktop has:

- `useToolApprovals.ts` — Hook that opens EventSource to cognition stream, manages approval state
- `ToolApprovalCard.tsx` — Inline approval card with Approve/Deny (no "Approve All")

**What's new:**

1. Mobile needs the same capability via relay (can't hit local backend directly)
2. "Approve All" session memory — approve a tool once for the entire session without permanent persistence
3. Three-button layout: "APPROVE ALL" / "APPROVE" / "DENY"
4. The existing desktop `ToolApprovalCard.tsx` grants **permanent** permission on approve. We need a middle ground: "Approve" = permanent (existing), "Approve All" = session-only (new)

**Cognition stream routing:** The cognition emitter runs on the LOCAL backend (same process as Strands agents). Mobile can't access it directly. The relay must either:

- Forward the EventSource via WS bridge (complex)
- OR have the local backend push cognition events through the existing WS channel (simpler)

**Recommended approach:** Piggyback cognition events on the existing WS channel. When the local backend emits a cognition step for a given requestId, it also sends a WS frame `{ requestId, type: "cognition", payload: stepData }` to the relay. The relay then either:

- Includes cognition events in the main SSE chat stream (mixed in with text-delta), OR
- Exposes a separate SSE endpoint `GET /api/relay/cognition/stream?requestId=xxx` that fans out WS cognition frames

The first option (mixed stream) is simpler and avoids a second EventSource connection from mobile.

## Files to Read First

- `frontend/components/chat/hooks/useToolApprovals.ts` — Desktop cognition stream hook
- `frontend/components/chat/ToolApprovalCard.tsx` — Desktop approval card UI
- `backend-hono/src/services/tool-approval-store.ts` — Approval store (permissions + pending)
- `backend-hono/src/services/cognition-emitter.ts` — Server-side cognition events
- `backend-hono/src/routes/relay.ts` — Relay routes (modified in T0)
- `backend-hono/src/services/relay-bridge.ts` — Relay bridge (modified in T0)
- `backend-hono/src/services/relay-connector.ts` — Local backend WS connector

## What to Build

### 1. `mobile/hooks/useCognitionStream.ts` (NEW)

- **Action:** Create
- **Spec:** Hook that listens for cognition events from the SSE chat stream (not a separate EventSource — events are mixed into the main stream by the relay).

**Alternative approach if mixed stream is too complex:** Open a separate EventSource to `${API_BASE}/api/relay/cognition/stream?requestId=${requestId}`. This requires a relay endpoint that forwards from WS.

**For the mixed-stream approach**, this hook just processes events from the Zustand store's SSE parser. The store's parser (T0) should detect `tool-approval-needed` type events and dispatch to the store's `pendingApprovals` array. This hook then:

- Reads `pendingApprovals` from store
- Checks `sessionApprovedTools` Set — if a pending approval's toolName is in the Set, auto-resolve it immediately (call `sendDecision(approvalId, 'approved')` without showing modal)
- Exposes `sendDecision(approvalId, decision)` which:
  1. Optimistically updates approval status in store
  2. POSTs to `${API_BASE}/api/relay/tool-decision` with `{ approvalId, decision }`
  3. On failure, reverts to pending

**For session-wide "Approve All":**

- `approveAllForSession(toolName)` adds to `sessionApprovedTools` Set in store
- Session = Zustand store lifetime (cleared on page refresh)
- Does NOT call `grantPermission()` on backend (that's permanent)

- **Max lines:** 80

### 2. `mobile/components/chat/ApprovalModal.tsx` (NEW)

- **Action:** Create
- **Spec:** Full-screen overlay modal for tool approval requests.

**Layout:**

- Full viewport overlay: `position: fixed`, `inset: 0`, `z-index: 1000`
- Backdrop: `rgba(0, 0, 0, 0.85)`
- Centered card: max-width 340px, `var(--surface-raised)` bg, 12px radius, padding 20px

**Header:**

- `ShieldAlert` icon (lucide, 20px, `var(--accent)`)
- "PERMISSION REQUIRED" — Space Mono 12px uppercase, `var(--accent)`, letter-spacing 0.08em

**Body:**

- Tool badge: colored pill matching TOOL_META (same map as desktop `ToolApprovalCard.tsx`):
  - `run_command` → Terminal icon, "SHELL COMMAND"
  - `read_file` → FileText icon, "READ FILE"
  - `write_file` → PenLine icon, "WRITE FILE"
  - `web_fetch` → Globe icon, "WEB FETCH"
  - Default → Shield icon, tool name
- Description: Space Grotesk 13px, `var(--text-primary)`, margin-top 10px, max 2 lines
- Input preview: collapsible section
  - Button: "Show input" / "Hide input" in Space Mono 10px, `var(--text-secondary)`
  - Content: `JSON.stringify(toolInput, null, 2)` in Space Mono 10px code block
  - `var(--surface)` bg, 6px radius, padding 8px, max-height 80px, overflow-y auto

**Three CTAs (stacked vertically, gap 8px, margin-top 16px):**

1. **"APPROVE ALL"** (session-wide):
   - `var(--accent)` 1px border, transparent bg, `var(--accent)` text
   - 48px height, full width, 8px radius
   - Space Mono 12px uppercase, letter-spacing 0.06em
   - Subtitle below button text: "for this session" in 9px, `var(--text-disabled)`
   - On click: `approveAllForSession(toolName)` + `sendDecision(approvalId, 'approved')`

2. **"APPROVE"** (permanent):
   - `var(--accent)` bg, `var(--black)` text
   - Same sizing as above
   - Subtitle: "permanent" in 9px
   - On click: `sendDecision(approvalId, 'approved')` (backend grants permanent permission)

3. **"DENY"**:
   - `var(--error)` 1px border, transparent bg, `var(--error)` text
   - Same sizing
   - On click: `sendDecision(approvalId, 'denied')`

**Animation:**

- Entry: `motion.div` — backdrop opacity 0→1, card scale 0.95→1 + opacity 0→1 (spring)
- Exit: card scale 1→0.98 + opacity 1→0 (ease-out 200ms), then backdrop fades

**Auto-approve indicator:** If the 30s auto-approve timer is running, show a subtle countdown ring or text: "auto-approving in {N}s" in Space Mono 9px, `var(--text-disabled)`. This gives urgency.

- **Max lines:** 180

### 3. `frontend/components/chat/ToolApprovalCard.tsx` (MODIFY)

- **Action:** Modify
- **Spec:** Add "Approve All" (session) button alongside existing Approve/Deny:
  - Add third button between Approve and Deny: "APPROVE ALL (SESSION)"
  - New prop: `onApproveAll: (id: string, toolName: string) => void`
  - Existing "Approve" button keeps permanent permission behavior
  - "Approve All" calls `onApproveAll` which adds to session Set in store + resolves approval
  - Update subtitle from "approval is permanent" to show which type was chosen

### 4. Backend: Cognition via WS Bridge

**Option A — Mixed stream (recommended):**

Modify `backend-hono/src/services/relay-connector.ts`:

- When processing a chat request on the local backend, subscribe to cognition events for the requestId
- For each cognition step, also send it through the WS channel as `{ requestId, type: "cognition-step", payload: stepData }`
- The relay bridge receives these and injects them into the SSE stream as `data: {"type":"cognition-step","kind":"tool-approval-needed",...}`

Modify `backend-hono/src/services/relay-bridge.ts`:

- In the `forward()` generator's `onMessage` handler, also yield `cognition-step` frames (alongside `chunk` frames)

Modify `mobile/stores/useChatStore.ts`:

- In the SSE parser, handle `cognition-step` events:
  - `kind: "tool-approval-needed"` → parse detail JSON, add to `pendingApprovals`
  - `kind: "tool-approval-resolved"` → update approval status
  - `kind: "tool-dispatch"` → add to `activeToolCalls` (feeds T3)

**Option B — Separate relay cognition endpoint (fallback if Option A is complex):**

Add `GET /api/relay/cognition/stream?requestId=xxx` to relay.ts:

- Opens a WS subscription to local backend for cognition events
- Fans out as SSE to mobile
- Mobile opens a second EventSource for this

### 5. Backend: Tool Decision Relay (if not already done in T0)

The `POST /api/relay/tool-decision` endpoint and `sendCommand()` method should already be stubbed in T0. If not fully implemented:

`relay-bridge.ts` — `sendCommand()`:

```typescript
async sendCommand(userId: string, command: { type: string; payload: unknown }): Promise<void> {
  const conn = this.connections.get(userId);
  if (!conn) throw new Error("local_offline");
  conn.ws.send(JSON.stringify(command));
}
```

`relay-connector.ts` (local backend side) — handle `tool-decision` command:

```typescript
// In WS message handler:
if (msg.type === "tool-decision") {
  const { approvalId, decision } = msg.payload;
  await resolveApproval(approvalId, decision);
}
```

## Key Rules

- "Approve All" = session memory only (Zustand Set, cleared on refresh), NOT permanent backend permission
- "Approve" = permanent (calls `grantPermission()` on backend, same as current behavior)
- Auto-approve timeout (30s) still runs server-side — show countdown in modal
- Dedup approvals: if same approvalId arrives twice, ignore the duplicate
- Session-approved tools auto-resolve WITHOUT showing modal (check BEFORE rendering)
- Modal is non-dismissable (no backdrop click dismiss, no swipe dismiss) — must choose an option
- Z-index 1000+ to overlay everything including queue popover and bottom sheets

## DO NOT

- Remove the 30s auto-approve timeout on the backend
- Make "Approve All" grant permanent permission (that's what "Approve" does)
- Show modal for tools already in `sessionApprovedTools` — auto-resolve silently
- Add iOS-specific permission prompting (this is a PWA, not a native app)
- Build a separate onboarding permissions screen yet (defer to polish phase)

## Verification

```bash
cd mobile && bun run build
cd backend-hono && bun run build
cd frontend && bun run build  # or npx vite build
# Manual test:
# 1. Ask Harper to do something requiring a tool (e.g. "run a command" or "write a file")
# 2. Verify approval modal appears (not an iOS system popup)
# 3. Tap "APPROVE" — verify tool executes, permission becomes permanent
# 4. Ask for same tool type — verify no modal (permanent permission)
# 5. Revoke permission (via settings), ask again — verify modal reappears
# 6. Tap "APPROVE ALL" — verify tool executes, no permanent persistence
# 7. Ask for same tool type again — verify auto-resolves WITHOUT modal (session memory)
# 8. Refresh page — verify "Approve All" session memory is cleared, modal reappears
# 9. Tap "DENY" — verify tool execution is blocked, Harper acknowledges denial
# 10. Test on desktop: same behavior in ToolApprovalCard with new "Approve All" button
# 11. Test auto-approve countdown: wait 30s without clicking — verify auto-approves
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'S17-T5: In-app approval modals with Approve All session memory — unified desktop + mobile, cognition stream via relay, tool-decision forwarding',
  files: ['mobile/hooks/useCognitionStream.ts', 'mobile/components/chat/ApprovalModal.tsx', 'frontend/components/chat/ToolApprovalCard.tsx', 'backend-hono/src/services/relay-connector.ts', 'backend-hono/src/services/relay-bridge.ts', 'mobile/stores/useChatStore.ts']
}
```
