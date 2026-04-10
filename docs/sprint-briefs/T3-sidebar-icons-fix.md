# T3: Sidebar Chat Icons — Fix Navigation Targets

## Objective

Fix the 4 sidebar icons in the floating chat panel (`ChatPanel.tsx`). Currently icons 1-3 all navigate to the same 'analysis' tab. Each should navigate to a distinct destination. Icon 4 opens a full-screen modal — it should open a small dropdown instead.

## Architecture

### Key File

- `frontend/components/layout/ChatPanel.tsx` — Floating chat sidebar with 4 icon buttons (lines 24-54)

### Current Code (Broken)

```tsx
// Line 32-54 — All three navigate to same 'analysis' tab
<button onClick={() => { onClose(); navigateTab('analysis'); }}> // MessageSquare — "Ask Harp (full)"
<button onClick={() => { onClose(); navigateTab('analysis'); }}> // Users — "Boardroom"
<button onClick={() => { onClose(); navigateTab('analysis'); }}> // Cpu — "Apparatus"
<button onClick={() => setShowSessions(true)}>                   // Clock — "Sessions" (opens modal)
```

### Navigation System

- `navigateTab('analysis')` navigates to the Consilium hub
- ConsiliumHub has sub-tabs: `'sanctum' | 'chat' | 'boardroom' | 'apparatus'`
- The sidebar needs to navigate to BOTH the analysis tab AND set the correct sub-tab

### ConsiliumHub Sub-Tab Control

Check how ConsiliumHub receives its initial sub-tab. Look for:

- URL params or state that sets `activeTab` in ConsiliumHub
- A global store or context that ConsiliumHub reads
- Props passed from the parent layout

## Requirements

### Icon 1: MessageSquare → Open Full Chat Interface

- Navigate to Consilium → Chat sub-tab
- Close the floating panel
- Implementation: `navigateTab('analysis')` + set ConsiliumHub activeTab to 'chat'

### Icon 2: Users → Open Forum (Boardroom)

- Navigate to Consilium → Boardroom sub-tab → Forum view
- Close the floating panel
- Implementation: `navigateTab('analysis')` + set ConsiliumHub activeTab to 'boardroom'

### Icon 3: Cpu → Open Apparatus/Desk

- Navigate to Consilium → Apparatus sub-tab → Desk view (NOT Fileroom)
- Close the floating panel
- Implementation: `navigateTab('analysis')` + set ConsiliumHub activeTab to 'apparatus'

### Icon 4: Clock → Mini Dropdown (NOT full-screen modal)

- Instead of `setShowSessions(true)` which opens `SessionsModal` (full-screen overlay)
- Show a small dropdown UNDER the clock icon
- Dropdown shows recent sessions (last 5-8)
- Click a session to load it
- Much smaller than the modal — roughly 250px wide, max 300px tall
- Positioned anchored to the icon (popover style)
- Close on click outside or Escape

## Implementation Plan

### Step 1: Add Sub-Tab Navigation

Find or create a mechanism to navigate to a specific Consilium sub-tab from outside ConsiliumHub. Options:

- Zustand store with `setConsiliumTab(tab: ConsiliumTab)`
- Or pass a `defaultTab` prop to ConsiliumHub that reads from URL/state
- Check existing state management patterns in the codebase

### Step 2: Fix Icons 1-3

Update ChatPanel.tsx click handlers to navigate to the correct sub-tab.

### Step 3: Create Mini Sessions Dropdown

Build a small popover component (NOT a modal) for icon 4:

- Use `position: absolute` anchored to the button
- Show recent sessions from the same data source as SessionsModal
- Styled consistently: dark bg (#0a0a08), gold accent (#c79f4a), zinc text
- No backdrop blur / overlay — just a dropdown that closes on outside click

## Constraints

- Frontend only
- `npx vite build` from `frontend/` to verify
- Add changelog entry to `src/lib/changelog.ts`
- Solvys palette: BG #050402, Accent #c79f4a, Text #f0ead6
- No full-screen modals for this — keep it minimal
