# OpenClaw-README-NEW

## Purpose
This README is the implementation handoff for OpenClaw agents operating inside Pulse after the latest Psych Assist vNext rollout.

It covers:
- Header voice assistant + Aurora orb behavior.
- ER (Emotional Resonance) backend parity and infraction wiring.
- ProjectX activity ingestion/aggregation used for ER overtrading penalties.
- Autopilot proposal workflow (with current routing status).
- Active chat interfaces and how they map to OpenClaw.

Date: 2026-03-04

---

## High-Level Architecture

### OpenClaw core
- Main chat routing endpoint: `POST /api/ai/chat`
- Core handler: `backend-hono/src/routes/ai/handlers/chat.ts`
- Agent routing + gateway fallback: `backend-hono/src/services/openclaw-handler.ts`
- Agent role map/config: `backend-hono/src/services/openclaw-service.ts`

### Voice (new)
- Routes:
  - `POST /api/voice/transcribe`
  - `POST /api/voice/speak`
- Route files:
  - `backend-hono/src/routes/voice/index.ts`
  - `backend-hono/src/routes/voice/handlers.ts`
- Service:
  - `backend-hono/src/services/voice-service.ts`
- Frontend runtime/state:
  - `frontend/hooks/useVoiceAssistant.ts`
  - `frontend/components/voice/HeaderVoiceControl.tsx`
  - `frontend/components/voice/VoiceAuroraOrb.tsx`
  - `frontend/types/voice.ts`

### ER parity + ProjectX weighting (new)
- ER routes:
  - `GET /api/er/sessions`
  - `POST /api/er/sessions`
  - `POST /api/er/snapshots`
  - `POST /api/er/check-overtrading`
- ER route/service files:
  - `backend-hono/src/routes/er/index.ts`
  - `backend-hono/src/routes/er/handlers.ts`
  - `backend-hono/src/services/er-service.ts`
- ProjectX activity routes:
  - `GET /api/projectx/activity/:accountId`
  - `POST /api/projectx/activity/ingest`
- ProjectX activity service:
  - `backend-hono/src/services/projectx-activity-service.ts`
- Frontend service parity:
  - `frontend/lib/services.ts` (`ERService`, `ProjectXService`, `VoiceService`)

### DB migration (new)
- `backend-hono/migrations/008_psych_assist_vnext.sql`
- Adds:
  - `er_sessions`
  - `er_snapshots`
  - `projectx_activity_events`

---

## Header Voice + Aurora Orb

### Placement rules
- Voice control is in header toolbar as `ToolbarItemId = 'voice'`.
- Config/default order in `frontend/lib/layoutOrderStorage.ts`.
- Rendered from `TopHeader.tsx` via toolbar map.
- Present in normal and Zen modes because TopHeader is global.
- Not inside Mission Control card/widget surfaces.

### Orb state model
Defined in `frontend/types/voice.ts`:
- `idle`
- `listening`
- `thinking`
- `speaking`
- `infraction`

Priority resolver:
1. `infraction`
2. `thinking`
3. `speaking`
4. `listening` / `idle`

Color map (locked):
- Thinking: `#f59e0b` (orange)
- Infraction: `#ef4444` (red)
- Speaking + Idle + Listening: `#22c55e` (green)

### Animation rules
In `VoiceAuroraOrb.tsx`:
- Wave motion runs only when `state === 'speaking'`.
- `thinking`: breathing pulse only.
- `infraction`: sharper alert pulse only.
- `idle` / `listening`: subtle pulse.
- Border + glow are color-bound to current state.

---

## Infraction and Intervention Policy

### Event wiring
Psych Assist monitors dispatch browser events:
- `psychassist:score`
- `psychassist:infraction`

Event emitters:
- `frontend/components/mission-control/EmotionalResonanceMonitor.tsx`
- `frontend/components/mission-control/CompactERMonitor.tsx`
- `frontend/contexts/ERContext.tsx`

### Header intervention logic
`frontend/components/voice/HeaderVoiceControl.tsx` enforces:
- Red hold window after infraction: `8s`
- Intervention trigger:
  - `>= 2` infractions within `5 minutes`, OR
  - ER score `<= -1.5`
- Cooldown between interventions: `10 minutes`

Interventions call:
- `useVoiceAssistant().respondToInfraction(...)`
- Which sends mode `infraction` to `/api/voice/speak` and routes through Harper.

---

## Voice API Contract

### `POST /api/voice/transcribe`
Input:
- `audioBase64?`
- `mimeType?`
- `language?`
- `prompt?`
- `text?` (short-circuit fallback)

Output:
- `text`
- `model`
- `provider`

### `POST /api/voice/speak`
Input:
- `text` (required)
- `conversationId?`
- `mode?: 'chat' | 'infraction'`
- `includeAudio?` (default true)
- `agent?` (currently normalized to Harper flow)

Output:
- `conversationId`
- `agent`
- `responseText`
- `audioBase64?`
- `audioMimeType?`
- `mode`

Behavior:
- Reuses or creates persistent AI conversation.
- Calls `handleOpenClawChat(...)` with Harper override.
- Stores user/assistant messages in conversation store.
- Attempts OpenAI TTS (`/v1/audio/speech`), text-only fallback on failure.

