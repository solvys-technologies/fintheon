# S27-T5 — Voice Assistant Completion (Voicebox/Qwen via Hermes Sidecar, Non-Interrupting Rim UX)

## Ownership

Claude-08, Wave 2, branch `s27-w2c-voice`, worktree `/Users/tifos/Desktop/Codebases/fintheon-s27-w2c`.

Starts only after Wave 1 lands W1b (Hermes sidecar) + W1d (SOUL.md).

## Context — This is a Rewrite, Not the Original T5

The originally-drafted T5 was brief-narration (MDB/ADB/PMDB/TOTT audio with per-agent OpenAI voices). **Dropped.** TP clarified the real T5:

> "Voice assistant, when enabled, needs microinteraction, then greeting from AI agent. User request is to be transcribed, then ingested by agent before streaming response via voice, emulating a real conversation, without lengthy deliberation. Feature is designed to be able to ask questions quickly, and get quick, but NOT stupid, analysis."

And:

> "OpenAI TTS relay to user and response from user in STT never worked properly."

The existing Fintheon voice path (`voice-service.ts` + `/api/voice/transcribe` + `/api/voice/speak` + `HeaderVoiceControl.tsx`) is partially wired but the end-to-end relay doesn't work. T5 fixes that by (a) replacing OpenAI TTS/STT with voicebox/Qwen3-TTS + Whisper-equivalent STT routed through the Hermes Python sidecar, (b) grounding the voice CAO on the same SOUL file used by main-chat CAOs so both surfaces have one source of personal truth, (c) shipping a non-interrupting rim UX so the feature works while TP is mid-trade without ever covering content.

## Inspiration + Locked Decisions

