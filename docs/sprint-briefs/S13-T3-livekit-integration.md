# S13-T3: LiveKit Group Voice Call Integration

**Sprint:** S13 — Teams, LiveKit, Agentic Desk
**Track:** T3 (parallel with T2, after T1)
**Repo:** solvys-technologies/fintheon (branch: s13-teams-livekit)

---

## Context

Build the full LiveKit integration for human-to-human group voice calls while trading. This includes a Hono backend token server, a React hook for room management, call control UI components, and a call button in the TopHeader. This is NOT an AI agent voice feature — it's pure WebRTC group audio for users to talk to each other.

---

## Files to Read First

- `frontend/types/livekit.ts` — shared types (created by T1): LiveKitTokenRequest, LiveKitTokenResponse, CallState, CallParticipant
- `frontend/components/layout/TopHeader.tsx` — where the call button goes (next to voice orb)
- `frontend/components/voice/HeaderVoiceControl.tsx` — existing voice orb pattern to reference for styling
- `frontend/hooks/useVoiceAssistant.ts` — mic permission and arbitration patterns to avoid conflicts
- `backend-hono/src/index.ts` — main Hono app, route registration pattern
- `backend-hono/src/middleware/auth.ts` — auth middleware pattern
- `backend-hono/src/config/env.ts` — env var pattern
- `frontend/contexts/AuthContext.tsx` — userId, session info
- `frontend/contexts/SettingsContext.tsx` — traderName for participant display name
- `package.json` — confirm livekit-client is installed (T1 did this)

---

## Files to Create

### 1. `backend-hono/src/routes/livekit/handlers.ts` (~60 lines)

Token generation handler:
```typescript
import { AccessToken } from 'livekit-server-sdk';

// Env vars: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
// These will be added to .env by the user after creating a LiveKit Cloud account

export async function generateToken(req: {
  roomName: string;
  participantName: string;
  participantIdentity: string;
}): Promise<{ token: string; url: string }> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;
  
  if (!apiKey || !apiSecret || !livekitUrl) {
    throw new Error('LiveKit not configured — set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL');
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: req.participantIdentity,
    name: req.participantName,
  });

  at.addGrant({
    room: req.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    token: await at.toJwt(),
    url: livekitUrl,
  };
}
```

### 2. `backend-hono/src/routes/livekit/index.ts` (~30 lines)

Route registration:
```typescript
import { Hono } from 'hono';
import { generateToken } from './handlers';

const livekit = new Hono();

livekit.post('/token', async (c) => {
  const body = await c.req.json();
  const { roomName, participantName, participantIdentity } = body;
  
  if (!roomName || !participantIdentity) {
    return c.json({ error: 'roomName and participantIdentity required' }, 400);
  }

  try {
    const result = await generateToken({
      roomName,
      participantName: participantName || 'Anonymous',
      participantIdentity,
    });
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export { livekit };
```

Register in `backend-hono/src/index.ts`:
```typescript
import { livekit } from './routes/livekit/index';
app.route('/api/livekit', livekit);
```

### 3. `frontend/hooks/useLiveKitRoom.ts` (~120 lines)

React hook for managing LiveKit room connection:
```typescript
// Key features:
// 1. connect(roomName) — fetches token from backend, connects to LiveKit room
// 2. disconnect() — leaves the room
// 3. toggleMute() — mutes/unmutes local audio
// 4. State: callState (CallState), participants (CallParticipant[]), isMuted, error
// 5. Auto-publishes microphone track on join
// 6. Listens for participant events (joined, left, muted, speaking)
// 7. Uses getUserMedia for default audio source (no custom device selection needed for MVP)
// 8. Cleanup on unmount

import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';
import type { CallState, CallParticipant, LiveKitTokenResponse } from '../types/livekit';

// The hook should:
// - Create a Room instance
// - On connect: fetch token from /api/livekit/token, room.connect(url, token)
// - Publish local audio track
// - Listen for ParticipantConnected, ParticipantDisconnected, TrackMuted, TrackUnmuted, ActiveSpeakersChanged
// - Map remote participants to CallParticipant[]
// - Expose: connect, disconnect, toggleMute, callState, participants, isMuted, error
```

