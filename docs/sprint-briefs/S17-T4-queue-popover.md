# Task Brief: S17-T4 — Message Queue Popover (Codex-Style)

**Date:** 2026-04-15
**Scope:** Codex-style message queue UI across all Fintheon chat interfaces — a top-border popover above the input bar showing queued messages with drag-to-reorder and remove. Desktop already has `MessageQueue.tsx` (edit/remove); update it to match new Codex-inspired drag UX. Mobile gets a new matching component.
**Estimated files:** 4 (1 new mobile + 3 modified desktop/mobile/store)
**Phase:** 2 (After T0 completes; can run alongside T5)
**Dependencies:** S17-T0 (Zustand store with queue state + auto-drain), S17-T1 (stop button determines input bar state during loading)
**Applies to:** Desktop frontend (update existing MessageQueue.tsx) + Mobile (new QueuePopover.tsx)

## Project Memory (READ FIRST)

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Sprint plan:** `/Users/tifos/.claude/plans/cosmic-snuggling-peacock.md`

## Context

When a user sends a message while Harper is still streaming a response, the message should queue locally and auto-send when the current response completes. The desktop already has `frontend/components/chat/MessageQueue.tsx` with edit/remove functionality but no drag-to-reorder and no Codex-style popover positioning. The user specifically referenced Codex's queue as the design target.

**Queue strategy: client-side only.** The backend queue system (`/api/queue/*`) is a rate-limiting defense (max 2 per conversation). The frontend queue is a UX feature. Messages queue locally in the Zustand store and drain one at a time through the existing chat endpoint. No backend queue relay needed.

## Files to Read First

- `frontend/components/chat/MessageQueue.tsx` — Desktop queue (edit/remove, no drag)
- `frontend/components/chat/FintheonComposer.tsx` — Desktop input bar (where queue renders)
- `mobile/components/chat/ChatInput.tsx` — Mobile input bar
- `mobile/stores/useChatStore.ts` — Store with queue state (built in T0)

## What to Build

### 1. `mobile/components/chat/QueuePopover.tsx` (NEW)

- **Action:** Create
- **Spec:** Codex-style queue popover anchored to the top border of `ChatInput`.

**Container:**

- Position: relative to input bar, renders directly above it
- `AnimatePresence` — slides up when queue has items, slides down to disappear
- Background: `var(--surface)` with `1px solid var(--border-visible)` top + left + right borders
- Border-radius: 8px 8px 0 0 (top corners only — bottom is flush with input bar)
- Padding: 8px 12px
- Max visible cards: 3, then scroll (overflow-y auto, max-height ~180px)

**Header row:**

- "QUEUE ({N})" in Space Mono 10px uppercase, `var(--accent)`, left-aligned
- Margin-bottom 6px

**Per-card layout (QueueCard):**

- 44px min height, `var(--surface-raised)` bg, 8px radius
- Left: 2px `var(--accent)` border accent
- Content: truncated message text (1 line, ellipsis overflow), Space Grotesk 13px, `var(--text-primary)`, padding-left 10px
- Right side (flex, gap 8px, right-justified):
  - `GripVertical` icon (lucide, 18px, `var(--text-disabled)`) — drag handle, cursor grab
  - `X` icon (lucide, 16px, `var(--text-disabled)`, hover → `var(--error)`) — remove button
- Both CTAs: 36px min tap target
- Margin-bottom: 6px between cards

**Drag-to-reorder:**

- Uses framer-motion `Reorder.Group` + `Reorder.Item`
- Axis: `"y"` only
- Visual feedback on drag: scale 1.02 + subtle shadow (`0 2px 8px rgba(0,0,0,0.3)`)
- `onReorder` callback updates queue order in store
- `dragListener` only on the GripVertical handle (not entire card)

**Entry/exit animation:**

- Cards: `motion.div` with `initial={{ opacity: 0, y: 10 }}`, `animate={{ opacity: 1, y: 0 }}`
- Popover container: `initial={{ height: 0, opacity: 0 }}`, `animate={{ height: "auto", opacity: 1 }}`

- **Max lines:** 120

### 2. `frontend/components/chat/MessageQueue.tsx` (MODIFY)

