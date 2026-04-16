# Sprint Brief: T7 — Mobile UX

## Context

The mobile app has existing components (ToolApprovalCard, push subscription, service worker) that are built but not wired. This track connects them: tool approval UX in chat, push notification routing to specific tabs, offline PWA caching, NarrativeFlow catalyst card port, and performance optimizations.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] New `mobile/hooks/useToolApprovals.ts` — approval state management + decision submission
- [ ] `mobile/components/chat/ChatPage.tsx` — add tool-approval SSE event parsing + ToolApprovalCard rendering (WAIT for T6 to finish ChatPage changes first)
- [ ] `mobile/public/sw.js` — app shell caching on install, stale-while-revalidate for API responses, postMessage routing on notification tap
- [ ] `mobile/App.tsx` — service worker message listener, route notification taps to correct tab
- [ ] `mobile/contexts/SettingsContext.tsx` — add `toolApprovals` notification category
- [ ] `mobile/components/settings/SettingsPage.tsx` — add tool approval notification toggle
- [ ] `mobile/components/layout/MobileToolbar.tsx` — offline indicator
- [ ] New `mobile/hooks/useOnlineStatus.ts` — reactive online/offline hook
- [ ] New `mobile/lib/offline-queue.ts` — IndexedDB message queue for offline sends
- [ ] `mobile/components/home/HomePage.tsx` — add Catalysts + Timeline snap pages, lazy-load EconCalendarEmbed
- [ ] New `mobile/components/home/CatalystCards.tsx` — NarrativeFlow catalyst card list
- [ ] New `mobile/components/home/TimelineView.tsx` — compact timeline view
- [ ] New `mobile/hooks/useCatalysts.ts` — data hook
- [ ] `mobile/components/chat/ChatMessage.tsx` — React.memo wrapper
- [ ] `mobile/index.css` — font-display: swap

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/` files (T1-T4 own)
- `frontend/` files (T1/T6 own desktop)
- `mobile/components/chat/SessionList.tsx` (T6 owns)
- `mobile/hooks/useConversations.ts` (T6 owns)

## Known Issues to Preserve

- `ChatPage.tsx` is shared with T6. **T6 completes first** (fixes dead code, wires sessions). T7 builds ON TOP of T6's changes (adds tool approval parsing + rendering). If T6 hasn't merged, T7 must wait on ChatPage changes.
- `ToolApprovalCard.tsx` is already fully styled — do not restyle it
- `ToolCallCard.tsx` exists for read-only display during streaming — keep it for non-approval tool calls
- The relay tool-decision endpoint is `POST /api/relay/tool-decision` — exists and works
- The tool-approval-store uses `noTimeout: true` for relay-originated requests (from T6's uncommitted changes). Mobile users are the actual decision-makers.
- `SettingsPage.tsx` is 618 lines — over the 300-line limit. When adding the tool approval toggle, split into section components if feasible.
- Memory note `feedback_keep_chat_mounted`: use display:none not conditional render for chat tab

## Implementation Steps

### P1: Tool Approval UX

1. Create `useToolApprovals.ts` hook:
   - State: `pendingApprovals: ToolApproval[]` (id, toolName, toolInput, description, status)
   - `addApproval(event)`, `resolveApproval(id, decision)` — POST to `/api/relay/tool-decision`
   - Expose `pendingApprovals` and `resolveApproval` for ChatPage
2. In ChatPage SSE parser (the `for (const chunk of chunks)` loop):
   - Handle `type === "tool-approval-needed"` events
   - Handle `type === "tool-approval-resolved"` events
3. Render `ToolApprovalCard` for each pending approval, below streaming content

### P2: Push Notification Routing

4. In `sw.js` notificationclick handler:
   - Instead of just `client.focus()`, call `client.postMessage({ type: 'notification-tap', category, url, conversationId })`
5. In `App.tsx`:
   - Listen for `navigator.serviceWorker.addEventListener('message', handler)`
   - Route: riskflow → tab 1, chat/tool-approval → tab 2, dailyBrief → tab 0
6. Add `toolApprovals` to NotificationPrefs in SettingsContext + toggle in SettingsPage

### P3: Offline PWA

7. In `sw.js` install event:
   - Pre-cache Vite-built JS/CSS chunks + HTML shell
   - Cache-first for static assets (hashed filenames = immutable)
   - Network-first for HTML shell
8. In `sw.js` fetch handler:
   - Stale-while-revalidate for: `/api/riskflow/list`, `/api/ai/conversations`, `/api/briefing/latest`
9. Create `useOnlineStatus.ts` — `navigator.onLine` + event listeners
10. In MobileToolbar: show `[OFFLINE]` badge when offline
11. Create `offline-queue.ts` — IndexedDB queue for chat messages, replay on reconnect

### P4: NarrativeFlow Port

12. Create `useCatalysts.ts` hook — calls backend catalyst API
13. Create `CatalystCards.tsx` — vertical card stack (catalyst title, status, symbols, last update)
14. Create `TimelineView.tsx` — chronological event list
15. Add both as snap pages in HomePage after existing pages
16. Lazy-load EconCalendarEmbed with `React.lazy`

### P5: Performance

17. Wrap `ChatMessage` with `React.memo`
18. Add `font-display: swap` to font CSS

## Acceptance Criteria

- [ ] Tool approval card renders in chat when Harper requests tool approval
- [ ] Approve/deny buttons work and stream resumes after decision
- [ ] Push notification tap routes to correct tab
- [ ] Service worker caches app shell + key API responses
- [ ] Offline indicator shows when network lost
- [ ] Catalyst cards display on HomePage
- [ ] ChatMessage doesn't re-render on every streaming token from other messages
- [ ] All new files under 300 lines

## Validation Commands

```bash
cd mobile && bun run build
npx tsc --noEmit --project mobile/tsconfig.json
# Manual: test tool approval flow via Harper, test offline mode, test notification tap routing
```
