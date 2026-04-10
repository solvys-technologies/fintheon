# S8-T4: Frontend — Boardroom Panels + Surface Subscriptions

## Context

Sprint 8, Track 4. You are building the **frontend integration** for the AgentBus system — live per-agent streaming panels in the Boardroom, a DAG progress bar, SSE subscription hooks, and cross-surface reactivity (NarrativeFlow auto-push cards, Sidebar notifications).

**Depends on T1:** You consume SSE event types defined in `agent-bus/types.ts`.

**Codes against T2/T3 backend:** The SSE endpoints (`/api/boardroom/dag/:dagId/stream`, `/api/dag/:dagId/stream`) are created by T2/T3. You code against their expected event shapes (from T1 types). If backend isn't ready, your components will render with mock data until wired.

**What this enables:** The Boardroom transforms from a 30s-polling, single-thread view into a live multi-agent streaming interface. NarrativeFlow becomes reactive. Sidebar gets cross-agent awareness.

## Files to Read First

- `backend-hono/src/services/agent-bus/types.ts` — SSE event types: `AgentStreamEvent`, `DAGProgressEvent`, `NarrativePushEvent`, `SidebarNotifyEvent`. These are your API contract.
- `frontend/components/consilium/AgentChattr.tsx` — Current Boardroom chat. You're replacing the polling pattern with live panels.
- `frontend/components/consilium/ConsiliumHub.tsx` — Container for Boardroom. You'll add DAG progress bar here.
- `frontend/components/consilium/ConsiliumMessage.tsx` — Message rendering with agent colors/badges. Reference for styling.
- `frontend/contexts/FintheonAgentContext.tsx` — Agent roster (5 agents with IDs, names, colors). Use for panel labels.
- `frontend/contexts/NarrativeContext.tsx` — NarrativeFlow state. You'll add SSE subscription for auto-push cards.
- `frontend/components/chat/ChatSidebar.tsx` — Sidebar chat. You'll add cross-agent notification toasts.
- `frontend/lib/narrative-types.ts` — CatalystCard type. Auto-pushed catalysts must match this shape.
- `frontend/hooks/useHermesChat.ts` — Existing chat hook. Reference for SSE consumption patterns.

## Files to Create

### 1. `frontend/hooks/useAgentBusSSE.ts` (~90 lines)

Generic SSE subscription hook for AgentBus surface topics. Reusable across all surfaces.

```typescript
import { useEffect, useRef, useCallback, useState } from 'react';

interface UseAgentBusSSEOptions {
  /** SSE endpoint URL */
  url: string;
  /** Auto-connect on mount */
  enabled?: boolean;
  /** Reconnect on disconnect (with backoff) */
  reconnect?: boolean;
}

interface UseAgentBusSSEReturn<T> {
  /** Latest event received */
  lastEvent: T | null;
  /** All events received since connection */
  events: T[];
  /** Connection status */
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  /** Manual reconnect */
  reconnect: () => void;
  /** Manual disconnect */
  disconnect: () => void;
}

export function useAgentBusSSE<T>(options: UseAgentBusSSEOptions): UseAgentBusSSEReturn<T> {
  // Implementation:
  // 1. Create EventSource on mount (if enabled)
  // 2. Parse SSE `data:` lines as JSON, accumulate in events[]
  // 3. Update lastEvent on each new message
  // 4. Handle reconnect with exponential backoff (1s, 2s, 4s, max 30s)
  // 5. Clean up EventSource on unmount
  // 6. Ignore SSE comments (heartbeats)
}
```

### 2. `frontend/hooks/useBoardroomDAG.ts` (~100 lines)

Specialized hook for Boardroom DAG execution — dispatches DAG and subscribes to its stream.

