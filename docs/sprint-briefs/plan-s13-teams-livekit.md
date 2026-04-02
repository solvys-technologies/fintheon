# S13 Plan: Teams Panel, LiveKit Group Calls, Agentic Desk Rename

**Date:** 2026-04-02
**Trigger:** User wants group voice calling for human users, Team presence panel, and codebase-wide naming cleanup.

---

## Architecture Decisions (from interview)

1. **Agent rename lockdown:** Subanalysts (Oracle, Feucht, Consul, Herald) become fully read-only cards in settings. Only the CAO (Harper-Opus) name is user-editable. Name changes propagate everywhere.
2. **Naming renames:**
   - `Clawnalyst` → `Agentic` everywhere (ClawnalystDesk.tsx → AgenticDesk.tsx, all imports/references)
   - `Analyst Desk` → `Agentic Desk` in settings tab label
   - `Ask Harp` → `Chat` as the surface label in ConsiliumHub and all UI strings
   - `AskHarpSidebar.tsx` → `ChatSidebar.tsx` (file rename + all imports)
   - `askHarpOpen` prop → `chatOpen` in TopHeader/MainLayout
   - `surfaceId="askharp"` → `surfaceId="chat"`
3. **Presence:** Supabase Realtime Presence — always-on, shows device status + Twitter CLI polling status + CAO agent online status
4. **Team panel:** Popover triggered from footer toolbar (same slide-up pattern as Changelog), shows user cards with device nametag, status lights, polling indicator, CAO status
5. **LiveKit:** Full integration — packages, Hono token server route, React components, TopHeader call button
6. **Each user tracked by:** (human + their CAO) — two personas per device login. CAOs "congregate in the Boardroom."

---

## Current State

### Files to rename/modify:
- `frontend/components/settings/ClawnalystDesk.tsx` → `AgenticDesk.tsx`
- `frontend/components/SettingsPanel.tsx` — import + tab label + tab content
- `frontend/components/chat/AskHarpSidebar.tsx` → `ChatSidebar.tsx`
- `frontend/components/layout/MainLayout.tsx` — import AskHarpSidebar → ChatSidebar, askHarpOpen → chatOpen
- `frontend/components/layout/TopHeader.tsx` — askHarpOpen → chatOpen prop
- `frontend/components/consilium/ConsiliumHub.tsx` — "Ask Harp" → "Chat" label
- `frontend/components/ChatInterface.tsx` — surfaceId check
- `frontend/components/narrative/NarrativeCanvasChat.tsx` — placeholder text
- `src/lib/changelog.ts` — only old entries, leave as historical
- `backend-hono/src/services/harper-handler.ts` — comment only, leave

### Files to create:
- `frontend/types/team.ts` — TeamMember, PresenceState, DeviceStatus types
- `frontend/types/livekit.ts` — LiveKit room/call types
- `frontend/contexts/TeamPresenceContext.tsx` — Supabase Realtime Presence provider
- `frontend/components/team/TeamPanel.tsx` — slide-up popover from footer
- `frontend/components/team/UserCard.tsx` — individual user presence card
- `frontend/components/team/CallControls.tsx` — LiveKit join/leave/mute controls
- `frontend/hooks/useTeamPresence.ts` — Supabase presence hook
- `frontend/hooks/useLiveKitRoom.ts` — LiveKit room connection hook
- `backend-hono/src/routes/livekit/index.ts` — token generation route
- `backend-hono/src/routes/livekit/handlers.ts` — token generation handler
- `frontend/components/layout/FooterToolbar.tsx` — add Team tab to slide-up panel

### Packages to install:
- `livekit-client` — frontend SDK
- `@livekit/components-react` — React components
- `@livekit/components-styles` — default styles
- `livekit-server-sdk` — backend token generation

---

## Track Split (4 tracks)

### T1: Foundation + Renames (runs first)
- All file renames (ClawnalystDesk → AgenticDesk, AskHarpSidebar → ChatSidebar)
- All string renames (Clawnalyst → Agentic, Ask Harp → Chat, askHarpOpen → chatOpen)
- Lock subanalyst cards read-only, CAO name-only editable
- Add agent dossier in description field
- Create shared types: `frontend/types/team.ts`, `frontend/types/livekit.ts`
- Install LiveKit packages

### T2: Team Presence + Panel (after T1)
- `TeamPresenceContext.tsx` — Supabase Realtime Presence
- `useTeamPresence.ts` hook
- `TeamPanel.tsx` — slide-up from footer (new tab in FooterToolbar)
- `UserCard.tsx` — user card with status light, Twitter CLI polling badge, CAO status
- Wire into FooterToolbar as new tab

### T3: LiveKit Integration (after T1)
- `backend-hono/src/routes/livekit/` — token server
- `useLiveKitRoom.ts` hook
- `CallControls.tsx` — join/leave/mute UI
- Wire call button into TopHeader
- `RoomAudioRenderer` for playback

### T4: Unification + Polish (after T2+T3)
- Wire TeamPanel ↔ CallControls
- Type-check, build verify
- Ensure CAO name propagation works everywhere

---

## Git Strategy
- All tracks work on branch `s13-teams-livekit`
- T1 commits first (renames + types)
- T2/T3 commit in parallel
- T4 unification commit
- Squash merge to main

## Verification
- `npx tsc --noEmit` passes
- `bunx vite build` passes
- No references to "Clawnalyst", "Ask Harp", or "askHarp" remain (except changelog history)
- Settings → Agentic Desk shows read-only subanalyst cards, editable CAO name
- Team panel opens from footer with user presence
