# Sprint Brief: S28-T1 — Voice Pipeline Rewire + Harper Chat JSON Leak

## Context

S21 (v5.22.10) shipped Omi integration, but TP's first live test revealed:

- **Voice quality is broken.** Audio coming out of Fintheon isn't Omi's TTS — it's `speechSynthesis` with a default macOS voice. TP confirms Omi's own voice sounds fine when using the Omi app directly, so the fix is to route ALL agent speech through Omi's Notifications API.
- **System prompts are being spoken verbatim.** Screenshot showed "Give a brief, casual greeting. Mention the current time…" being read aloud. A prompt is reaching a TTS surface somewhere in the pipeline — likely `useVoiceSession` pre-renders a greeting and feeds the prompt instead of the model's response to the TTS.
- **Harper chat renders raw dossier JSON in replies.** Screenshot shows `{"agentId":"feucht","name":"Feucht","title":"Futures Execution Desk","role":"flow-analyst",...}` rendered as message text. Either SOUL loader's `grounding.extra` is being appended to the user-facing reply or the chat renderer isn't escaping tool-call/structured responses.

Decision (locked): **all agent-to-user speech routes through Omi's `POST /v1/dev/user/notifications` with `speak:true`**. No browser `speechSynthesis` calls remain.

## Branch Target

`v5.23`

## Scope — Included

- [ ] Audit every call site that produces spoken audio. Primary suspects: `frontend/contexts/VoiceContext.tsx`, `frontend/hooks/useVoiceSession.ts`, `frontend/hooks/useVoiceAssistant.ts`, `backend-hono/src/routes/voice/*`, `backend-hono/src/services/voice/*` (voice-sidecar).
- [ ] Remove `window.speechSynthesis.speak()` calls. Replace with a call to `POST /api/omi/notify` (existing endpoint from S21) which wraps Omi's Notifications API. If the user isn't paired, fall through silently (log only) — do not substitute a browser voice.
- [ ] Fix the "system prompt being spoken" bug. Trace `useVoiceSession.ts` — specifically the `/api/voice/session/start` sidecar that "pre-renders Harper's greeting + plays it." Ensure the TTS input is the _model response text_, not the system prompt.
- [ ] Harper chat JSON leak: investigate `backend-hono/src/services/harper-handler.ts` and `backend-hono/src/services/ai/agent-instructions/index.ts`. Likely cause: `grounding.extra` from SOUL loader being appended to the message body instead of the system prompt, or a tool-use block serialized as plain text. Fix at the source (don't just filter on the client).
- [ ] Add a small `backend-hono/src/services/omi/speak.ts` helper that all agent speech funnels through. It takes `{ userId, text }`, looks up the Omi pairing, calls `sendNotification({ uid, message: text, speak: true })`. Returns silently on failure.
- [ ] Wire the Coach agent's response path through the new helper when a session is active.
- [ ] If `useVoiceSession` is redundant now, delete it (and the `/api/voice/session/start` + `/interrupt` sidecar routes). Otherwise leave it but neutralize its TTS.

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/layout/TopHeader.tsx` (T2).
- `frontend/components/layout/MainLayout.tsx` (T2).
- `frontend/components/voice/AgentResponsePopup*.tsx`, `WhiteWaveform.tsx`, `HeaderVoiceControl.tsx` (T2).
- `frontend/components/performance/PerformanceChatButton.tsx` (T2 is deleting it).
- `frontend/components/icon-bank/*` and everything T3 owns.
- Fuse components (`NothingFuse`, `VerticalFuseBar`) and adjacent spinners — never touch per standing rule.

## Known Issues to Preserve

- S21 webhook routes (`/api/omi/webhook/transcript|audio|memory|day-summary`) are hooked up in prod — don't rename or move them.
- S21 admin routes (`/api/admin/psych-assist-fork/*`) are gated on per-user override rows. Don't change middleware order.
- `backend-hono/src/services/omi/session-manager.ts` keeps session state in-memory per user — don't convert to Redis in this track.
- SOUL loader's behavior for Harper is used by many callers; fix the leak without changing how other agents (Oracle, Feucht, Consul, Herald) compose their prompts.

## Implementation Steps

1. **Find the speakers.** `grep -rn "speechSynthesis\|speak(\|SpeechSynthesis\|utterance" frontend/ backend-hono/src/`. Catalog every call site and what input each one speaks.
2. **Trace the pre-render path.** Read `frontend/hooks/useVoiceSession.ts` end to end. Identify whether it POSTs to `/api/voice/session/start`, what that endpoint returns, and whether it plays an audio blob or calls speechSynthesis with returned text. The "system prompt spoken aloud" bug lives on this path — find exactly which variable gets passed to the TTS.
3. **Build the helper.** Write `backend-hono/src/services/omi/speak.ts` (exports `async function speakToUser(userId: string, text: string): Promise<void>`). Uses `getSupabaseClient()` → `omi_pairings.omi_uid` → `sendNotification({...})`. 20 lines.
4. **Rewire the Coach session response.** When the voice router picks Coach and the model returns text, call `speakToUser(userId, text)`. The existing `/api/omi/notify` authed endpoint already does this for client-triggered notifications — T1 adds the agent-triggered path.
5. **Neutralize the browser TTS.** In `VoiceContext.tsx` / `useVoiceAssistant.ts` / `useVoiceSession.ts`, remove all `window.speechSynthesis.*` usage. If an existing call depended on it (e.g., interrupt), replace with a no-op or a call to a new `/api/omi/interrupt` endpoint that stops the Omi notification playback (if Omi supports that — check their docs; if not, skip).
6. **Harper JSON leak.** Check `harper-handler.ts` for where it composes the final chat message. Read `agent-instructions/index.ts` for how SOUL is loaded + whether `grounding.extra` (the JSON block) gets appended to `messages[0].content` (system prompt — correct) or leaked into a user-facing assistant message (bug). Fix: ensure dossier JSON is only ever in the system message, never concatenated with the streamed response.
7. **Verify `/api/omi/notify` path works.** `curl -X POST https://fintheon.fly.dev/api/omi/notify -H "Authorization: Bearer $JWT" -d '{"message":"backend pipeline test"}'` — expect Omi voice in TP's ear.
8. **Regression.** Trigger a Harper chat message, confirm reply is clean prose. Trigger an Oracle/Feucht/Consul/Herald chat, confirm their dossier content is in the _system_ prompt only (view via `curl /api/diagnostics` or similar).

## Acceptance Criteria

- [ ] `grep -rn "speechSynthesis" frontend/` returns zero hits in src (node_modules/ignored).
- [ ] Starting an Omi voice session (any trigger) and getting a Coach response → user hears Omi's TTS voice, not a macOS system voice.
- [ ] No TTS output contains system-prompt phrases like "Give a brief, casual greeting."
- [ ] Harper chat reply to "what's your read on the market?" contains no raw JSON substrings like `{"agentId":` or `"role":`.
- [ ] `bun run build` in `backend-hono/` exits 0.
- [ ] `tsc --noEmit` on frontend exits 0.

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json

# Speech audit
grep -rn "speechSynthesis" frontend/ --include="*.ts" --include="*.tsx"

# Live Omi notification
curl -s -X POST https://fintheon.fly.dev/api/omi/notify \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"message":"S28 T1 pipeline test"}'

# Harper chat smoke (should return prose, not JSON)
curl -s -X POST https://fintheon.fly.dev/api/harper/chat \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"message":"one-line read on the tape"}' | head -c 400
```

## Commit Format

```
[v5.23] fix: T1 route all agent speech through Omi notifications + stop prompt leak + clean Harper chat
```
