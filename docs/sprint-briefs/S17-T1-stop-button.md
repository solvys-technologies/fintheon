# Task Brief: S17-T1 — Stop Request Button

**Date:** 2026-04-15
**Scope:** Add a functional stop/cancel button to ALL chat input bars (desktop FintheonComposer + mobile ChatInput) that aborts the active SSE stream.
**Estimated files:** 2 modified (desktop + mobile input components)
**Phase:** 1 (Parallel — can run alongside T2, T3 after T0 completes)
**Dependencies:** S17-T0 (Zustand store with `abort()` action)
**Applies to:** Desktop frontend + Mobile — both chat interfaces

## Project Memory (READ FIRST)

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Sprint plan:** `/Users/tifos/.claude/plans/cosmic-snuggling-peacock.md`

## Context

The chat store (built in T9) has an `abort()` action that calls `abortController.abort()` to cancel the active SSE stream. The ChatInput component currently only shows a send button (ArrowUp icon in a 44px gold circle). When `isLoading` is true, the send button is disabled. Instead, we need to swap it to a stop button that cancels the request. This mirrors Claude Code's stop behavior.

## Files to Read First

- `mobile/components/chat/ChatInput.tsx` — Current input bar (110 lines)
- `mobile/stores/useChatStore.ts` — Store with `abort()` action (built in T9)
- `mobile/components/chat/ChatPage.tsx` — Where ChatInput is rendered

## What to Build

### 1. `mobile/components/chat/ChatInput.tsx` (MODIFY)

- **Action:** Modify
- **Spec:** Add stop button behavior with animated icon swap.

**New props:**

```typescript
interface ChatInputProps {
  onSend: (text: string) => void;
  onStop?: () => void; // NEW: abort active request
  onEnqueue?: (text: string) => void; // NEW: for T13 queue (stub prop now)
  isLoading: boolean;
  disabled?: boolean;
  queueCount?: number; // NEW: for T13 queue badge (stub prop now)
}
```

**Button state logic:**
| `isLoading` | `text.trim()` | Button shown | Action |
|-------------|---------------|--------------|--------|
| false | empty | Disabled send (gray) | — |
| false | has text | Active send (gold) | `onSend(text)` |
| true | empty | **Stop (red)** | `onStop?.()` |
| true | has text | **Disabled send (gray)** | — (T13 will make this enqueue) |

**Stop button styling:**

- Same 44px circle container
- Background: `var(--error)` (#ef4444)
- Icon: lucide `Square` (not `StopCircle`), size 16px, color `var(--text-display)` (#ffffff)
- Cursor: pointer

**Animation:** Use `AnimatePresence` + `motion.button` for smooth icon swap:

```tsx
import { AnimatePresence, motion } from "framer-motion";

<AnimatePresence mode="wait">
  {showStop ? (
    <motion.button
      key="stop"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onStop}
      // ... stop button styles
    >
      <Square size={16} color="var(--text-display)" />
    </motion.button>
  ) : (
    <motion.button
      key="send"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={handleSend}
      disabled={!canSend}
      // ... existing send button styles
    >
      <ArrowUp
        size={20}
        color={canSend ? "var(--black, #000)" : "var(--text-disabled)"}
      />
    </motion.button>
  )}
</AnimatePresence>;
```

Where `showStop = isLoading && !text.trim() && !!onStop`.

**Import additions:** `Square` from lucide-react, `AnimatePresence, motion` from framer-motion.

### 2. `mobile/components/chat/ChatPage.tsx` (MODIFY)

- **Action:** Modify (minor)
- **Spec:** Pass `onStop` prop to ChatInput:

```tsx
<ChatInput
  onSend={(text) => store.sendMessage(text, getAccessToken)}
  onStop={() => store.abort()}
  isLoading={store.isLoading}
  disabled={isOffline}
/>
```

- **Max lines:** No significant change

## Key Rules

- 44px minimum tap target for stop button
- Use `var(--error)` for stop button background, not a custom red
- `AnimatePresence mode="wait"` so icons don't overlap during transition
- Don't break existing send behavior — only swap when `isLoading && !text.trim()`
- Square icon (filled), not StopCircle — matches Claude Code convention

## DO NOT

- Add queue logic yet — T13 handles that
- Change the textarea behavior
- Add haptic feedback (save for polish pass)
- Use gradients on the stop button

## Verification

```bash
cd mobile && bun run build
# Manual test:
# 1. Send a message to Harper
# 2. While streaming, verify stop button appears (red circle, square icon)
# 3. Tap stop — verify stream stops immediately
# 4. Verify send button returns after stopping
# 5. While streaming, type text — verify stop button disappears, disabled send appears
# 6. After stream completes, verify normal send button returns
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'T10: Stop request button — animated icon swap between send/stop, aborts active SSE stream',
  files: ['mobile/components/chat/ChatInput.tsx', 'mobile/components/chat/ChatPage.tsx']
}
```
