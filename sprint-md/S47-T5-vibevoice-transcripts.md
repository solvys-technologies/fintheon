# Sprint Brief: T5 -- VibeVoice STT and Commentary Transcript Context

## Context

TP requested replacing the current speech-to-text voice engine with VibeVoice and auto-recording transcripts from commentary users watch inside the app, then feeding those transcripts into the next Arbitrum run. This is a standalone voice/data track to avoid destabilizing chat and Agentic Forum repairs.

## Branch Target

`s47-wave2-vibevoice-transcripts`

## Scope -- Included

- [ ] Evaluate and integrate VibeVoice-ASR as the preferred STT backend if runtime requirements fit.
- [ ] Keep existing voice path working behind a fallback switch until VibeVoice proves stable.
- [ ] Store user-watched commentary transcripts with source metadata.
- [ ] Feed recent relevant commentary transcripts into the next Arbitrum run context.
- [ ] Add diagnostics for STT provider and transcript ingestion.

## Scope -- Excluded (DO NOT TOUCH)

- Chat text rendering, attachments, and Agentic Forum UI owned by T4.
- General audio UI/spinner/icon refactor owned by T6.
- Arbitrum UI owned by T3; this track only supplies backend context.
- Do not add paid voice services.

## Reuse Inventory

- `backend-hono/src/routes/voice/index.ts` and `backend-hono/src/routes/voice/handlers.ts` -- existing voice route surface.
- `backend-hono/src/services/voice-service.ts` -- existing STT/TTS service path referenced in changelog.
- `backend-hono/src/services/ai/sidecar-voice-client.ts` -- existing sidecar voice client from prior sprint if present.
- `frontend/components/voice/HeaderVoiceControl.tsx` -- voice trigger UI.
- `frontend/components/voice/VoiceRimFrame.tsx` -- voice state UI.
- `frontend/lib/harper-voice.ts` -- Harper Voice frontend client.
- `frontend/components/layout/YouTubeMiniplayer.tsx` -- commentary watching surface and source of video/session context.
- `backend-hono/src/services/arbitrum/econ-context.ts` and `backend-hono/src/services/arbitrum/*` -- add transcript context to Arbitrum prompt assembly.
- `supabase/migrations-pending/20260424000000_rename_omi_tables_to_harper_voice.sql` -- pending rename context; do not blindly apply.

## Known Issues to Preserve

- Prior Omi-to-Harper Voice rename intentionally left some DB column names pending. Do not perform broad DB rename unless coordinated.
- Voice must degrade gracefully if local VibeVoice runtime is unavailable.
- Audio/transcript capture must be user-visible and bounded; do not silently record microphone audio beyond the requested commentary transcript feature.

## Implementation Steps

1. Read `https://github.com/microsoft/VibeVoice/blob/main/docs/vibevoice-asr.md` and determine supported runtime, model size, hardware requirements, API/CLI shape, and long-form limits.
2. Determine whether `mpaepper/vibevoice` is useful for local desktop dictation or not suitable for backend STT.
3. Add a provider abstraction if missing: `VOICE_STT_PROVIDER=vibevoice|sidecar|whisper|fallback` or equivalent, with VibeVoice first when configured.
4. Implement VibeVoice client wrapper with timeout, file size limits, and structured error/fallback reason.
5. Do not remove the existing STT path until VibeVoice passes local smoke.
6. Add a transcript table migration if no suitable table exists: video_url, source_url, title, watched_at, transcript_text, transcript_summary, user_id, created_at, provider, confidence nullable.
7. Wire YouTube/commentary watched events to request transcript capture. Use existing `videoUrl`/miniplayer context from RiskFlow if available.
8. Summarize transcript before injecting into Arbitrum. Store raw transcript but pass compact summary and source citation.
9. In Arbitrum backend context builder, include recent relevant commentary transcript summaries for the selected instrument/session.
10. Add diagnostics fields: active STT provider, last transcript capture, last failure, transcript count last 24h.
11. Add/update changelog entry.

## Acceptance Criteria

- [ ] Voice STT provider reports VibeVoice when configured and falls back cleanly otherwise.
- [ ] Existing voice interaction does not regress when VibeVoice is unavailable.
- [ ] Watching commentary can produce a transcript record with source metadata.
- [ ] Next Arbitrum run can consume summarized commentary transcript context.
- [ ] Diagnostics expose STT/transcript health.

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Frontend type check if voice UI/miniplayer changed
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build if frontend changed
rm -rf dist && npx vite build

# Diagnostics smoke
curl -s http://localhost:8080/api/diagnostics
```

## Commit Format

```bash
[v5.34.0] feat: T5 add VibeVoice transcript context
```
