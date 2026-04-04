# T4: History Panel — Dropdown Under Icon (Not Full-Screen Modal)

## Objective
Replace the full-screen `SessionsModal` with a compact dropdown that appears under the history icon when chat is open in MainContent (ConsiliumHub). The current modal at z-[100] with fixed positioning blocks the entire screen. It should be a positioned dropdown, slightly smaller than current, anchored under the history button.

## Architecture

### Key Files
- `frontend/components/chat/SessionsModal.tsx` — Current full-screen modal (302 lines, z-[100], fixed inset-0)
- `frontend/components/chat/SessionsPanel.tsx` — Alternate sidebar panel (221 lines) — this is closer to what we want
- `frontend/components/chat/ChatHeader.tsx` — Has the Clock icon that triggers the modal
- `frontend/components/ChatInterface.tsx` — Parent that manages `showSessions` state

### Current SessionsModal Issues
- `position: fixed; inset: 0; z-index: 100` — blocks entire screen
- `backdrop-blur-sm` — full-screen backdrop
- Max-width 520px, max-height 70vh — centered in screen
- Has keyboard navigation (arrow keys, Enter, Escape)

### SessionsPanel (Better Starting Point)
- Already a sidebar-style panel, not a modal
- Has session list grouped by date
- Preview text per session
- Delete on hover
- Footer with reset info

## Requirements

### Dropdown Behavior
- Appears UNDER the history icon in the Consilium toolbar (from T2) or ChatHeader
- Positioned via absolute/fixed positioning anchored to the button
- Size: ~280px wide, max ~350px tall with scroll
- Closes on: click outside, Escape key, clicking a session
- No full-screen backdrop — just the dropdown with a subtle shadow
- Should not block interaction with the rest of the app

### Content
- Search box at top (compact — single line, small)
- Session list grouped by date (Today, Yesterday, This Week, Older)
- Each session shows: title (truncated), time, preview snippet
- Hover shows delete button (X)
- Click loads the session and closes dropdown
- Footer: "Sessions reset daily at 6PM ET"

### Style
- Background: `#0a0a08` or `bg-zinc-900/95`
- Border: `border border-zinc-800`
- Shadow: `shadow-xl shadow-black/50`
- Text: zinc-400 for labels, zinc-200 for titles
- Active/hover: Solvys Gold (#c79f4a)
- Rounded: `rounded-lg`
- Font size: 11-12px for items, 10px for labels

## Implementation Plan

### Step 1: Create SessionsDropdown Component
New file `frontend/components/chat/SessionsDropdown.tsx`. Base it on SessionsPanel (221 lines) but convert from sidebar to dropdown:
- Remove full-height flex layout
- Add absolute positioning
- Add click-outside handler (useEffect with document click listener)
- Add Escape key handler
- Keep session data fetching and grouping logic

### Step 2: Position Anchoring
The dropdown needs a ref to the trigger button for positioning:
```tsx
// In parent (ConsiliumHub or ChatHeader)
const historyBtnRef = useRef<HTMLButtonElement>(null);
const [showHistory, setShowHistory] = useState(false);

<button ref={historyBtnRef} onClick={() => setShowHistory(!showHistory)}>
  <Clock />
</button>
{showHistory && (
  <SessionsDropdown
    anchorRef={historyBtnRef}
    onClose={() => setShowHistory(false)}
    onSelectSession={(id) => { loadSession(id); setShowHistory(false); }}
  />
)}
```

### Step 3: Remove SessionsModal Usage
In ChatInterface.tsx and ChatPanel.tsx, replace SessionsModal references with the new SessionsDropdown. Keep SessionsModal file for now (don't delete — may be useful for mobile/tablet later).

## Data Source
Sessions come from the conversation store. Check:
- `frontend/hooks/usePersistentHermesConversation.ts`
- `frontend/components/chat/SessionsModal.tsx` lines for how it fetches sessions
- Backend: `backend-hono/src/services/ai/conversation-store.ts` — `listConversations()`

## Constraints
- Frontend only
- `npx vite build` from `frontend/` to verify
- Add changelog entry to `src/lib/changelog.ts`
- Solvys palette: BG #050402, Accent #c79f4a, Text #f0ead6
- No gradients, no colored emojis
- Keep it minimal — this is a utility dropdown, not a feature showcase
