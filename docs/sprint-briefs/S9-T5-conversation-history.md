# S9-T5: Conversation History + Take Note Memory Flush

**Sprint**: S9 — Fix Everything Right
**Track**: T5 (standalone, no dependencies)
**Branch**: `v.8.28.1`

## Context
The "Sessions" panel in Ask Harp still uses the old localStorage-based checkpoint system (`chatCheckpoints.ts`). It should show real conversation history from the backend (`/api/ai/conversations`). The "Checkpoint" hover button on agent responses needs to become "Take Note" — which flushes the highlighted text into Harper-Opus's unified memory bank via the Context Bank API.

## Design Direction
- Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6
- No gradients, no colored emojis
- Sessions panel matches the existing sidebar aesthetic (dark surface, gold accents)

---

## FILES TO READ FIRST
- `frontend/components/ChatInterface.tsx` (236 lines) — current checkpoint sidebar (lines 168-230)
- `frontend/components/chat/ChatHeader.tsx` — header with Sessions icon button
- `frontend/components/chat/FintheonThread.tsx` (581 lines) — message rendering, checkpoint hover button
- `frontend/components/chat/ChatMessageBubble.tsx` — older message renderer with checkpoint button
- `frontend/lib/chatCheckpoints.ts` — old localStorage checkpoint system (TO BE REPLACED)
- `frontend/lib/services.ts` (lines 395-407) — `listConversations()`, `getConversation()` already exist
- `frontend/hooks/usePersistentHermesConversation.ts` — persists conversationId in localStorage
- `backend-hono/src/routes/context-bank/index.ts` — Context Bank API routes
- `backend-hono/src/services/agent-context-bank-service.ts` — memory storage service

---

## IMPLEMENTATION

### 1. Replace Checkpoint Sidebar with Conversation List (ChatInterface.tsx)

**Remove**:
- `import { addCheckpoint, deleteCheckpoint, listCheckpoints, type ChatCheckpoint } from '../lib/chatCheckpoints'`
- `showCheckpoints` / `setShowCheckpoints` state (rename to `showSessions` / `setShowSessions`)
- `checkpointVersion` state
- `checkpointItems` useMemo
- `groupCheckpointsByDate` function
- The entire checkpoint sidebar panel content (lines 168-230)

**Add**:
- State: `const [sessions, setSessions] = useState<ConversationSummary[]>([])`
- State: `const [sessionsLoading, setSessionsLoading] = useState(false)`
- Fetch conversations when panel opens:
```typescript
useEffect(() => {
  if (!showSessions) return;
  setSessionsLoading(true);
  fetch(`${API_BASE}/api/ai/conversations`)
    .then(r => r.json())
    .then(data => setSessions(data.conversations ?? []))
    .catch(() => setSessions([]))
    .finally(() => setSessionsLoading(false));
}, [showSessions]);
```

**Type** (inline or in types.ts):
```typescript
interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  model?: string;
  isArchived: boolean;
}
```

**Render the Sessions panel**:
```tsx
{/* Sessions panel — right side */}
{showSessions && (
  <div className="flex-shrink-0 w-80 border-l border-[var(--fintheon-accent)]/20 overflow-hidden">
    <div className="w-80 h-full flex flex-col bg-[var(--fintheon-surface)]">
      {/* Header */}
      <div className="h-12 border-b border-[var(--fintheon-accent)]/15 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <h2 className="text-sm font-semibold text-[var(--fintheon-accent)] tracking-wide">Sessions</h2>
        </div>
        <button onClick={() => setShowSessions(false)} className="p-1.5 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors">
          <X className="w-4 h-4 text-[var(--fintheon-accent)]/70" />
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {sessionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--fintheon-accent)]/40" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-zinc-600 text-[11px] py-8 px-4">
            No sessions yet. Start a conversation.
          </div>
        ) : (
          sessions.map(session => (
            <button
              key={session.id}
              onClick={() => {
                // Load this conversation
                setConversationId(session.id);
                setShowSessions(false);
              }}
              className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-[var(--fintheon-accent)]/5 transition-colors ${
                conversationId === session.id ? 'bg-[var(--fintheon-accent)]/10' : ''
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-[var(--fintheon-text)] font-medium truncate">
                  {session.title}
                </span>
                <span className="text-[9px] text-zinc-600 shrink-0 tabular-nums">
                  {new Date(session.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-zinc-600">{session.messageCount} messages</span>
                {session.model && (
                  <span className="text-[8px] text-[var(--fintheon-accent)]/40 font-mono">{session.model}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/5 text-[9px] text-zinc-600 text-center">
        {sessions.length} session{sessions.length !== 1 ? 's' : ''}
      </div>
    </div>
  </div>
)}
```

### 2. Wire Conversation Loading

When user clicks a session in the list:
- Set `conversationId` via the persistent hook — this triggers hydration in `useHermesChat.ts` (line 195-223) which already fetches messages from `/api/ai/conversations/{id}` and populates the thread.
- Close the Sessions panel.
- The `clearConversationId` function from `useHermesRuntime` is passed through — wire the "New Chat" button in ChatHeader to call it.

