# S27-ORCH — Voice Engine

- **Parent sprint branch**: `sprint/S27`
- **Cycle**: Cycle 7 (Pre-Release)
- **Due**: May 16
- **Owner**: Shashank

## What this covers

Review and update the Fintheon Voice Engine stack: (1) audit the consul-control integration that provides the voice UI entry point, and (2) upgrade the OpenAI STT model from the legacy `whisper-1` to the newest available model (`gpt-4o-transcribe` or equivalent). This ORCH ensures the voice chat pipeline is performing optimally before Closed Beta.

## Codebase map

### Backend voice services

- `backend-hono/src/services/voice-service.ts` — Orchestrator: provider selection, `transcribeVoice()`, `getVoiceDiagnostics()`, `isVoiceEnabled()`
- `backend-hono/src/services/voice-stt-provider.ts` — Provider abstraction: vibevoice, sidecar, whisper, fallback chain
- `backend-hono/src/services/voice-whisper-client.ts` — OpenAI Whisper HTTP client (currently uses `whisper-1` model)
- `backend-hono/src/services/voice-tts.ts` — ElevenLabs TTS for speech synthesis (separate from STT)
- `backend-hono/src/services/harper-vision/engine.ts` — Harper Vision audio chunk ingestion (also calls `transcribeVoice`)
- `backend-hono/src/services/hermes/client.ts` — Hermes sidecar client (voice.stt path — sidecar removed S59-T1)
- `backend-hono/src/routes/voice/index.ts` — Voice route registration
- `backend-hono/src/routes/voice/handlers.ts` — Voice route handlers (`handleTranscribe`)
- `backend-hono/src/routes/harper-vision/index.ts` — Harper Vision audio chunk endpoint
- `backend-hono/src/routes/index.ts` — Main route registry (voice routes at line 386-388, harper-voice at 448)

### Frontend voice components

- `frontend/hooks/useVoiceAssistant.ts` — Client-side voice recording, MediaRecorder → base64 → transcription → sendText
- `frontend/hooks/useHarperVoiceSession.ts` — Harper voice session hook
- `frontend/components/consul-control/ConsulControlCorners.tsx` — Consul UI entry point (pixelation corners)
- `frontend/hooks/useConsulControlStatus.ts` — Consul control active state hook
- `frontend/components/consilium/FluxerCallWidget.tsx` — Fluxer voice room widget (Trading floor voice channel)
- `frontend/components/chat/hooks/useChatSession.ts` — Chat session hook (consumes voice transcript)

### Other

- `docs/sprint-briefs/S27-T5-agent-voice-briefs.md` — Existing voice sprint brief
- `frontend/lib/services/voice.ts` — Backend API client for voice endpoints

## Child tickets

### SOL-66 — S27-T5: Voice engine + consul-control integration review

Branch: `sprint/S27`

**What to do**: Audit the existing voice pipeline end-to-end. Verify `useVoiceAssistant` → `/api/voice/transcribe` → `voice-service.ts` → `transcribeWithOpenAI` works correctly. Review `useConsulControlStatus` ↔ `ConsulControlCorners` wiring. Check error handling, provider fallback chain, and auth middleware on `/api/voice/*`. Ensure degraded-mode operation when OPENAI_API_KEY is unset.

**Key files to touch**: `frontend/hooks/useVoiceAssistant.ts`, `backend-hono/src/services/voice-service.ts`, `frontend/hooks/useConsulControlStatus.ts`, `frontend/components/consul-control/ConsulControlCorners.tsx`, `backend-hono/src/routes/voice/handlers.ts`, `frontend/lib/services/voice.ts`

**Validation**: Send test audio via voice assistant, verify transcript returned. Check consul-control corners render correctly. Run `npx tsc --noEmit --project frontend/tsconfig.json` and `cd backend-hono && bun run build`.

### SOL-67 — S27-T5: Voice chat: newest OpenAI model for STT

Branch: `sprint/S27`

**What to do**: Update the OpenAI STT model from `whisper-1` to the latest available model (`gpt-4o-transcribe`). In `backend-hono/src/services/voice-whisper-client.ts`, the model is hardcoded as `"whisper-1"` (line 32 and line 48/57). Switch to `"gpt-4o-transcribe"` once verified compatible. Also check the OpenAI API supports the same interface (multipart form POST with `file`, `model`, `language` fields). Update the diagnostics endpoint if needed.

**Key files to touch**: `backend-hono/src/services/voice-whisper-client.ts`, `backend-hono/src/services/voice-stt-provider.ts`, `backend-hono/src/services/voice-service.ts` (diagnostics)

**Validation**: After update, run `cd backend-hono && bun run build`. Verify transcription still works end-to-end. If `gpt-4o-transcribe` has different response shape or parameters, adapt client accordingly. Consider adding a feature flag or env var (`OPENAI_STT_MODEL`) to allow easy rollback.

## Execution order (wave sequence)

1. **Wave 1 — Consul-control audit** (SOL-66): Start with the consul integration since it's the UI entry point. Verify corners render, state transitions work, and the voice trigger path is clean. Fix any auth or state bugs.
2. **Wave 2 — STT model upgrade** (SOL-67): After confirming the pipeline works, upgrade the OpenAI model. This is a narrow, focused change in `voice-whisper-client.ts`.

## Validation

- [ ] Voice assistant captures audio and returns transcript (check browser console `[VoiceAssistant]` logs)
- [ ] Consul-control corners render in the app
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] Error path works when OPENAI_API_KEY is missing (graceful fallback, no crash)
- [ ] Add changelog entry to `src/lib/changelog.ts`

## Reference

- @sprint-md/S43-T7-component-extraction.md — referenced in child ticket descriptions (original sprint context)
- `docs/sprint-briefs/S27-T5-agent-voice-briefs.md` — existing voice brief
