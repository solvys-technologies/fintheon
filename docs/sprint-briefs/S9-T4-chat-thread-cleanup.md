# S9-T4: Chat Thread Cleanup

## Context

Sprint 9, Track 4. Depends on **T1 being merged first** (no direct dependency, but T1 must be merged to avoid conflicts). You are reducing the 733-line `FintheonThread.tsx` by extracting self-contained sub-components. You also delete the deprecated `MessageRenderer.tsx`.

**Why:** FintheonThread is a god component that handles message rendering, error boundaries, Chain of Thought (CoT) expansion, hover action bars, scroll-to-bottom, and fade-in animations — all in one file. Three of these are self-contained and can be extracted without changing behavior.

## Files to Read First

Read these thoroughly:

- `frontend/components/chat/FintheonThread.tsx` — The entire file. Map every component and function defined inside it.
- `frontend/components/chat/parts/MessagePartRenderer.tsx` — The active message part renderer (replaces deprecated MessageRenderer)
- `frontend/components/chat/ChatMessageBubble.tsx` — Message bubble container
- `frontend/components/chat/types.ts` — Chat type definitions (MessagePart, ChatMessage)
- `frontend/components/chat/MessageRenderer.tsx` — The deprecated file. Verify it has ZERO imports before deleting.

## Files to Delete

| File                                           | Lines | Reason                                                                                                                                                                                                                                   |
| ---------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/components/chat/MessageRenderer.tsx` | 124   | Zero imports anywhere. Fully replaced by `parts/MessagePartRenderer.tsx`. Verify: `grep -rn "MessageRenderer" frontend/ --include="*.tsx" --include="*.ts" \| grep -v "node_modules \| MessageRenderer.tsx"` should return zero results. |

## Files to Create

### 1. `frontend/components/chat/MessageActions.tsx` (~60 lines)

Extract the hover action bar (copy + bookmark/take-note buttons) that appears on message hover.

```typescript
// [claude-code 2026-04-10] S9-T4: Extracted message hover actions from FintheonThread

import { useState, useCallback } from "react";
import { Copy, Check, BookmarkPlus } from "lucide-react";

interface MessageActionsProps {
  text: string;
  onTakeNote?: (text: string) => void;
}

export function MessageActions({ text, onTakeNote }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    // The hover action bar with copy + bookmark buttons
    // Use the exact JSX from FintheonThread's ActionBar component
  );
}
```

**Source location in FintheonThread:** Look for `ActionBar` or the hover actions component — around lines 272-319. It renders copy/bookmark icons and handles clipboard API.

### 2. `frontend/components/chat/MessageErrorBoundary.tsx` (~30 lines)

Extract the React error boundary class component.

```typescript
// [claude-code 2026-04-10] S9-T4: Extracted message error boundary from FintheonThread

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class MessageErrorBoundary extends React.Component<Props, State> {
  // Use the exact implementation from FintheonThread
  // It catches render errors per-message and shows a fallback
}
```

**Source location in FintheonThread:** Around lines 28-49. It's a standard React error boundary class component.

### 3. `frontend/components/chat/ChainOfThought.tsx` (~70 lines)

Extract the CoT (Chain of Thought / Thinking) display component that shows expandable reasoning content.

```typescript
// [claude-code 2026-04-10] S9-T4: Extracted Chain of Thought display from FintheonThread

import { useState, useEffect } from "react";

interface ChainOfThoughtProps {
  content: string;
  /** Auto-expand when content first appears, auto-collapse after delay */
  autoExpand?: boolean;
}

export function ChainOfThought({ content, autoExpand = true }: ChainOfThoughtProps) {
  const [expanded, setExpanded] = useState(false);

  // Auto-open on new content, auto-collapse after 4 seconds
  useEffect(() => {
    if (autoExpand && content) {
      setExpanded(true);
      const timer = setTimeout(() => setExpanded(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [content, autoExpand]);

  return (
    // Expandable thinking/reasoning panel
    // Use the exact JSX from FintheonThread's CoT rendering
  );
}
```

**Source location in FintheonThread:** Around lines 201-266. Look for the reasoning/thinking expansion UI — it has an auto-open timer and a collapsible panel with reasoning text.

## Files to Modify

### 1. `frontend/components/chat/FintheonThread.tsx` (733 → ~480 lines)

- Import `MessageActions` from `./MessageActions`
- Import `MessageErrorBoundary` from `./MessageErrorBoundary`
- Import `ChainOfThought` from `./ChainOfThought`
- Remove the inline definitions of these three components/classes
- Replace usage with the imported versions
- All other components stay in FintheonThread: `FintheonUserMessage`, `FintheonAssistantMessage`, `DirectUserMessage`, `DirectAssistantMessage`, `ScrollToBottomButton`, `AiLoader`, helper functions `extractText`/`extractReasoning`/`extractImages`

**Why these stay:** They use `useMessage()`, `useThread()`, and `useThreadRuntime()` from `@assistant-ui/react` which are context-dependent hooks. Extracting them would require passing thread context through props, adding complexity without reducing coupling.

## Key Rules

- **Visual output must be identical.** Chat messages must render exactly as before — same styling, same hover behavior, same CoT auto-expand timing.
- **Preserve the auto-expand timer.** The CoT panel auto-opens when reasoning appears, then auto-collapses after ~4 seconds. This timing must be preserved exactly.
- **Preserve clipboard API usage.** The copy button uses `navigator.clipboard.writeText()` — it needs to work in both Electron and browser.
- **Preserve error boundary behavior.** When a message fails to render, the error boundary should show a fallback, not crash the entire thread.
- **Do NOT extract FintheonUserMessage or FintheonAssistantMessage.** They are tightly coupled to @assistant-ui hooks and would become more complex, not simpler, if extracted.

## Verification

```bash
# 1. Verify MessageRenderer is truly dead
grep -rn "MessageRenderer" frontend/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v "MessageRenderer.tsx"
# Should return ZERO results

# 2. Type check
npx tsc --noEmit -p frontend/tsconfig.json

# 3. Build
npx vite build

# 4. Functional test (manual):
# - Open chat sidebar → send a message → assistant response appears correctly
# - Hover over an assistant message → copy + note buttons appear
# - Click copy → text copied to clipboard (verify with paste)
# - Ask a reasoning question ("Think step by step about...") → CoT panel auto-opens, auto-collapses after ~4s
# - Click the CoT toggle → manually expand/collapse works
# - Trigger a render error (if possible) → error boundary shows fallback, not crash
```

## Changelog Entry

```typescript
{ date: '2026-04-10T23:30:00', agent: 'claude-code', summary: 'S9-T4: Extract MessageActions, MessageErrorBoundary, ChainOfThought from FintheonThread (733→480 lines), delete deprecated MessageRenderer', files: ['frontend/components/chat/MessageActions.tsx', 'frontend/components/chat/MessageErrorBoundary.tsx', 'frontend/components/chat/ChainOfThought.tsx', 'frontend/components/chat/FintheonThread.tsx', 'frontend/components/chat/MessageRenderer.tsx (deleted)'] }
```

## DO NOT

- Do NOT modify shared-icons.tsx or time-utils.ts — T1 owns those
- Do NOT modify RiskFlowDetailCard, ExpandableTapeItem, or RiskFlowMini — T2 owns those
- Do NOT modify MainLayout.tsx — T3 owns that
- Do NOT modify FintheonComposer, FintheonChatInput, or any other chat component besides FintheonThread
- Do NOT extract FintheonUserMessage, FintheonAssistantMessage, or any @assistant-ui dependent component
- Do NOT modify the message part renderers in `parts/` directory