- [jamiepine/voicebox](https://github.com/jamiepine/voicebox) — open-source voice studio, Qwen3-TTS + Whisper, self-hostable.
- Voice model: **smartest FREE Qwen reasoning model available at implementation time**. Selected with TP sign-off during the sprint. Must be Sonnet-equivalent or better.
- STT: Whisper-turbo (or Qwen-STT if benchmarks favor it at implementation time).
- TTS: Qwen3-TTS through voicebox.
- All three loaded as plugins inside the Hermes sidecar (W1b), accessed via `POST /v1/voice/stt` + `POST /v1/voice/tts` + `POST /v1/chat` with voice agent id.
- Grounding: voice-CAO loads `backend-hono/src/services/ai/soul/harper.md` (written by W1d), which in turn imports Harper's `CLAUDE.md` verbatim as source of personal truth. Main-chat CAOs use the same file — no drift.
- UX: **non-interrupting rim around the app window chrome**, not a modal. Must work during active trading without covering content.

## §1 — Sidecar voice plugin wiring (depends on W1b)

In `hermes-sidecar/config.yaml`, register:

- `plugins.voice.tts.provider: voicebox` with Qwen3-TTS model config
- `plugins.voice.stt.provider: whisper-turbo` (fallback to `qwen-stt` via env flag)
- `plugins.voice.agent_id: harper-2.1-voice` — a dedicated voice agent whose SOUL inherits Harper's

Claude-08 verifies each plugin boots via:

```
curl -X POST http://localhost:8318/v1/voice/stt -F audio=@sample.wav → {transcript}
curl -X POST http://localhost:8318/v1/voice/tts -d '{"text":"hello","voice_id":"harper-2.1-voice","stream":true}' → audio stream
```

## §2 — Backend streaming relay

Rewrite [`backend-hono/src/services/voice-service.ts`](backend-hono/src/services/voice-service.ts) from OpenAI-direct to sidecar-relay:

```ts
// OLD: direct OpenAI call
// NEW: proxy to sidecar
export async function transcribe(audio: ArrayBuffer): Promise<Transcript> {
  return await sidecarClient.voice.stt({ audio_bytes: Buffer.from(audio).toString('base64') })
}

export async function* streamVoiceReply(
  conversationId: string,
  transcript: string
): AsyncGenerator<VoiceEvent> {
  // 1. Ingest user turn into sidecar context
  await sidecarClient.context.ingest(conversationId, { role: 'user', content: transcript, ... })

  // 2. Start chat stream
  const chatStream = sidecarClient.chat.stream({
    agent_id: 'harper-2.1-voice',
    conversation_id: conversationId,
    user_message: transcript,
    stream: true,
  })

  // 3. For each text delta, start TTS stream (parallel, overlap synthesis + generation)
  let ttsQueue: Promise<ArrayBuffer>[] = []
  for await (const evt of chatStream) {
    if (evt.type === 'delta' && evt.payload.text) {
      ttsQueue.push(sidecarClient.voice.tts({
        text: evt.payload.text,
        voice_id: 'harper-2.1-voice',
        stream: true,
      }))
    }
    yield { type: 'text', text: evt.payload.text }
  }

  for (const audioBuf of await Promise.all(ttsQueue)) {
    yield { type: 'audio', bytes: audioBuf }
  }
}
```

Update [`backend-hono/src/routes/voice/handlers.ts`](backend-hono/src/routes/voice/handlers.ts) to expose:

- `POST /api/voice/session/start` → returns `{ conversation_id, greeting_audio_url }`. Backend pre-renders the greeting so there's zero perceived lag when UX opens.
- `POST /api/voice/session/turn` → accepts user audio, returns SSE stream of `{type: 'transcript', …}`, `{type: 'text', …}`, `{type: 'audio', …}` events.
- `POST /api/voice/session/interrupt` → aborts in-flight chat + TTS streams for a conversation.
- `POST /api/voice/session/end` → closes the conversation, optional memory consolidation.

## §3 — Proactive greeting

When UX opens:

1. Frontend calls `POST /api/voice/session/start`.
2. Backend creates conversation, loads SOUL.md, calls sidecar `/v1/chat` with a system-generated prompt: "The user just opened the voice assistant. Give a 1-sentence greeting (max 12 words) and wait for their question. Do not begin analysis."
3. Sidecar streams text, backend pipes through TTS, stores resulting audio in Supabase Storage `voice-greetings/{conversation_id}.opus`.
4. Backend returns signed URL. Frontend plays on UX open.

Greeting copy is **generated per-session** by the agent (grounded in SOUL), not hardcoded. Default SOUL hint: "Terse, conversational, Harper-voiced. Examples: 'What are we looking at?', 'Ready when you are.'"

## §4 — Frontend rim UX

**Electron window chrome**: create `electron/window-chrome-voice.ts`. When voice session active, set a 3px accent-gold border on the BrowserWindow via `setContentProtection` + a custom `titleBarOverlay` style. The rim pulses subtly (2s cycle, opacity 0.6→1.0→0.6) when the agent is speaking; solid at 0.8 when listening; 0.4 when idle.

**Web/mobile overlay**: for non-Electron surfaces, matching behavior via a CSS-only outline on the outermost app container. Pointer-events: none, so it never intercepts trading clicks.

**Transcript ticker**: single-line scrolling text at the top-center of the rim, shows the last 120 chars of agent speech as it streams. Silent when idle. Dismiss button at top-right corner of the rim. No modal, no panel, no overlay that covers content.

Component locations:

- `frontend/components/voice/VoiceRimFrame.tsx` — the rim component, reads session state from existing `useVoice()` context
- `frontend/components/voice/VoiceTranscriptTicker.tsx` — scrolling transcript element
- `electron/window-chrome-voice.ts` — Electron-side window decoration hooks
- Mount point: `frontend/App.tsx` (or nearest root that's above every route)

Reuse [`frontend/components/voice/HeaderVoiceControl.tsx`](frontend/components/voice/HeaderVoiceControl.tsx) mic button + `useVoice()` context. Don't build a second activation affordance — the existing mic icon starts the session.

## §5 — Target latency

- **End-of-user-speech → first agent audio byte: < 2 seconds.**
- Critical path: STT (~400ms) → sidecar `/v1/chat` first token (~500ms) → TTS first chunk (~400ms) → network + playback init (~200ms) ≈ 1.5s median, 2.0s p95.
- Overlap aggressively: start TTS on the first text delta, don't wait for full reply. Stream audio chunks as TTS produces them.
- If p95 exceeds 2s in load test, fallback: switch voice agent to a smaller Qwen model via routing override (see T9) + log quality-drop telemetry.

## §6 — Interrupt + resume

- Frontend emits `POST /api/voice/session/interrupt` when user starts speaking mid-agent-reply (detected via VAD — existing voice context should have this).
- Backend cancels in-flight chat + TTS streams, marks the partial reply as truncated in conversation history.
- New user turn proceeds normally. Agent is told via system prompt injection that the prior reply was cut off — do not re-narrate.

## §7 — Tests (this feature NEEDS tests to prove it works this time)

End-to-end integration test in `backend-hono/test/voice-assistant.test.ts`:

1. Load a fixture audio clip asking "What's NQ doing?"
2. Call `/api/voice/session/start` → assert greeting audio is non-empty.
3. Call `/api/voice/session/turn` with the clip → assert SSE stream produces `transcript` (non-empty), `text` (non-empty), `audio` (non-empty bytes) events in order.
4. Measure end-of-user-audio → first `audio` event latency. Assert < 2.5s (CI-tolerant; local target < 2s).
5. Mid-stream, emit `/api/voice/session/interrupt` → assert remaining SSE events stop within 200ms.
6. Call `/api/voice/session/end` → confirm conversation persisted.

Frontend Playwright test in `frontend/test/voice-rim.spec.ts`:

1. Mount app, click mic → rim appears around window.
2. Assert rim does NOT cover any element with `data-testid="trading-view-*"`.
3. Wait for greeting to play (mock audio) → assert transcript ticker shows text.
4. Click dismiss → rim disappears, no data loss in conversation log.

## Files to touch

- NEW `backend-hono/src/services/ai/sidecar-voice-client.ts` (typed wrapper around `/v1/voice/*`)
- NEW `backend-hono/src/routes/voice/session.ts` (new session endpoints)
- NEW `backend-hono/test/voice-assistant.test.ts`
- NEW `frontend/components/voice/VoiceRimFrame.tsx`
- NEW `frontend/components/voice/VoiceTranscriptTicker.tsx`
- NEW `frontend/test/voice-rim.spec.ts`
- NEW `electron/window-chrome-voice.ts`
- EDIT `backend-hono/src/services/voice-service.ts` (sidecar proxy, drop OpenAI direct calls)
- EDIT `backend-hono/src/routes/voice/handlers.ts` (mount new session routes)
- EDIT `backend-hono/src/routes/voice/index.ts` (route registration)
- EDIT `frontend/components/voice/HeaderVoiceControl.tsx` (call new session-start endpoint)
- EDIT `frontend/lib/voice/useVoice.tsx` or equivalent context (add session state, interrupt handler)
- EDIT `frontend/App.tsx` (mount `VoiceRimFrame` at root)
- EDIT `electron/main.ts` (wire window-chrome-voice)
- EDIT `hermes-sidecar/config.yaml` (voice plugin registration — coordinate with W1b)
- EDIT `src/lib/changelog.ts`

## Validation

See §7 tests. Plus live smoke:

1. Fresh install, start local launchd backend + sidecar, open Fintheon, click mic.
2. Rim appears, greeting plays within 500ms of first click.
3. Say "What's the macro read for tomorrow?" — agent transcribes accurately, responds within 2s in Harper's voice tone.
4. Say "Actually, what about NQ levels?" mid-response → agent cuts off mid-sentence cleanly; new reply begins.
5. Trading view remains fully visible and clickable throughout; no modal, no overlay covers content.
6. Dismiss rim → conversation saved, reopen mic → previous context accessible via `/api/voice/session/start?conversation_id=...`.

## Ship

`v.27.7` when W2c merges to `v5.22`.