---

## ER + ProjectX API Contract

### `POST /api/er/sessions`
Creates or updates/finalizes ER session.

### `POST /api/er/snapshots`
Persists ER snapshots (score/state/audioLevels/keywords).

### `POST /api/er/check-overtrading`
Input:
- `windowMinutes?` (default 15)
- `threshold?` (default 5)

Output includes:
- `isOvertrading`
- `tradesInWindow`
- `weightedTrades`
- `penalty`
- `warning?`

### `GET /api/projectx/activity/:accountId`
Optional query:
- `windowMinutes`
- `limit`

Returns:
- `events[]`
- `summary` with
  - `weightedTradeCount`
  - `overtradingPenalty`
  - `realizedPnl`

### `POST /api/projectx/activity/ingest`
Bridge endpoint for SignalR-fed event batches.

---

## Chat Interfaces (OpenClaw)

### Analysis Chat (primary)
- UI: `frontend/components/ChatInterface.tsx`
- Host section: `frontend/components/analysis/AnalysisSection.tsx`
- Hook: `frontend/components/chat/hooks/useOpenClawChat.ts`
- API target: `POST /api/ai/chat`
- Persistent per-agent conversation key via:
  - `frontend/hooks/usePersistentOpenClawConversation.ts`
  - `frontend/lib/openclawAgentRouting.ts`

### Ask Harp side panel
- UI: `frontend/components/chat/AskHarpChatPanel.tsx`
- Opened from TopHeader chat button.
- Shares persistent conversation logic.

### Floating chat
- UI: `frontend/components/chat/PulseFloatingChat.tsx`
- Same OpenClaw transport + per-agent conversation persistence.

### Research Department chat
- UI: `frontend/components/executive/ResearchDepartment.tsx`
- Uses OpenClaw hook + agent override mapping.

### Boardroom tab
- UI: `frontend/components/BoardroomView.tsx`
- Notion embed + intervention sidebar (not primary OpenClaw chat stream).

---

## Autopilot (Included)

### Backend implementation exists
- Route module: `backend-hono/src/routes/autopilot/index.ts`
- Handlers: `backend-hono/src/routes/autopilot/handlers.ts`
- Lifecycle service: `backend-hono/src/services/autopilot/proposal-service.ts`
- Agent pipeline orchestration: `backend-hono/src/services/agents/pipeline.ts`

Autopilot endpoints:
- `POST /api/autopilot/generate`
- `GET /api/autopilot/proposals`
- `GET /api/autopilot/proposals/:id`
- `POST /api/autopilot/acknowledge`
- `POST /api/autopilot/execute`
- `GET /api/autopilot/history`
- `POST /api/autopilot/expire`

### Important current status
As of this handoff, `createAutopilotRoutes()` is **not registered** in `backend-hono/src/routes/index.ts`.

To enable autopilot HTTP routes, add:
1. Import:
   - `import { createAutopilotRoutes } from './autopilot/index.js';`
2. Auth guard:
   - `app.use('/api/autopilot', authMiddleware);`
3. Route mount:
   - `app.route('/api/autopilot', createAutopilotRoutes());`

### Autopilot + execution path
- Proposal generation runs multi-agent pipeline and risk manager gates.
- Execution path currently supports:
  - Rithmic primary (when `PRIMARY_BROKER=rithmic`)
  - ProjectX simulation fallback path in proposal execution.

---

## Runtime/Env Checklist

Core:
- `NEON_DATABASE_URL` or `DATABASE_URL`
- `PORT`

OpenClaw:
- `OPENCLAW_BASE_URL`
- `OPENCLAW_API_KEY`
- `OPENCLAW_APP_NAME` (optional)

Voice (OpenAI):
- `OPENAI_API_KEY`
- `OPENAI_TRANSCRIBE_MODEL` (optional, default `whisper-1`)
- `OPENAI_TTS_MODEL` (optional, default `gpt-4o-mini-tts`)
- `OPENAI_TTS_VOICE` (optional, default `alloy`)

Trading:
- `PRIMARY_BROKER` (`rithmic` or `projectx`)

---

## Quick Operational Smoke Tests

### 1) Backend typecheck
`cd backend-hono && npm run typecheck`

### 2) Frontend typecheck
`cd frontend && npm run typecheck`

### 3) Voice speak test
`curl -X POST http://localhost:8080/api/voice/speak -H 'content-type: application/json' -d '{"text":"Give me a short ER intervention.","mode":"infraction"}'`

### 4) ER overtrading test
`curl -X POST http://localhost:8080/api/er/check-overtrading -H 'content-type: application/json' -d '{"windowMinutes":15,"threshold":5}'`

### 5) ProjectX activity fetch test
`curl http://localhost:8080/api/projectx/activity/1001`

---

## Known Follow-Ups
- Wire real SignalR client/worker to push into `/api/projectx/activity/ingest` continuously.
- Register autopilot routes in route aggregator if API exposure is required now.
- Add backend tests for voice/ER/projectx activity routes.
- Add frontend integration tests for orb state priority and speaking-only wave animation.