```typescript
import { useState, useCallback } from 'react';
import { useAgentBusSSE } from './useAgentBusSSE';
import type { AgentStreamEvent, DAGProgressEvent, HermesAgentId } from '../../backend-hono/src/services/agent-bus/types';
// NOTE: Import types from a shared location or duplicate the minimal subset needed

interface BoardroomDAGState {
  dagId: string | null;
  status: 'idle' | 'dispatching' | 'running' | 'complete' | 'error';
  /** Per-agent accumulated text */
  agentOutputs: Record<string, { agentId: HermesAgentId; text: string; status: 'pending' | 'streaming' | 'complete' | 'error' }>;
  /** DAG wave progress */
  progress: { currentWave: number; totalWaves: number; tasks: Array<{ id: string; agentId: string; status: string }> };
  /** Final synthesis from Harper */
  synthesis: string | null;
  error: string | null;
}

interface UseBoardroomDAGReturn extends BoardroomDAGState {
  /** Dispatch a new Boardroom DAG */
  dispatch: (message: string, agents?: HermesAgentId[]) => Promise<void>;
  /** Cancel running DAG */
  cancel: () => Promise<void>;
}

export function useBoardroomDAG(conversationId: string, userId: string): UseBoardroomDAGReturn {
  // Implementation:
  // 1. dispatch(): POST /api/boardroom/dag → get dagId
  // 2. Subscribe to /api/boardroom/dag/${dagId}/stream via useAgentBusSSE
  // 3. On AgentStreamEvent:
  //    - 'agent-start': add agent to agentOutputs with status='streaming'
  //    - 'agent-delta': append text to agentOutputs[agentId].text
  //    - 'agent-complete': set agentOutputs[agentId].status='complete'
  //    - 'agent-error': set agentOutputs[agentId].status='error'
  // 4. On DAGProgressEvent:
  //    - 'dag-wave': update progress.currentWave + task statuses
  //    - 'dag-complete': set status='complete', extract synthesis from harper output
  // 5. cancel(): POST /api/dag/${dagId}/cancel
}
```

### 3. `frontend/components/consilium/BoardroomAgentPanel.tsx` (~120 lines)

A per-agent streaming panel for Boardroom. Shows one agent's live output with status indicator.

Props:
```typescript
interface BoardroomAgentPanelProps {
  agentId: HermesAgentId;
  agentName: string;
  text: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
}
```

