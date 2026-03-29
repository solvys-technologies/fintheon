# S8-T7 AMENDMENT: Ask Harp — Dual-Pane + Persona Switching

**Branch**: `v.8.28.1`
**Context**: T7 is 64% done. Backend, components, pulsing icon, QuickScope all work. Dual-pane and persona switching are missing.

## FILES TO READ
- `frontend/components/chat/AskHarpChatPanel.tsx` — current single-pane
- `frontend/components/chat/FintheonThread.tsx` — message rendering
- `frontend/components/chat/FintheonComposer.tsx` — input with PromptBox
- `frontend/components/chat/PersonaDropdown.tsx` — persona switching UI
- `frontend/components/consilium/ConsiliumHub.tsx` — tab routing, where Ask Harp renders as main content
- `frontend/components/layout/MainLayout.tsx` (~line 752-755) — sidebar Ask Harp

## GAPS

### 1. Main Ask Harp: Dual-Pane Layout (NOT DONE)
When AskHarpChatPanel renders as MAIN CONTENT (inside ConsiliumHub, NOT sidebar):
- **Left pane**: Conversation (FintheonThread + FintheonComposer) — already works
- **Right pane**: Artifacts + tool calls — NOT implemented

Implementation:
1. In `AskHarpChatPanel.tsx`, detect if rendering as main vs sidebar:
   - Add a `layout?: 'main' | 'sidebar'` prop (default 'sidebar')
   - ConsiliumHub passes `layout="main"` when rendering in the analysis tab
   - MainLayout sidebar passes `layout="sidebar"` (or omits, using default)

2. When `layout === 'main'`:
   ```tsx
   <div className="flex h-full">
     <div className="flex-1 flex flex-col min-w-0">
       {/* Left: conversation */}
       <FintheonThread ... />
       <FintheonComposer ... />
     </div>
     <div className="w-80 border-l border-[var(--fintheon-accent)]/15 overflow-y-auto">
       {/* Right: artifacts + tool calls */}
       {lastRequestId && <CognitionPanel ... />}
       {/* Artifact cards from conversation */}
     </div>
   </div>
   ```

3. When `layout === 'sidebar'`: keep current single-pane with inline CognitionPanel

### 2. Persona Switching (PARTIAL — infrastructure exists, not wired)
PersonaDropdown already renders in FintheonComposer. But switching persona doesn't actually change Claude's behavior.

Implementation:
1. In `FintheonComposer.tsx`, when persona changes via PersonaDropdown:
   - Store the active persona in state
   - Prepend a system-level instruction to the next message: `[PERSONA: Oracle — respond as Oracle, the All-Seer prediction analyst]`
   - When switching back to Harper-Opus: `[PERSONA: Harper-Opus — resume default CAO mode]`
2. Visual indicator: the PersonaDropdown already shows the active agent with colored dot — verify this works

### 3. Kill Kanban in Chat Messages (NOT VERIFIED)
Check `FintheonThread.tsx` for any bordered card containers around assistant messages.
- If `border-l-2` or card-like wrapping exists around message bubbles → remove
- Agent name + role as small header above response text (clean, borderless)

## VERIFICATION
1. Analysis tab → Ask Harp renders with conversation left, artifacts right
2. Sidebar Ask Harp → single-pane (unchanged)
3. Switch persona in dropdown → next message prefixed with persona instruction
4. No bordered containers around chat messages
5. `npx vite build` — clean

## DO NOT
- Do NOT modify harper-handler.ts (backend works)
- Do NOT modify 21st.dev components (they work)
- Do NOT touch Observatory or Aquarium
