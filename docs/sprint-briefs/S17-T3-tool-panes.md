# Task Brief: S17-T3 — Tool Call Streaming Panes

**Date:** 2026-04-15
**Scope:** Unified tool call panes across all Fintheon chat interfaces — collapsible execution cards showing tool name, duration, and expandable input/output (Claude Code-style command peek). Desktop already has `ToolOutputsPeek.tsx` + `ToolOutputBubble.tsx`; ensure they match new collapsed-by-default UX. Mobile gets new matching components.
**Estimated files:** 4 (2 new mobile + 2 modified)
**Phase:** 1 (Parallel — can run alongside T1, T2 after T0 completes)
**Dependencies:** S17-T0 (Zustand store with `activeToolCalls` array + step tracking in SSE parser)
**Applies to:** Desktop frontend (verify/update existing) + Mobile (new components)

## Project Memory (READ FIRST)

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Sprint plan:** `/Users/tifos/.claude/plans/cosmic-snuggling-peacock.md`

## Context

The backend emits `start-step` and `finish-step` SSE events around tool executions, plus `tool-dispatch` cognition events with tool name/input details. The desktop has `ToolOutputsPeek.tsx` (collapsed summary pill) and `ToolOutputBubble.tsx` (expanded tool details). This track ports that to mobile as inline collapsible panes within the message flow.

The user specifically wants Claude Code-style "command peek panes" that:

1. Stream tool execution in real-time
2. Collapse to a "thought for Xs" style summary after completion
3. Are expandable to show full tool input/output

## Files to Read First

- `frontend/components/chat/ToolOutputsPeek.tsx` — Desktop collapsed tool summary (reference)
- `frontend/components/chat/ToolOutputBubble.tsx` — Desktop expanded tool details (reference)
- `frontend/components/chat/parts/ToolCallPart.tsx` — Desktop tool call renderer (reference)
- `mobile/stores/useChatStore.ts` — Store with `activeToolCalls` (built in T9)
- `mobile/components/chat/ChatMessage.tsx` — Where tool panes render
- `backend-hono/src/services/strands/stream-adapter.ts` — How tool events are emitted in SSE

## What to Build

### 1. `mobile/components/chat/ToolCallPane.tsx` (NEW)

- **Action:** Create
- **Spec:** Single tool execution pane with three visual states.

**Props:**

```typescript
interface ToolCallPaneProps {
  tool: ToolCallPane;
  onToggle: (id: string) => void;
}

// Type (define in a shared types file or inline):
interface ToolCallPane {
  id: string;
  toolName: string;
  status: "running" | "complete" | "error";
  startedAt: number;
  durationMs?: number;
  input?: Record<string, unknown>;
  output?: string;
  isExpanded: boolean;
}
```

**TOOL_META map** (port from desktop `ToolApprovalCard.tsx`):

```typescript
const TOOL_META: Record<string, { icon: LucideIcon; label: string }> = {
  run_command: { icon: Terminal, label: "Shell" },
  read_file: { icon: FileText, label: "Read" },
  write_file: { icon: PenLine, label: "Write" },
  web_fetch: { icon: Globe, label: "Fetch" },
  exa_search: { icon: Search, label: "Search" },
  // Default fallback:
};
```

**Running state:**

- 40px height row
- Left: 2px gold border accent (`var(--accent)`)
- Icon area: lucide `Loader2` spinning (12px, `var(--accent)`)
- Tool name: Space Mono 11px, `var(--text-primary)`
- "executing..." in Space Mono 10px italic, `var(--text-disabled)`
- Background: `var(--surface-raised)`, 8px border-radius
- Padding: 8px 12px
- No collapse chevron while running (always shows content area if expanded)

**Complete state (collapsed, default):**

- Same 40px row
- Left: static gold border (2px)
- Icon: tool-specific from TOOL_META (12px, `var(--text-disabled)`)
- Tool label: Space Mono 11px, `var(--text-secondary)`
- Duration: Space Mono 10px, `var(--text-disabled)` — format as "3.2s"
- Right: `ChevronRight` (12px, `var(--text-disabled)`)
- Tap entire row to expand

**Complete state (expanded):**

- `motion.div` with `layout` for smooth height transition
- Row stays visible (chevron rotates to `ChevronDown`)
- Below row, content area:
  - "INPUT" label: Space Mono 9px uppercase, `var(--text-disabled)`, margin-bottom 4px
  - Input JSON: Space Mono 10px, `var(--text-secondary)`, `var(--surface)` bg, 6px radius, padding 8px, max-height 100px overflow-y auto, white-space pre-wrap
  - "OUTPUT" label: same style, margin-top 8px
  - Output text: same style as input, max-height 100px
- Max total expanded height: 240px

**Error state:**

- Same as complete but with `var(--error)` left border instead of gold
- Icon: lucide `AlertCircle` in `var(--error)`
- Duration replaced with "failed" text in `var(--error)`