### 4. `frontend/components/team/CallControls.tsx` (~100 lines)

Call UI component with:
- **Join Call** button (Phone icon) — when idle, shows "Join Trading Room"
- **Leave Call** button (PhoneOff icon) — when connected
- **Mute/Unmute** toggle (Mic/MicOff icon)
- **Participant count** badge
- **Participant list** — small avatars/names of people in the call with speaking indicators
- **Connection state** indicator (connecting spinner, connected green, error red)
- **Audio renderer** — use `RoomAudioRenderer` from `@livekit/components-react` to play remote audio

The default room name should be `trading-floor` — all team members join the same room.

Style: Match Fintheon dark theme. Compact — this will sit in the Team panel or TopHeader area.

### 5. `frontend/components/voice/CallButton.tsx` (~50 lines)

A compact call button for the TopHeader toolbar:
- When idle: Phone icon, gold border, "Join Call" tooltip
- When connected: PhoneOff icon, green glow, participant count badge, "Leave Call" tooltip  
- When connecting: Loader spinner
- Clicking toggles join/leave
- Uses `useLiveKitRoom` hook

---

## Files to Modify

### `backend-hono/src/index.ts`
Add route registration for the livekit routes (find where other routes are registered with `app.route()`).

### `frontend/components/layout/TopHeader.tsx`
Add the CallButton to the toolbar items:
1. Import `CallButton` from `../voice/CallButton`
2. Place it in the toolbar near the HeaderVoiceControl (voice orb). Look for where `<HeaderVoiceControl />` is rendered and add `<CallButton />` next to it.

### `backend-hono/src/config/env.ts` (or equivalent)
Add env var declarations:
```typescript
LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || '',
LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || '',
LIVEKIT_URL: process.env.LIVEKIT_URL || '',
```

---

## Key Implementation Details

### LiveKit Room Setup (frontend)
```typescript
const room = new Room({
  adaptiveStream: true,
  dynacast: true,
  audioCaptureDefaults: {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
  },
});

// Connect
const { token, url } = await fetchToken(roomName, displayName, userId);
await room.connect(url, token);

// Publish mic
const localTrack = await createLocalAudioTrack();
await room.localParticipant.publishTrack(localTrack);
```

### Graceful degradation
If LIVEKIT_API_KEY is not set, the backend returns a 500 with "LiveKit not configured". The frontend CallButton should:
- Catch this error
- Show a tooltip: "Voice calls not configured — add LiveKit keys in .env"
- Remain visible but disabled (grayed out)

---

## Verification

1. Backend route responds to POST `/api/livekit/token` (returns error about missing keys, which is expected)
2. CallButton renders in TopHeader next to voice orb
3. CallControls component renders with join/leave/mute UI
4. `useLiveKitRoom` hook compiles with correct types
5. `npx tsc --noEmit` passes in both frontend and backend-hono
6. No files exceed 150 lines

---

## DO NOT
- Do NOT build AI agent voice features — this is human-to-human only
- Do NOT modify the existing voice assistant (HeaderVoiceControl, VoiceContext, useVoiceAssistant) — those are separate
- Do NOT build the Team panel — that's T2
- Do NOT modify FooterToolbar — that's T2
- Do NOT touch AgenticDesk or any rename files — that's T1
- Use `gh` CLI with `api_credentials=["github"]` for all git operations

## Commit Message
```
feat(s13-t3): livekit group voice calls — token server, room hook, call controls

- POST /api/livekit/token endpoint for room token generation
- useLiveKitRoom hook for connect/disconnect/mute
- CallButton in TopHeader for quick join/leave
- CallControls component with participant list and speaking indicators
- Graceful degradation when LiveKit keys not configured

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
