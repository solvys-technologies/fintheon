# Task Brief: LiveKit Voice + Toast Overhaul + Onboarding Scripts

**Date:** 2026-04-01
**Scope:** Wire real group voice calls, restyle toasts to iOS26 Liquid Glass, fix toast placement, update install/update scripts for multi-user onboarding
**Estimated files:** 12

## Context

Three interconnected improvements shipping together: (1) Group voice calls need real audio via LiveKit Cloud — currently stub tokens with no WebRTC. (2) Toast notifications need placement audit (system=bottom-left, trading=top-right), Liquid Glass styling, and an "update available" system toast. (3) Install/update scripts need to handle Claude CLI + Twitter CLI + browser auth + peer registration for every new user, with `fintheon update` picking up new onboarding phases.

---

## Files to Read First

- `backend-hono/src/services/peers/voice-room.ts` — Stub token implementation. Has `LIVEKIT_API_KEY/SECRET/URL` env detection.
- `frontend/components/peers/VoiceWidget.tsx` — Dockable voice UI. Join/leave/mute buttons, REST polling for participants.
- `frontend/components/ui/Toast.tsx` — Current toast rendering. All gold-tinted, `translateX(-16px)` animation for all positions.
- `frontend/contexts/ToastContext.tsx` — Toast types, positions (`top-right`/`bottom-left`), `addToast()` API, DND blocklist.
- `scripts/fintheon-setup.sh` — Current install script. Has Phases 1-9 + Phase 10 peer bootstrap stub.
- `scripts/install-cli.sh` — CLI installer. `fintheon` command with `setup|update|start|stop|status|logs|peers` subcommands.
- `scripts/peer-bootstrap.sh` — Peer registration script (exists but may be incomplete).
- `backend-hono/.env.example` — Env var documentation for new users.

---

## Part 1: LiveKit Cloud Voice

### 1a. Create LiveKit Account + Add Credentials

- Sign up at https://cloud.livekit.io (free tier)
- Create project "Fintheon"
- Add to `backend-hono/.env.example` with signup URL:
  ```
  # Voice — LiveKit Cloud (free tier: https://cloud.livekit.io)
  LIVEKIT_API_KEY=
  LIVEKIT_API_SECRET=
  LIVEKIT_URL=
  ```
- Add actual credentials to `backend-hono/.env`

### 1b. Backend: Real JWT Tokens

- **Path:** `backend-hono/src/services/peers/voice-room.ts` — Modify
- Install: `cd backend-hono && bun add livekit-server-sdk`
- Replace `buildParticipantToken()` with real `AccessToken` from livekit-server-sdk
- Keep stub path when env vars missing (graceful degradation)
- **Max lines:** 120

### 1c. Frontend: LiveKit React SDK

- **Path:** `frontend/components/peers/VoiceWidget.tsx` — Modify
- Install: `cd frontend && bun add @livekit/components-react livekit-client`
- On "Join": fetch token from `/api/peers/voice/join`, connect to LiveKit room
- Use `useLocalParticipant()` for mute/unmute
- Use `useParticipants()` for live participant list (replace REST polling)
- Audio uses system default input/output — NO device selector UI. It just works.
- On "Leave": disconnect from room
- Keep existing dockable UI (floating ↔ header) — wire audio inside it
- **Max lines:** 280

### 1d. Audio Renderer

- **Path:** `frontend/components/peers/VoiceAudioRenderer.tsx` — Create
- Renders `<AudioTrack>` for each remote participant (plays through system default output)
- No visible UI — just audio elements
- **Max lines:** 40

---

## Part 2: Toast Overhaul

### 2a. Placement Audit

Grep every `addToast()` call in the frontend codebase. Enforce:

- **Top-right:** RiskFlow alerts, proposals, VIX spikes, trade executions, IV changes, market events, news alerts
- **Bottom-left:** Backend status, connection state, service health, peer online/offline, build/update notifications, errors

Every `addToast()` call must pass the correct `position` parameter. If it doesn't pass one, add it.

### 2b. iOS26 Liquid Glass Restyle

- **Path:** `frontend/components/ui/Toast.tsx` — Modify
- Decrease opacity of ALL toast cards to look like iOS26 Liquid Glass:
  - Background: `rgba(var(--fintheon-bg-rgb), 0.45)` with heavy `backdrop-blur-2xl`
  - Slight tint of user primary theme color: `color-mix(in srgb, var(--fintheon-accent) 8%, transparent)` added to background
  - Border: `1px solid color-mix(in srgb, var(--fintheon-accent) 12%, transparent)` (more subtle than current 25%)
  - Box shadow: softer, more diffuse — `0 8px 32px rgba(0,0,0,0.3)` instead of current heavy shadow
  - Inner highlight: subtle top edge `inset 0 1px 0 rgba(255,255,255,0.04)`
- Fix animation direction: top-right toasts slide from `translateX(16px)` (right), bottom-left from `translateX(-16px)` (left). Currently both slide from left.
- Toast position prop must be passed to `ToastItem` so it knows which direction to animate.
- **Max lines:** 120

