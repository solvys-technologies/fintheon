# S13-T2: Team Presence + Panel

**Sprint:** S13 — Teams, LiveKit, Agentic Desk
**Track:** T2 (parallel with T3, after T1)
**Repo:** solvys-technologies/fintheon (branch: s13-teams-livekit)

---

## Context

Build the Team presence system using Supabase Realtime Presence and a slide-up Team panel in the footer toolbar. Each user card shows: device nametag, online status light, Twitter CLI polling badge, and CAO agent online status. The panel pops up from the footer, same pattern as the Changelog tab in FooterToolbar.

---

## Files to Read First

- `frontend/types/team.ts` — shared types (created by T1): DeviceStatus, TeamMember, PresencePayload
- `frontend/components/layout/FooterToolbar.tsx` — the existing slide-up panel with Terminal + Changelog + Errors tabs. This is where the Team tab gets added.
- `frontend/lib/supabase.ts` — Supabase client singleton
- `frontend/contexts/AuthContext.tsx` — user session, userId
- `frontend/hooks/useSourceStatus.ts` — has `twitterCli` boolean from `/api/riskflow/sources`
- `frontend/components/ui/StatusIndicator.tsx` — reusable status dot component
- `frontend/components/TraderNametag.tsx` — existing nametag style reference
- `frontend/contexts/GatewayContext.tsx` — gateway status (for CAO online detection)
- `frontend/contexts/SettingsContext.tsx` — has traderName setting

---

## Files to Create

### 1. `frontend/contexts/TeamPresenceContext.tsx` (~120 lines)

Supabase Realtime Presence provider that:
- Connects to a Supabase Realtime channel named `team-presence`
- Tracks current user's presence (publishs their state)
- Subscribes to all other users' presence
- Provides `teamMembers: TeamMember[]` and `isConnected: boolean`

```typescript
// Key implementation points:
// 1. Use supabase.channel('team-presence') with .on('presence', { event: 'sync' }, callback)
// 2. On mount, track the current user with channel.track(presencePayload)
// 3. The presencePayload comes from: AuthContext (userId), SettingsContext (traderName), 
//    useSourceStatus (twitterCli), GatewayContext (hermesStatus for CAO online), 
//    and the active agent name for caoName
// 4. Update track() whenever any of these values change
// 5. On presence sync, map presenceState to TeamMember[] array
// 6. Handle the case where supabase client is null (not configured)
// 7. Cleanup: untrack + unsubscribe on unmount
```

Export: `TeamPresenceProvider`, `useTeamPresence()`

### 2. `frontend/hooks/useTeamPresence.ts` (~40 lines)

Thin wrapper hook (if not inlined in context). Actually, inline the hook in the context file — one fewer file. The context itself exports `useTeamPresence`.

### 3. `frontend/components/team/TeamPanel.tsx` (~150 lines)

The Team tab content that renders inside the FooterToolbar slide-up panel. Shows:
- Header: "Team" with a user count badge
- Grid/list of UserCard components for each online team member
- Empty state if no other users online: "No other team members online"
- Current user's own card at the top with "(You)" label

### 4. `frontend/components/team/UserCard.tsx` (~100 lines)

Individual user presence card showing:
- **Status light** (green dot = online, gray = offline) — use StatusIndicator pattern
- **Device Nametag** — the user's chosen name from settings, styled like TraderNametag
- **Twitter CLI status** — if polling, show "(polling)" text in small gold text next to the status light
- **CAO status** — small badge showing CAO name + online/offline dot. If CAO is online, show "CAO: [name] ●" in green. If offline, gray.
- **In-call indicator** — if user is in a LiveKit room, show a phone icon or "In Call" badge (this will be wired by T4)

Visual style: Match the existing Fintheon dark theme — `bg-[#0b0b08]`, `border-[var(--fintheon-accent)]/15`, gold accents, monospace labels.

---

## Files to Modify

### `frontend/components/layout/FooterToolbar.tsx`

1. Add `'team'` to the `PanelTab` type:
   ```typescript
   type PanelTab = 'terminal' | 'changelog' | 'errors' | 'team';
   ```

2. Add a Team tab button in the tab bar (after Errors, before the panel toggle):
   ```tsx
   <button onClick={() => openTab('team')} className={...}>
     <Users size={12} />
     Team
   </button>
   ```

3. Add the Team panel content inside the panel body:
   ```tsx
   {activeTab === 'team' && <TeamPanel />}
   ```

4. Import `Users` from lucide-react (already imported in other files)
5. Import `TeamPanel` from `../team/TeamPanel`

### `frontend/App.tsx` (or wherever providers are mounted)

Wrap the app with `<TeamPresenceProvider>`. Find where other providers (AuthProvider, VoiceProvider, etc.) are composed and add TeamPresenceProvider inside them (it depends on AuthContext, SettingsContext, and GatewayContext).

Read the actual provider tree in the app entry to find the right insertion point.

---

## Key Implementation Details

### Supabase Presence Channel Setup
```typescript
const channel = supabase.channel('team-presence', {
  config: { presence: { key: userId } },
});

channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    // Convert to TeamMember[]
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track(payload);
    }
  });
```

### Presence Payload Construction
```typescript
const payload: PresencePayload = {
  userId,
  displayName: traderName || 'Anonymous',
  caoName: agents.find(a => a.id === 'harper-opus')?.name || 'Harper-Opus',
  caoOnline: hermesStatus === 'verified' || gatewayStatus === 'connected',
  twitterCliPolling: sourceStatus.twitterCli,
  inCall: false, // T3/T4 will wire this
};
```

---

## Verification

1. Team tab appears in footer toolbar slide-up panel
2. Current user's card shows in the Team panel with correct nametag
3. Opening the app in two browser tabs shows both "users" (same userId but proves presence works)
4. Twitter CLI polling status reflects the `/api/riskflow/sources` response
5. `npx tsc --noEmit` passes
6. No new files exceed 200 lines

---

## DO NOT
- Do NOT build LiveKit call features — that's T3
- Do NOT modify AgenticDesk or any rename files — that's T1
- Do NOT write backend routes — that's T3
- Do NOT touch the TopHeader — T3 handles call button placement
- Use `gh` CLI with `api_credentials=["github"]` for all git operations

## Commit Message
```
feat(s13-t2): team presence panel — supabase realtime, footer tab, user cards

- TeamPresenceContext with Supabase Realtime Presence channel
- TeamPanel slide-up tab in FooterToolbar
- UserCard with status light, Twitter CLI polling badge, CAO status
- Wired into provider tree

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