- **Action:** Modify
- **Spec:** Update desktop queue to match Codex-style:
  - Add `Reorder.Group` + `Reorder.Item` from framer-motion for drag-to-reorder
  - Add `GripVertical` drag handle icon (lucide) to each card, right-justified alongside existing X
  - Remove the inline edit feature (Edit3 icon) — Codex doesn't have inline edit, and it clutters the UX
  - Keep the X remove button
  - Add `onReorder: (newOrder: QueuedMessage[]) => void` prop
  - Position as a top-border popover above the composer (may need CSS adjustment in parent)

### 3. `mobile/components/chat/ChatInput.tsx` (MODIFY)

- **Action:** Modify
- **Spec:** Two changes for queue integration:

1. **Enqueue on Enter while loading:** When `isLoading` is true and user has text and presses Enter:
   - Call `onEnqueue?.(text)` instead of `onSend(text)`
   - Clear the textarea
   - This props was stubbed in T0

2. **Queue count badge:** When `queueCount > 0`:
   - Small gold circle badge (16px diameter) positioned absolute on top-right corner of the input bar
   - Contains queue count (Space Mono 10px bold, black text)
   - `var(--accent)` background
   - Animate in with `motion.div` scale spring

### 4. `mobile/stores/useChatStore.ts` (MODIFY) + `mobile/components/chat/ChatPage.tsx` (MODIFY)

- **Action:** Modify
- **Spec:** Implement queue action logic (stubs from T0):

**`enqueue(text)`:** Push `{ id: 'q-' + Date.now(), text, timestamp: Date.now() }` to `queuedMessages` array.

**`dequeue(id)`:** Filter out from `queuedMessages`.

**`reorderQueue(newOrder)`:** Replace `queuedMessages` with provided array (framer-motion Reorder returns the new array directly).

**Auto-drain in `sendMessage` finally block:** If `queuedMessages.length > 0`, shift first item, call `sendMessage(item.text, getAccessToken)` recursively. The `getAccessToken` reference needs to be stored or passed — store it as a ref in the store or pass via closure.

**ChatPage:** Render `QueuePopover` between messages area and `ChatInput`:

```tsx
<QueuePopover
  queue={store.queuedMessages}
  onRemove={(id) => store.dequeue(id)}
  onReorder={(newOrder) => store.reorderQueue(newOrder)}
/>
<ChatInput
  onSend={(text) => store.sendMessage(text, getAccessToken)}
  onEnqueue={(text) => store.enqueue(text)}
  onStop={() => store.abort()}
  isLoading={store.isLoading}
  disabled={isOffline}
  queueCount={store.queuedMessages.length}
/>
```

## Key Rules

- Client-side queue only — no backend queue relay
- Auto-drain: when `isLoading` → `false` and queue non-empty, auto-send next
- GripVertical is the ONLY drag handle (not entire card) — prevents accidental drags
- Queue persists across tab navigation (lives in Zustand store, not component state)
- Remove "edit" feature from desktop MessageQueue — Codex doesn't have it
- 44px min tap targets for remove buttons
- No gradients on queue cards

## DO NOT

- Implement backend queue relay endpoints
- Add message editing in queue cards (Codex doesn't have it)
- Add animations that delay the user from sending messages
- Use spring physics on drag (use linear/ease-out for snappy reorder)
- Queue more than 10 messages (hard cap — show toast "Queue full" if exceeded)

## Verification

```bash
cd mobile && bun run build
cd frontend && bun run build  # or npx vite build
# Manual test:
# 1. Send a message to Harper
# 2. While streaming, type another message and press Enter
# 3. Verify message appears in queue popover above input
# 4. Type and send a third — verify it queues behind the first
# 5. Drag cards to reorder — verify order updates
# 6. Tap X on a card — verify it removes with animation
# 7. When Harper's response finishes — verify next queued message auto-sends
# 8. Verify queue badge count updates correctly
# 9. Test on desktop: same behavior in FintheonComposer + MessageQueue
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'S17-T4: Codex-style message queue — drag-to-reorder popover above input bar, auto-drain on response complete, unified desktop + mobile',
  files: ['mobile/components/chat/QueuePopover.tsx', 'frontend/components/chat/MessageQueue.tsx', 'mobile/components/chat/ChatInput.tsx', 'mobile/stores/useChatStore.ts', 'mobile/components/chat/ChatPage.tsx']
}
```