**Animation:**

- Use `AnimatePresence` + `motion.div` for expand/collapse
- Height transition: 200ms ease-out
- Running spinner: lucide `Loader2` with CSS `animation: spin 1s linear infinite`

- **Max lines:** 150

### 2. `mobile/components/chat/ToolCallGroup.tsx` (NEW)

- **Action:** Create
- **Spec:** Groups sequential tool calls within a message into a collapsible summary.

**Props:**

```typescript
interface ToolCallGroupProps {
  toolCalls: ToolCallPane[];
  onToggleTool: (id: string) => void;
}
```

**Collapsed (default when all tools complete):**

- Pill-shaped button: `var(--surface-raised)` bg, 1px `var(--border-visible)` border, 20px border-radius
- Padding: 5px 10px
- Icon: lucide `Wrench` (12px, `var(--text-disabled)`)
- Text: Space Mono 11px, `var(--text-secondary)`
  - While any running: "{N} running" + `Loader2` spinner
  - All complete: "{N} tools" + duration of all combined
- Right: `ChevronRight` / `ChevronDown` (12px)
- Tap to expand

**Expanded:**

- Below the pill, vertical stack of `ToolCallPane` components with 6px gap
- `AnimatePresence` for smooth entry/exit

**Single tool optimization:** If only 1 tool call, render `ToolCallPane` directly without the group pill wrapper.

- **Max lines:** 80

### 3. `mobile/components/chat/ChatMessage.tsx` (MODIFY)

- **Action:** Modify
- **Spec:** Render `ToolCallGroup` between ThinkingIndicator (T11) and the message bubble for assistant messages with tool calls.

Rendering order within an assistant message:

1. `AgentBadge` (existing)
2. `ThinkingIndicator` (T11, if thinkingContent exists)
3. `ToolCallGroup` (this track, if toolCalls exist)
4. Message bubble with markdown content (existing)
5. Timestamp (existing)

```tsx
{
  msg.toolCalls && msg.toolCalls.length > 0 && (
    <ToolCallGroup
      toolCalls={msg.toolCalls}
      onToggleTool={(id) => store.toggleToolExpanded(id)}
    />
  );
}
```

Add to `ChatMessageData` if not already: `toolCalls?: ToolCallPane[]`

- **Max lines:** +15 lines added

### 4. `mobile/stores/useChatStore.ts` (MODIFY)

- **Action:** Modify
- **Spec:** Add `toggleToolExpanded(toolId: string)` action that flips `isExpanded` on the matching tool call entry in `activeToolCalls` and on the current message's `toolCalls` array.

Also ensure the SSE parser handles step events for tool tracking:

- When a `start-step` event arrives after a tool indicator (track with a `lastEventWasTool` flag), create a new `ToolCallPane` entry in `activeToolCalls` with status `running`
- When `finish-step` arrives, update the matching tool call to `complete` with `durationMs`
- Tool name/input comes from cognition `tool-dispatch` events (correlated by timing)

If cognition stream isn't available yet (T14 dependency), use a simpler heuristic: any step boundary that's not the first step likely contains a tool call. This is a best-effort approximation until T14 adds the full cognition stream.

- **Max lines:** +30 lines added

## Key Rules

- Inline styles only (mobile convention, no Tailwind)
- Tool-specific icons from TOOL_META with sensible fallback (lucide `Wrench`)
- Duration format: seconds with 1 decimal — "3.2s", "0.8s", "12.1s"
- Gold left border while running, stays gold on complete, red on error
- Single tool call renders directly without group wrapper (no "1 tools" summary)
- `AnimatePresence` for all expand/collapse transitions
- Maximum JSON display: truncate input/output to 500 chars with "..." suffix

## DO NOT

- Add copy-to-clipboard buttons on tool output (save for polish)
- Add syntax highlighting to JSON (Space Mono is enough)
- Use gradients or colored backgrounds per tool type
- Make tool panes draggable or dismissable
- Show tool panes for user messages (assistant only)

## Verification

```bash
cd mobile && bun run build
# Manual test:
# 1. Ask Harper something that triggers tool use (e.g. "search for AAPL news")
# 2. Verify spinning indicator appears while tool executes
# 3. Verify it collapses to pill with "N tools" + duration after completion
# 4. Tap pill — verify individual tool panes expand
# 5. Tap a tool pane — verify input/output JSON is visible
# 6. Tap again — verify it collapses
# 7. Multiple tool calls in one response — verify group summary shows correct count
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'T12: Tool call streaming panes — collapsible tool execution cards with running/complete/error states, Claude Code-style peek UX',
  files: ['mobile/components/chat/ToolCallPane.tsx', 'mobile/components/chat/ToolCallGroup.tsx', 'mobile/components/chat/ChatMessage.tsx', 'mobile/stores/useChatStore.ts']
}
```
