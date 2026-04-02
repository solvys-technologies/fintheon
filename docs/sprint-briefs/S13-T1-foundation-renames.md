# S13-T1: Foundation + Renames

**Sprint:** S13 — Teams, LiveKit, Agentic Desk
**Track:** T1 (Foundation — runs first, all other tracks depend on this)
**Repo:** solvys-technologies/fintheon

---

## Context

This track handles all naming renames across the codebase, locks subanalyst cards to read-only, makes only the CAO (Harper-Opus) name editable, creates shared type files for T2/T3, and installs LiveKit packages.

---

## Files to Read First

- `frontend/components/settings/ClawnalystDesk.tsx` — current agent card editor (will be renamed + rewritten)
- `frontend/components/SettingsPanel.tsx` — imports ClawnalystDesk, tab definitions
- `frontend/components/chat/AskHarpSidebar.tsx` — will be renamed to ChatSidebar
- `frontend/components/layout/MainLayout.tsx` — imports AskHarpSidebar, has askHarpOpen state
- `frontend/components/layout/TopHeader.tsx` — askHarpOpen prop
- `frontend/components/consilium/ConsiliumHub.tsx` — "Ask Harp" tab label
- `frontend/components/ChatInterface.tsx` — surfaceId === 'askharp' check
- `frontend/components/narrative/NarrativeCanvasChat.tsx` — placeholder text
- `frontend/contexts/FintheonAgentContext.tsx` — agent type definitions, default roster
- `frontend/hooks/useSourceStatus.ts` — SourceStatus type (has twitterCli field)
- `package.json` — for adding LiveKit deps

---

## Task 1: File Renames

### Rename `ClawnalystDesk.tsx` → `AgenticDesk.tsx`
1. Create `frontend/components/settings/AgenticDesk.tsx` with the rewritten component (see Task 3)
2. Delete `frontend/components/settings/ClawnalystDesk.tsx`
3. Update import in `frontend/components/SettingsPanel.tsx`:
   - OLD: `import { ClawnalystDesk } from './settings/ClawnalystDesk';`
   - NEW: `import { AgenticDesk } from './settings/AgenticDesk';`
4. Update usage: `<ClawnalystDesk />` → `<AgenticDesk />`
5. Update tab label in SettingsPanel tabs array:
   - OLD: `{ id: 'desk' as const, label: 'Analyst Desk', icon: Users, description: 'Configure analyst personas and agent settings' }`
   - NEW: `{ id: 'desk' as const, label: 'Agentic Desk', icon: Users, description: 'Agent persona configuration and CAO naming' }`

### Rename `AskHarpSidebar.tsx` → `ChatSidebar.tsx`
1. Create `frontend/components/chat/ChatSidebar.tsx` with identical content but renamed exports:
   - `AskHarpInner` → `ChatSidebarInner`
   - `AskHarpSidebar` → `ChatSidebar`
2. Delete `frontend/components/chat/AskHarpSidebar.tsx`
3. Update import in `frontend/components/layout/MainLayout.tsx`:
   - OLD: `import { AskHarpSidebar } from '../chat/AskHarpSidebar';`
   - NEW: `import { ChatSidebar } from '../chat/ChatSidebar';`
4. In MainLayout, rename all `askHarp` state/props:
   - `showAskHarp` → `showChat`
   - `setShowAskHarp` → `setShowChat`
   - `askHarpOpen` → `chatOpen`
   - `onAskHarpToggle` → `onChatToggle`
   - Replace `<AskHarpSidebar />` with `<ChatSidebar />`
5. Update TopHeader.tsx props interface and destructuring:
   - `askHarpOpen` → `chatOpen`
   - `onAskHarpToggle` → `onChatToggle`
6. Update ConsiliumHub.tsx:
   - OLD: `{ id: 'chat', label: 'Ask Harp', icon: MessageSquare }`
   - NEW: `{ id: 'chat', label: 'Chat', icon: MessageSquare }`
7. Update ChatInterface.tsx:
   - `surfaceId === 'askharp'` → `surfaceId === 'chat'`
   - Also update the ConsiliumHub line: `<ChatInterface surfaceId="chat" />`
8. Update ChatSidebar.tsx (the new file) internally:
   - `useHermesRuntime(activeAgent?.id ?? 'default', thinkHarder, 'askharp')` → `useHermesRuntime(activeAgent?.id ?? 'default', thinkHarder, 'chat')`
9. Update NarrativeCanvasChat.tsx placeholder:
   - `"Ask Harper-Opus..."` → `"Message Harper-Opus..."`

**DO NOT** modify `src/lib/changelog.ts` — those are historical entries.
**DO NOT** modify `backend-hono/src/services/harper-handler.ts` — the comment is fine.

---

## Task 2: Create Shared Types