In `ChatInterface.tsx`, ensure the `conversationId` and `setConversationId` are accessible:
```typescript
const { runtime, conversationId, clearConversationId, lastError, lastRequestId } = useHermesRuntime(...);
```
Pass `clearConversationId` to `ChatHeader`'s `onNewChat` prop. Pass `conversationId` and a `setConversationId` to the Sessions panel.

**Note**: `usePersistentHermesConversation` stores the active conversationId in localStorage keyed by `fintheon:hermes-conversation:{agentId}:{surfaceId}`. Loading a session sets this, so on next app open it resumes.

### 3. "Take Note" Button on Agent Responses (FintheonThread.tsx + ChatMessageBubble.tsx)

**Find the checkpoint hover button** in both files. Currently looks like:
```tsx
<button onClick={() => onCheckpoint(messageId, textContent)} title="Save checkpoint">
  <Bookmark size={10} />
</button>
```

**Replace with "Take Note"**:
```tsx
<button
  onClick={() => onTakeNote(messageId, textContent)}
  title="Take Note — save to Harper memory"
  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
>
  <Bookmark size={10} />
  <span className="text-[9px]">Note</span>
</button>
```

**Wire `onTakeNote` handler** (in ChatInterface.tsx or the inner component):
```typescript
const handleTakeNote = useCallback(async (messageId: string, content: string) => {
  try {
    await fetch(`${API_BASE}/api/context-bank/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'harper-opus',
        memoryType: 'observation',
        content: content.slice(0, 500), // Cap at 500 chars
        metadata: {
          source: 'take-note',
          messageId,
          conversationId,
          timestamp: new Date().toISOString(),
        },
      }),
    });
    // Visual feedback: brief gold flash or toast
  } catch (err) {
    console.error('[TakeNote] Failed to save:', err);
  }
}, [conversationId]);
```

### 4. Update Props Chain

The `onCheckpoint` prop flows through:
- `ChatInterface` → `FintheonThread` (via `onCheckpoint` prop)
- `ChatInterface` → `ChatMessageBubble` (older renderer)

Rename the prop to `onTakeNote` in all components. Update the types:
```typescript
// FintheonThread props
onCheckpoint?: (messageId: string, text: string) => void;
// becomes:
onTakeNote?: (messageId: string, text: string) => void;
```

### 5. Remove Old Checkpoint System

After wiring everything:
- Delete `frontend/lib/chatCheckpoints.ts` entirely
- Remove the `fintheon:chat-checkpoints:v1` key from `frontend/lib/data-migration.ts` (line 18)
- Remove the `pulse_chat_checkpoints:v1` key from `frontend/lib/storage-migration.ts` (line 28)
- Remove any remaining imports of `chatCheckpoints` across the codebase:
```bash
grep -rn "chatCheckpoints\|addCheckpoint\|deleteCheckpoint\|listCheckpoints" frontend/ --include="*.tsx" --include="*.ts"
```

---

## VERIFICATION

```bash
# 1. Build passes
npx vite build

# 2. No checkpoint references remain
grep -rn "checkpoint\|Checkpoint" frontend/components/ChatInterface.tsx
# Should return 0 results (or only "showCheckpoints" renamed to "showSessions")

# 3. Old checkpoint lib removed
ls frontend/lib/chatCheckpoints.ts
# Should not exist

# 4. Sessions endpoint works
curl -s localhost:8080/api/ai/conversations | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Sessions: {len(d.get(\"conversations\",[]))}')"

# 5. Take Note endpoint works
curl -s -X POST localhost:8080/api/context-bank/memories -H "Content-Type: application/json" -d '{"agentId":"harper-opus","memoryType":"observation","content":"Test note","metadata":{"source":"take-note"}}'
# Should return 200

# 6. Frontend: Open Ask Harp → click Sessions icon → see conversation list
# 7. Frontend: Click a session → messages load
# 8. Frontend: Hover agent response → see "Note" button → click → saves to context bank
```

## Changelog Entry
```typescript
{ date: '2026-03-30T03:00:00', agent: 'claude-code', summary: 'S9-T5: Replace checkpoint sidebar with real conversation history from /api/ai/conversations, Take Note button flushes to Harper memory bank via Context Bank API, delete chatCheckpoints.ts', files: ['frontend/components/ChatInterface.tsx', 'frontend/components/chat/ChatHeader.tsx', 'frontend/components/chat/FintheonThread.tsx', 'frontend/components/chat/ChatMessageBubble.tsx', 'frontend/lib/chatCheckpoints.ts (deleted)'] }
```

## DO NOT
- Do NOT modify the conversation store backend (it already works)
- Do NOT modify the Context Bank API (it already works)
- Do NOT change how useHermesChat hydrates messages (it already works)
- Do NOT modify the chat streaming or Harper handler
- Do NOT rename components (already done in T1)
- Do NOT touch RiskFlow, NarrativeMap, or IV scoring
