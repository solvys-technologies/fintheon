# Task Brief: S15-T2 — Thinking/Reasoning Stream Indicator

**Date:** 2026-04-15
**Scope:** Unified thinking indicator across all Fintheon chat interfaces — pulsing dot + rotating phrases with expandable reasoning content. Desktop already has `FintheonThinkingIndicator.tsx`; update it to match the new UX (remove "Agent Mind" label, make dot/phrase clickable to toggle). Mobile gets a new matching component.
**Estimated files:** 3 (1 new mobile + 2 modified desktop/mobile)
**Phase:** 1 (Parallel — can run alongside T1, T3 after T0 completes)
**Dependencies:** S15-T0 (Zustand store with thinking state fields + extended SSE parser)
**Applies to:** Desktop frontend (update existing) + Mobile (new component)

## Project Memory (READ FIRST)

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Sprint plan:** `/Users/tifos/.claude/plans/cosmic-snuggling-peacock.md`

## Context

The backend already emits `reasoning-start`, `reasoning-delta`, and `reasoning-end` SSE events during Claude's extended thinking. The T9 store parses these into `thinkingState`, `thinkingContent`, and `thinkingDurationMs`. This track builds the visual indicator. The desktop implementation at `frontend/components/chat/FintheonThinkingIndicator.tsx` is the reference — port it to mobile using inline styles (mobile doesn't use Tailwind classes).

**User requirements:**

- Pulsing dot that's clickable to show/hide thinking content
- Thinking phrases rotate (the phrases replace "Agent Mind" label — no "Agent Mind" text)
- Click the dot OR the phrase to expand/collapse
- After completion: static dot + "thought for Xs"

## Files to Read First

- `frontend/components/chat/FintheonThinkingIndicator.tsx` — Desktop implementation (reference)
- `mobile/stores/useChatStore.ts` — Store with thinking state (built in T9)
- `mobile/components/chat/ChatMessage.tsx` — Where ThinkingIndicator will render
- `mobile/index.css` — Design tokens

## What to Build

### 1. `mobile/components/chat/ThinkingIndicator.tsx` (NEW)

- **Action:** Create
- **Spec:** Three-state thinking indicator component.

**Props:**

```typescript
interface ThinkingIndicatorProps {
  state: "thinking" | "done";
  content: string;
  durationMs?: number;
}
```

**THINKING_PHRASES** (same as desktop):

```typescript
const THINKING_PHRASES = [
  "Surveying the arena...",
  "Running risk models...",
  "Reviewing the legion's positions...",
  "Consulting the Consilium...",
  "Analyzing macro data...",
  "Checking volatility surface...",
  "Evaluating sentiment...",
  "Processing market signals...",
  "Cross-referencing events...",
  "Calculating exposure...",
  "Mapping liquidity pockets...",
  "Tracking implied vol drift...",
  "Pricing catalyst risk...",
  "Calibrating entry zones...",
  "Stress-testing conviction...",
];
```

**Active state (`state === 'thinking'`):**

- Layout: flex row, gap 10px, align-items center
- Pulsing dot: 8px circle, `var(--accent)` (#d4af37) background
  - CSS animation: `pulse-dot` keyframes — scale 1 to 1.4 and back, opacity 1 to 0.6 and back, 1.6s infinite
- Thinking phrase: Space Grotesk 13px italic, `var(--text-secondary)` (#8a8a8a)
  - Rotates every 2 seconds via `setInterval` in `useEffect`
- Entire row (dot + phrase) is clickable — toggles expanded state
- Cursor: pointer
- When expanded: below the row, show thinking content streaming in real-time
  - `motion.div` with `animate={{ height: "auto" }}` transition
  - Content: Space Mono 11px, `var(--text-secondary)`, white-space pre-wrap
  - Background: `var(--surface)` (#0a0a0a), 1px `var(--border)` border, 8px radius
  - Padding: 10px 12px
  - Max height: 200px, overflow-y auto
  - Gold top border accent: 1px solid `var(--accent)`

**Done state (`state === 'done'`):**

- Static gold dot (no animation)
- Text: "thought for {X}s" in Space Mono 11px, `var(--text-disabled)` (#4a4a4a)
  - Format duration: `(durationMs / 1000).toFixed(1)` → e.g. "thought for 2.3s"
- Clickable to expand full thinking content (same expanded layout as above)

**NO "Agent Mind" label** — the rotating phrases and "thought for Xs" replace it entirely.

**CSS Keyframes** (inline `<style>` tag within component, same pattern as desktop):

```css
@keyframes pulse-dot {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.4);
    opacity: 0.6;
  }
}
```

- **Max lines:** 120

### 2. `mobile/components/chat/ChatMessage.tsx` (MODIFY)

- **Action:** Modify
- **Spec:** Render `ThinkingIndicator` above the message bubble for assistant messages that have thinking content.

```tsx
// Inside assistant message rendering, before the message bubble:
{
  msg.role === "assistant" && (msg.thinkingContent || currentlyThinking) && (
    <ThinkingIndicator
      state={currentlyThinking ? "thinking" : "done"}
      content={msg.thinkingContent || store.thinkingContent}
      durationMs={msg.thinkingDurationMs || store.thinkingDurationMs}
    />
  );
}
```

Where `currentlyThinking` = this is the latest assistant message AND `store.thinkingState === 'thinking'`.

Import `ThinkingIndicator` and the store. Add `thinkingContent?` and `thinkingDurationMs?` to `ChatMessageData` interface if not already added by T9.

- **Max lines:** +20 lines added

### 3. `mobile/index.css` (MODIFY)

- **Action:** Modify
- **Spec:** Add the pulse-dot keyframes to the global CSS (alternative to inline style tag):

```css
/* Thinking indicator pulse */
@keyframes pulse-dot {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.4);
    opacity: 0.6;
  }
}
```

Actually, prefer the inline `<style>` approach in the component (matching desktop pattern) to keep styles co-located. Only add to index.css if there are issues with inline styles.

## Key Rules

- No "Agent Mind" label — phrases serve as the indicator
- Pulsing dot uses `var(--accent)` (#d4af37) — Solvys Gold only
- Clicking the dot OR the phrase toggles expansion (same click handler on the row)
- During active thinking, content streams in real-time (re-renders as `content` prop updates)
- After thinking completes, content is stored on the message object (via T9 store logic)
- Use `motion.div` with `layout` for smooth height transitions on expand/collapse
- Inline styles (not Tailwind classes) — mobile app convention

## DO NOT

- Add "Agent Mind" text anywhere
- Use per-agent color variations — always Solvys Gold
- Add bounce/spring animations to the dot (simple scale pulse only)
- Add sound effects or additional haptic feedback
- Make the thinking content editable or copyable (keep it read-only)

## Verification

```bash
cd mobile && bun run build
# Manual test:
# 1. Send a complex question to Harper that triggers extended thinking
# 2. Verify pulsing gold dot appears with rotating phrases
# 3. Tap the dot — verify thinking content expands with streaming text
# 4. Tap again — verify it collapses
# 5. When thinking completes — verify dot stops pulsing, shows "thought for X.Xs"
# 6. Tap completed indicator — verify full thinking content is viewable
# 7. Scroll through multiple messages — verify each has its own thinking indicator
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'T11: Thinking/reasoning stream indicator — pulsing gold dot, rotating phrases, expandable reasoning content, "thought for Xs" on completion',
  files: ['mobile/components/chat/ThinkingIndicator.tsx', 'mobile/components/chat/ChatMessage.tsx']
}
```