### 2c. Update Available Toast

- **Path:** `frontend/components/ui/Toast.tsx` + `frontend/contexts/ToastContext.tsx` — Modify
- New notification type: `'update-available'`
- When the frontend detects a version mismatch (compare `window.__FINTHEON_VERSION__` with `/api/version` response), show:
  - Toast: "Fintheon update available" with description showing version
  - CTA button: "Update Now" → runs `window.electron?.ipcRenderer?.send('app-update')` or opens terminal instruction
  - Position: `bottom-left` (system toast)
  - Variant: `info`

### 2d. Version Check

- **Path:** `frontend/lib/version-check.ts` — Create
- On app load, fetch `/api/version` and compare with embedded build version
- If mismatch, trigger the update-available toast
- Check every 30 minutes
- **Max lines:** 40

---

## Part 3: Install/Update Scripts

### 3a. Enhanced Setup Script

- **Path:** `scripts/fintheon-setup.sh` — Modify
- Ensure these phases run in order with clear progress:
  1. System prerequisites (git, brew, node, bun, python, uv) — EXISTING
  2. Clone/update repo — EXISTING
  3. Install deps — EXISTING
  4. **Claude CLI install + auth** — EXISTING but verify it works end-to-end:
     - `npm install -g @anthropic-ai/claude-code`
     - `claude auth login` — opens browser for Anthropic auth
     - Verify with `claude --print "ping" --output-format text`
  5. **Twitter CLI install + browser auth** — EXISTING but verify:
     - `uv tool install twitter-cli`
     - `twitter auth login` — opens system default browser for X login
     - Verify with `twitter user get --username elonmusk --limit 1`
  6. API keys — EXISTING
  7. Build — EXISTING
  8. Install app — EXISTING
  9. Start backend — EXISTING
  10. **Peer registration** — calls `scripts/peer-bootstrap.sh`
  11. **LiveKit setup** (new) — prompt for LiveKit credentials or skip
- Each phase that completes should write a marker file to `~/.fintheon/setup-phases-done.json` so `fintheon update` knows which phases to re-run

### 3b. Update Script

- **Path:** `scripts/fintheon-update.sh` — Modify (or create if missing)
- `fintheon update` should:
  1. `git pull origin <branch> --rebase`
  2. `bun install` in all workspaces
  3. `cd backend-hono && bun run build`
  4. `npm run desktop:build` (rebuild DMG)
  5. **Check for new onboarding phases** — compare `setup-phases-done.json` with the current script's phase list. Run any new phases (e.g., LiveKit setup wasn't in the original install but is now).
  6. Restart backend
  7. Copy DMG to ~/Desktop
  8. Print summary of what changed
- **Max lines:** 150

### 3c. Peer Bootstrap

- **Path:** `scripts/peer-bootstrap.sh` — Verify/fix
- Must work standalone (`fintheon peers`) and as part of setup
- Checks Claude CLI + Twitter CLI availability
- Registers peer via POST `/api/peers/register`
- Writes config to `~/.fintheon/peer.json`
- **Max lines:** 80

---

## Key Rules

- System default audio — NO device selector for LiveKit. `autoSubscribe` handles it.
- Toast placement is a HARD rule: trading=top-right, system=bottom-left. No exceptions.
- Liquid Glass: low opacity (0.45 bg), heavy blur, SLIGHT theme tint. NOT opaque cards.
- Every `addToast()` in the codebase must have an explicit `position` parameter.
- Setup script must be idempotent — re-running skips completed phases.
- Update script must detect and run NEW phases from future versions.
- All new env vars documented in `.env.example` with signup URLs.

## DO NOT

- Add an audio device selector or settings panel for voice
- Change the VoiceWidget dockable/floating behavior — only wire audio inside it
- Modify RiskFlow, NarrativeFlow, scoring, or feed pipeline code
- Touch boardroom, bulletin, research, or document editor code
- Create scoring-carousel.ts or twitter-rotation.ts (separate task)

## Verification

```bash
cd backend-hono && bun run build
npx vite build
# Manual: open app, verify toasts appear in correct positions with Liquid Glass styling
# Manual: join voice room from two devices, verify audio works
# Manual: run fintheon update, verify it picks up new phases
```

## Changelog Entry

```typescript
{
  date: '2026-04-01T...',
  agent: 'claude-code',
  summary: 'LiveKit Cloud voice (real WebRTC audio), iOS26 Liquid Glass toast restyle, toast placement audit, update-available notification, enhanced install/update scripts with phase tracking',
  files: [
    'backend-hono/src/services/peers/voice-room.ts',
    'frontend/components/peers/VoiceWidget.tsx',
    'frontend/components/peers/VoiceAudioRenderer.tsx',
    'frontend/components/ui/Toast.tsx',
    'frontend/contexts/ToastContext.tsx',
    'frontend/lib/version-check.ts',
    'scripts/fintheon-setup.sh',
    'scripts/fintheon-update.sh',
    'scripts/peer-bootstrap.sh',
    'scripts/install-cli.sh',
    'backend-hono/.env.example'
  ]
}
```
