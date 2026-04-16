# Sprint Brief: S19-T3 -- Conversation Persistence

## Context

Mobile chat sessions are stored in local React state — they vanish on refresh or app restart. The backend already has a full conversation store (`ai_conversations` + `ai_messages` tables in Supabase) with CRUD endpoints at `/api/ai/conversations`. This track wires mobile to that existing API, adding searchable session history. Independent of T1 and T2 — can run in parallel.

## Branch Target

`t3-conversation-persistence` (branched from `mobile-agent-upgrade`)

## Scope -- Included

- [ ] `mobile/hooks/useConversations.ts` (NEW) — API-backed session CRUD + keyword search
- [ ] `mobile/components/chat/SessionList.tsx` — replace local state with API-backed sessions, add search bar

## Scope -- Excluded (DO NOT TOUCH)

- `backend-hono/` — all backend files belong to T1
- `mobile/components/chat/ChatInput.tsx` — belongs to T2
- `mobile/components/chat/ChatPage.tsx` — belongs to T2 (T3 only touches SessionList)
- `mobile/components/chat/ToolApprovalCard.tsx` — belongs to T2
- `mobile/components/chat/ImageAttachButton.tsx` — belongs to T2
- `mobile/contexts/` — read-only dependency, not modified

## Known Issues to Preserve

- SessionList currently uses `BottomSheet` from `../shared/BottomSheet` — keep this pattern
- Sessions have a `ChatSession` type defined in SessionList.tsx — this will be replaced with the API type
- ChatPage owns `messages`, `conversationId`, `sessions`, `activeSessionId` state — T3 only changes SessionList's data source, the parent state wiring will be handled in unification

## Implementation Steps

### 1. Investigate existing conversation API

Before writing code, verify the conversation API shape. Check these files:

- `backend-hono/src/routes/ai/conversations.ts` (or similar) for exact endpoint signatures
- `backend-hono/src/services/conversation-store.ts` (or similar) for the DB schema

The expected endpoints:

- `GET /api/ai/conversations` — list conversations (with pagination)
- `GET /api/ai/conversations/:id` — get single conversation with messages
- `POST /api/ai/conversations` — create conversation
- `DELETE /api/ai/conversations/:id` — delete conversation

### 2. useConversations hook (~100 lines)

**New file:** `mobile/hooks/useConversations.ts`

```typescript
interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface ConversationDetail {
  id: string;
  title: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }>;
}

interface UseConversationsReturn {
  sessions: ConversationSummary[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  loadSession: (id: string) => Promise<ConversationDetail | null>;
  refresh: () => Promise<void>;
}
```

- Uses `getMobileBackend()` from `../lib/backend` for authenticated API calls
- On mount: fetch 10 most recent conversations
- Search: debounced (300ms) keyword search via `useRef` timer — calls API with `?q=<query>` param
- When query is cleared, re-fetch recent sessions
- `loadSession(id)`: fetches full conversation with messages from `GET /api/ai/conversations/:id`
- `refresh()`: re-fetches the current view (recent or search results)
- Handle errors gracefully — if API fails, show empty state with retry

### 3. Upgrade SessionList (~120 lines)

**File:** `mobile/components/chat/SessionList.tsx`

Current state: receives `sessions: ChatSession[]` from parent, renders in BottomSheet with new session button.

Changes:

- Remove `sessions` and `activeSessionId` from props — SessionList now owns its data via `useConversations`
- Add search bar at the top of the BottomSheet content:

  ```
  [Search icon] [input: "Search conversations..."]
  ```

  - Inline styled, `var(--font-data)`, `var(--border-visible)` border
  - Debounced search triggers API call via hook

- Session rows show: title (truncated), relative timestamp (e.g. "2h ago", "Yesterday"), message count badge
- Loading state: `SegmentedSpinner` centered in list area
- Empty state: "[NO CONVERSATIONS]" in Nothing style
- Search empty state: "[NO MATCHES]"
- New session button remains at bottom
- On select: call `loadSession(id)` from hook, then call `onSelect(conversationDetail)` prop to parent
- Updated props interface:
  ```typescript
  interface SessionListProps {
    open: boolean;
    onClose: () => void;
    onSelect: (conversation: ConversationDetail) => void;
    onNewSession: () => void;
    activeSessionId: string | null;
  }
  ```

### 4. Relative time formatter

Add a small inline helper in SessionList (not a separate file):

```typescript
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
```

## Acceptance Criteria

- [ ] Opening session list fetches 10 most recent conversations from API
- [ ] Search bar filters conversations by keyword with 300ms debounce
- [ ] Selecting a session loads full message history and populates chat
- [ ] New session button clears messages and starts fresh
- [ ] Loading state shows spinner, empty state shows Nothing-styled message
- [ ] Sessions persist across app refreshes (data comes from Supabase, not local state)
- [ ] Relative timestamps display correctly (minutes, hours, days)

## Validation Commands

```bash
npx tsc --noEmit --project mobile/tsconfig.json
cd mobile && npx vite build
```

## Commit Format

```
feat: T3 conversation persistence — API-backed sessions + search
```