Renders:
- Agent name + avatar (use existing agent roster from FintheonAgentContext for name/color)
- Status indicator: pulsing dot (streaming), checkmark (complete), X (error), dimmed (pending)
- Streaming text with typewriter-style reveal (CSS `@keyframes` or simple opacity)
- Scrollable text area (max-height with overflow-y-auto)
- Solvys Gold (#c79f4a) accent for active agent, muted for pending
- Background: dark (#0a0a0a or similar to match existing Consilium styling)
- No borders, no gradients (per project rules)

Layout: Each panel is a card in a CSS grid. Boardroom shows 2x2 grid for 4 agents, or 3-column for 3. Harper synthesis appears full-width below the grid.

### 4. `frontend/components/consilium/DAGProgressBar.tsx` (~80 lines)

Visual progress indicator for DAG execution waves.

Props:
```typescript
interface DAGProgressBarProps {
  currentWave: number;
  totalWaves: number;
  tasks: Array<{ id: string; agentId: string; status: string }>;
}
```

Renders:
- Horizontal bar showing waves as segments
- Each segment contains agent avatars/dots for tasks in that wave
- Color coding: pending (dim), running (Solvys Gold pulse), complete (solid gold), error (red)
- Wave labels: "Analysis" (wave 0), "Deliberation" (wave 1), "Synthesis" (wave 2)
- Compact — sits above the agent panels, not dominating the view
- No gradient fills. Solid colors only.

## Files to Modify

### 5. `frontend/components/consilium/AgentChattr.tsx`

Replace polling-based message display with live DAG panels.

Changes:
- Import `useBoardroomDAG` hook
- When user sends a message in Boardroom:
  - Call `dispatch(message)` instead of existing fetch-based approach
  - Remove the 30s `setInterval` polling for `/api/boardroom/messages`
- Render `BoardroomAgentPanel` for each agent in `agentOutputs`
- Render `DAGProgressBar` above the panels
- When DAG is not running: show normal chat input
- When DAG is running: show progress + live panels, disable input until complete
- Keep "All Agents" filter working: when selected, all panels visible. When single agent selected, only that panel expanded.

### 6. `frontend/components/consilium/ConsiliumHub.tsx`

Integrate DAG components into the hub layout.

Changes:
- Import DAGProgressBar
- Add a "Boardroom Mode" indicator when a DAG is running
- Pass DAG state down to AgentChattr (or let AgentChattr manage its own state via hook)

### 7. `frontend/contexts/NarrativeContext.tsx`

Subscribe to `surface.narrative` SSE for auto-push catalyst cards.

Changes:
- Add SSE subscription using `useAgentBusSSE<NarrativePushEvent>`
- Endpoint: `GET /api/dag/surface/narrative` (or similar — check what T2/T3 exposes)
- On `catalyst-discovered` event:
  1. Convert NarrativePushEvent.catalyst to CatalystCard shape
  2. Dispatch to narrative store: `dispatch({ type: 'ADD_CATALYST', catalyst })`
  3. The card appears in NarrativeFlow automatically
- Only subscribe when NarrativeFlow is mounted/visible
- Handle reconnection gracefully

### 8. `frontend/components/chat/ChatSidebar.tsx`

Subscribe to `surface.sidebar` SSE for cross-agent notifications.

Changes:
- Add SSE subscription using `useAgentBusSSE<SidebarNotifyEvent>`
- Endpoint: `GET /api/dag/surface/sidebar` (or similar)
- On `agent-finding` event:
  1. Show a toast notification: "[Agent] discovered: [summary]"
  2. Toast should be dismissible, auto-fade after 8s
  3. Style: dark background, Solvys Gold accent, agent name in gold
- Only show notifications from agents the user isn't currently chatting with (avoid redundancy)

## Verification

1. `bun run build` — Frontend builds without errors
2. `npx tsc --noEmit` — No type errors (check frontend tsconfig)
3. Visual check: Open Boardroom, send a message → see DAG progress bar + agent panels streaming
4. Visual check: Agent panels show 2x2 grid with streaming text
5. Visual check: Harper synthesis appears below panels after agents complete
6. NarrativeFlow: Trigger a DAG where Herald discovers news → verify card auto-appears
7. Sidebar: While in sidebar chat, trigger a Boardroom DAG → verify toast notification appears

## Changelog Entry

```typescript
{ date: '2026-04-05T__:__:__', agent: 'claude-code', summary: 'S8-T4: Boardroom live agent panels (2x2 grid), DAG progress bar, SSE subscription hooks, NarrativeFlow auto-push catalyst cards, Sidebar cross-agent notification toasts', files: ['frontend/hooks/useAgentBusSSE.ts', 'frontend/hooks/useBoardroomDAG.ts', 'frontend/components/consilium/BoardroomAgentPanel.tsx', 'frontend/components/consilium/DAGProgressBar.tsx', 'frontend/components/consilium/AgentChattr.tsx', 'frontend/components/consilium/ConsiliumHub.tsx', 'frontend/contexts/NarrativeContext.tsx', 'frontend/components/chat/ChatSidebar.tsx'] }
```

## DO NOT

- Do NOT modify any backend files. This is a frontend-only track.
- Do NOT modify the AgentBus, DAG scheduler, or MiroShark template. Those are T1/T2/T3.
- Do NOT use gradients or colored emojis in any UI (project rule).
- Do NOT use per-agent color variations. All agent accents use Solvys Gold (#c79f4a) per `feedback_agent_colors_unified.md`.
- Do NOT add Kanban borders to panels (project rule).
- Do NOT use `useMessage()` or `MessagePrimitive.Parts` from assistant-ui (per `feedback_assistant_ui_bypass.md`).
- Do NOT create mock/dummy backend endpoints. Code against the real SSE shapes and let unification wire to live endpoints.
- Do NOT remove existing Boardroom functionality. Keep the legacy polling as a fallback until DAG dispatch is verified working.
