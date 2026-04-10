# T2: Chat Icons — Restore to Consilium Toolbar Row

## Objective

Restore the chat utility icons (scribe/report, run MDB, new chat, history) and position them right-justified in the same row as the Consilium tab bar. Currently these icons exist in `ChatHeader.tsx` but are rendered INSIDE the chat area. They should move to the Consilium toolbar.

## Architecture

### Key Files

- `frontend/components/chat/ChatHeader.tsx` — Current chat toolbar (3 buttons: Run MDB, New Chat, Sessions)
- `frontend/components/consilium/ConsiliumHub.tsx` — Main Consilium layout with tab bar (Sanctum dropdown, Chat button, Boardroom dropdown, Apparatus dropdown)
- `frontend/components/ChatInterface.tsx` — Chat interface that uses ChatHeader
- `frontend/components/chat/SessionsModal.tsx` — Full-screen history modal (302 lines)

### Current ConsiliumHub Toolbar (lines 343-515)

The toolbar renders:

1. Sanctum dropdown (with Timeline, NarrativeFlow, Aquarium sub-views)
2. Chat button (direct — no dropdown)
3. Boardroom dropdown (Forum, Imperium, Agentic Chatroom, Research)
4. Apparatus dropdown (Desk, Fileroom)

These are LEFT-justified. The chat icons should go RIGHT-justified in the same row.

### Current ChatHeader (lines 12-43)

Three buttons with Lucide icons:

- `Scroll` icon → "Run MDB" → sends "Run the MDB report"
- `Plus` icon → "New Chat" → creates new conversation
- `Clock` icon → "Sessions" → toggles SessionsModal

## Requirements

### Icons to Restore (right-justified in Consilium bar, only visible when Chat tab is active)

1. **Scribe icon** (Scroll/PenTool) — Runs a report (currently "Run MDB")
2. **New Chat** (Plus) — Starts fresh conversation
3. **History** (Clock) — Opens history panel (NOT the full-screen modal — see T4 for the dropdown version)

### Positioning

- Same row as Consilium tabs (Sanctum, Chat, Boardroom, Apparatus)
- RIGHT-justified (flex with `ml-auto` or similar)
- Only show when the Chat tab is active (don't clutter other views)
- Keep them minimal — small icons with hover tooltips, matching Consilium bar style

### Style

- Icon size: match Consilium tab icons (w-3.5 h-3.5 or similar)
- Color: `text-zinc-500 hover:text-[#c79f4a]` (Solvys Gold on hover)
- No backgrounds/borders — inline with the toolbar aesthetic
- Gap between icons: `gap-1` or `gap-1.5`

## Implementation Plan

### Step 1: Move Icon Actions Up to ConsiliumHub

ConsiliumHub needs access to chat actions (new chat, run MDB, toggle history). These currently live in ChatInterface. Either:

- Lift the callbacks up via props/context
- Or use a lightweight event emitter / zustand store

### Step 2: Add Right Section to Consilium Toolbar

In ConsiliumHub's toolbar div, add a right-justified section:

```tsx
{
  /* Right-justified chat tools — only when chat is active */
}
{
  activeTab === "chat" && (
    <div className="ml-auto flex items-center gap-1.5">
      <button title="Run Report">
        <Scroll className="w-3.5 h-3.5" />
      </button>
      <button title="New Chat">
        <Plus className="w-3.5 h-3.5" />
      </button>
      <button title="History">
        <Clock className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

### Step 3: Remove ChatHeader or Reduce It

Once icons move to Consilium bar, ChatHeader becomes redundant. Either remove it or reduce it to just show the active persona/model indicator.

## Constraints

- Frontend only — no backend changes needed
- `bun run build` or `npx vite build` from `frontend/` to verify
- Add changelog entry to `src/lib/changelog.ts`
- Solvys Gold: #c79f4a, BG: #050402, Text: #f0ead6
- No gradients, no colored emojis
