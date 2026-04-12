# Task Brief: Replace Consilium Forum & Voice with Fluxer

**Date:** 2026-04-12
**Scope:** Embed Fluxer.app into Consilium's Imperium tab, replacing the BulletinFeed forum and LiveKit voice widget.
**Estimated files:** 8-10

## Context

Fluxer.app is an open-source Discord-like platform (text channels, voice/video via LiveKit under the hood, communities) with a REST API + WebSocket gateway. It already does everything our custom BulletinFeed and LiveKit voice widget do — but better, with persistent history, channels, reactions, threads, and voice rooms in one product. Rather than maintaining two separate custom implementations, we embed Fluxer as the unified comms layer inside the Consilium.

**Key insight:** Fluxer uses LiveKit internally for voice/video, so we're not losing audio quality — we're gaining a proper UI around it.

## Files to Read First

- `frontend/components/consilium/ConsiliumTabConfig.ts` — Tab/sub-view definitions; `BoardroomSubView` type includes `"forum"`
- `frontend/components/consilium/ConsiliumHub.tsx` — Lines 840-880; where `<BulletinFeed />` renders under `displayedBoardroomSub === "forum"`
- `frontend/components/bulletin/BulletinFeed.tsx` — Current forum implementation (325 lines, Supabase realtime, bulletin API)
- `frontend/components/peers/VoiceWidget.tsx` — Current LiveKit voice widget (482 lines, floating/header-docked modes)
- `frontend/hooks/useLiveKitRoom.ts` — LiveKit connection hook (175 lines)
- `frontend/components/layout/MainLayout.tsx` — Lines 208-238; VoiceWidget integration in layout
- `frontend/components/voice/CallButton.tsx` — Header call button (56 lines)

## What to Build/Change

### 1. FluxerEmbed component

- **Path:** `frontend/components/consilium/FluxerEmbed.tsx`
- **Action:** Create
- **Spec:**
  - Renders a full-height iframe pointing to the Fluxer community URL
  - Accept props: `channelPath?: string` (to deep-link into a specific channel like `/channels/forum` or `/channels/voice-lobby`)
  - URL pattern: `https://app.fluxer.app/{communitySlug}/{channelPath}` (make community slug configurable via env var `VITE_FLUXER_COMMUNITY_URL`)
  - Style: `w-full h-full border-0 bg-[var(--fintheon-bg)]`
  - Add a thin loading skeleton while iframe loads (listen to `onLoad`)
  - If `VITE_FLUXER_COMMUNITY_URL` is not set, show a centered "Fluxer not configured" placeholder with a link to fluxer.app
- **Max lines:** 80

### 2. Update ConsiliumTabConfig

- **Path:** `frontend/components/consilium/ConsiliumTabConfig.ts`
- **Action:** Modify
- **Spec:**
  - Rename the `"forum"` BoardroomSubView entry:
    - `id: "forum"` stays the same (avoid cascading renames)
    - `label: "Fluxer"` (was "Agent Forum")
    - `subtitle: "Community hub & voice"` (was "Team bulletin & chat")
    - `icon:` change from `MessageSquare` to `Radio` (from lucide-react) or keep `MessageSquare` — your call
  - Remove the separate voice-related entries if any exist in the config

### 3. Update ConsiliumHub rendering

- **Path:** `frontend/components/consilium/ConsiliumHub.tsx`
- **Action:** Modify
- **Spec:**
  - Replace `{displayedBoardroomSub === "forum" && <BulletinFeed />}` with `{displayedBoardroomSub === "forum" && <FluxerEmbed />}`
  - Import `FluxerEmbed` instead of `BulletinFeed`
  - Do NOT remove the BulletinFeed import if it's used elsewhere (it shouldn't be — verify with grep first)

### 4. Remove VoiceWidget from MainLayout

- **Path:** `frontend/components/layout/MainLayout.tsx`
- **Action:** Modify
- **Spec:**
  - Remove the `VoiceWidget` rendering (both floating and header-docked modes)
  - Remove the `VoiceRoomHeaderButton` / `CallButton` from the header toolbar
  - Remove associated state: `showVoiceWidget`, `voiceWidgetTarget`, localStorage keys
  - Keep imports of other layout components intact
  - Voice is now accessed through the Fluxer embed inside Consilium — no separate widget needed

### 5. Add env var

- **Path:** `.env.example` (and `frontend/.env` if it exists, or root `.env`)
- **Action:** Modify
- **Spec:**
  - Add `VITE_FLUXER_COMMUNITY_URL=` with a comment: `# Full URL to your Fluxer community (e.g. https://app.fluxer.app/pricedin)`
  - Do NOT add a real URL — leave it blank for the worker to fill in after community creation

### 6. Cleanup (soft — do NOT delete files)

- **Action:** Research only
- **Spec:**
  - Grep for any other imports of `BulletinFeed`, `VoiceWidget`, `useLiveKitRoom`, `CallButton`
  - If they are ONLY used in the files being modified, add a `// TODO: remove — replaced by Fluxer` comment at the top of the now-unused files
  - Do NOT delete `BulletinFeed.tsx`, `VoiceWidget.tsx`, `useLiveKitRoom.ts`, etc. — we keep them until Fluxer is confirmed stable

## Key Rules

- Solvys Gold palette: BG `#050402`, Accent `#c79f4a`, Text `#f0ead6` — loading skeleton and placeholder must use these
- No gradients, no colored emojis, no Kanban borders
- The iframe must be truly full-height within the Consilium panel (use `h-full` on every ancestor)
- `VITE_FLUXER_COMMUNITY_URL` is the single source of truth for the Fluxer URL — no hardcoded URLs
- Follow existing Consilium patterns for transitions (the parent already handles fade in/out)

## DO NOT

- Delete BulletinFeed, VoiceWidget, or LiveKit files — mark them with TODO comments only
- Build a custom Fluxer API client or WebSocket integration — iframe is the V1 approach
- Touch AgentChattr, HarperActivityFeed, or any other Consilium sub-views
- Modify Supabase realtime subscriptions in other components
- Add new npm dependencies

## Verification

```bash
# Type check
npx tsc --noEmit

# Build
bun run build

# Manual checks:
# 1. Open Consilium > Imperium > Fluxer tab — should show iframe or "not configured" placeholder
# 2. VoiceWidget should no longer appear in header or as floating widget
# 3. All other Consilium tabs (Sanctum, Chat, Apparatus) should work unchanged
# 4. AgentChattr (agentic-chat sub-view) should be unaffected
```

## Changelog Entry

```typescript
{
  date: '2026-04-12T00:00:00',
  agent: 'claude-code',
  summary: 'Replaced Consilium forum (BulletinFeed) and LiveKit voice widget with Fluxer.app iframe embed. Forum sub-view now renders FluxerEmbed component. VoiceWidget removed from MainLayout header/floating. Old files preserved with TODO markers.',
  files: [
    'frontend/components/consilium/FluxerEmbed.tsx',
    'frontend/components/consilium/ConsiliumTabConfig.ts',
    'frontend/components/consilium/ConsiliumHub.tsx',
    'frontend/components/layout/MainLayout.tsx',
    '.env.example'
  ]
}
```

## Post-Push Memory Update

After committing, if any issues were found (e.g. iframe CSP restrictions, Fluxer auth flow quirks), log to:

1. `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_fluxer_iframe.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