### Create `frontend/types/team.ts`
```typescript
// S13-T1: Team presence and device status types

export interface DeviceStatus {
  userId: string;
  displayName: string;       // User's chosen nametag from settings
  caoName: string;           // User's CAO name (renamed Harper-Opus)
  caoOnline: boolean;        // Whether their CAO agent is running
  twitterCliPolling: boolean; // Whether their Twitter CLI is actively polling
  online: boolean;           // Whether the user's app is open
  lastSeen: string;          // ISO timestamp
  inCall: boolean;           // Whether they're in a LiveKit voice room
}

export interface TeamMember {
  userId: string;
  displayName: string;
  caoName: string;
  presence: DeviceStatus;
}

export interface PresencePayload {
  userId: string;
  displayName: string;
  caoName: string;
  caoOnline: boolean;
  twitterCliPolling: boolean;
  inCall: boolean;
}
```

### Create `frontend/types/livekit.ts`
```typescript
// S13-T1: LiveKit room types for group voice calls

export interface LiveKitTokenRequest {
  roomName: string;
  participantName: string;
  participantIdentity: string;
}

export interface LiveKitTokenResponse {
  token: string;
  url: string;
}

export type CallState = 'idle' | 'connecting' | 'connected' | 'disconnecting' | 'error';

export interface CallParticipant {
  identity: string;
  displayName: string;
  isMuted: boolean;
  isSpeaking: boolean;
}
```

---

## Task 3: Rewrite AgenticDesk (Read-Only Subanalysts, Editable CAO)

The new `frontend/components/settings/AgenticDesk.tsx` must:

1. **Remove** the "Save All" button, "Add New Analyst" button, "New Analyst" popup, and the entire draft/edit system
2. **Remove** the footer CTA ("Add more analysts to your desk")
3. **Harper-Opus card (CAO):** Show an elevated lead card with ONLY the name field editable. No nickname, description, sector, or instructions_doc_id editing. The description should show the agent's dossier text (hardcoded from the roster). Show a save button only on the CAO card.
4. **Subanalyst cards (Oracle, Feucht, Consul, Herald):** Fully read-only. Display name, sector, icon, and a dossier description. No input fields at all. No delete button.
5. **Agent dossiers** (use these as the description text):
   - Harper-Opus: "Chief Analyst Officer — executive strategy, oversight, and final trade authorization"
   - Oracle: "All-Seer — prediction markets, macro reads, and cross-desk intelligence fusion"
   - Feucht: "Futures & Risk — IV/volatility surface, risk parameters, and scheduled execution"
   - Consul: "Fundamentals — mega-cap analysis, earnings, and sector rotation"
   - Herald: "News & Sentiment — breaking headlines, social signals, and sentiment scoring"
6. Keep the existing card visual style (border, bg, icon, sector pill) but make everything display-only except the CAO name field
7. The CAO name change must call `updateAgent(agent.id, { name: newName })` which is already wired in FintheonAgentContext
8. Export the component as `AgenticDesk`
9. Keep the component under 200 lines

---

## Task 4: Install LiveKit Packages

Run in the project root:
```bash
cd /home/user/workspace/fintheon
# Frontend packages
bun add livekit-client @livekit/components-react @livekit/components-styles

# Backend package (in backend-hono)
cd backend-hono && bun add livekit-server-sdk && cd ..
```

---

## Task 5: Create branch and commit

```bash
cd /home/user/workspace/fintheon
git checkout -b s13-teams-livekit
git add -A
git commit -m "feat(s13-t1): foundation — renames, types, agentic desk lockdown, livekit packages

- Rename ClawnalystDesk → AgenticDesk, AskHarpSidebar → ChatSidebar
- Replace 'Ask Harp' → 'Chat', 'Analyst Desk' → 'Agentic Desk' across UI
- Rename askHarpOpen/onAskHarpToggle → chatOpen/onChatToggle in MainLayout+TopHeader
- Lock subanalyst cards read-only, CAO name-only editable with dossier descriptions
- Create team.ts and livekit.ts shared type files
- Install livekit-client, @livekit/components-react, @livekit/components-styles, livekit-server-sdk

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push -u origin s13-teams-livekit
```

---

## Verification

1. `grep -rn "Clawnalyst\|ClawnalystDesk\|AskHarp\|askHarp\|Ask Harp" --include='*.ts' --include='*.tsx' frontend/ | grep -v changelog` should return **zero results**
2. `npx tsc --noEmit` should pass (or have only pre-existing errors)
3. The `AgenticDesk` component should export correctly
4. `frontend/types/team.ts` and `frontend/types/livekit.ts` should exist with proper exports
5. `livekit-client` should appear in package.json dependencies

---

## DO NOT
- Do NOT touch `src/lib/changelog.ts` — historical entries stay as-is
- Do NOT touch `backend-hono/src/services/harper-handler.ts` — comment is fine
- Do NOT create any UI components beyond the AgenticDesk rewrite and type files
- Do NOT write Team panel, presence, or LiveKit integration code — those are T2 and T3
- Use `gh` CLI with `api_credentials=["github"]` for all git operations
