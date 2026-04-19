# S27-T5 — Agent-Voiced Briefs (Track C, part 2 of 2)

## Inspiration

[jamiepine/voicebox](https://github.com/jamiepine/voicebox) — open-source voice synthesis studio. Qwen3-TTS + Whisper, supports voice cloning. Relevant here for the idea of **per-agent voice identity** at brief-generation time, not on-demand at render time.

## The Gap

Audit finding:

> "MDB/ADB/PMDB/TOTT briefs are text-only. There is no route that pipes brief output through TTS. The `/api/voice/speak` endpoint calls `synthesizeVoice` for Hermes (CAO) replies in a voice conversation context — not for briefs."

Result: TP reads briefs silently. A core product moment (morning brief, post-close brief) has no audio channel.

## Design Choice

Two paths were considered:

1. **Self-hosted voicebox (Qwen3-TTS)** — higher setup cost (GPU, MLX or CUDA), full voice-clone control. Deferred.
2. **OpenAI TTS (already wired)** — 6 distinct voices (alloy, echo, fable, onyx, nova, shimmer), `gpt-4o-mini-tts` already in `voice-service.ts`, zero infra. **Chosen for S27.**

If TP later wants cloned agent voices, the voice-ID mapping table added here is the swap point — change `provider: 'openai'` to `provider: 'voicebox'` per agent without touching the brief pipeline.

## Branch / Worktree / CWD

Same worktree as T4: `/Users/tifos/Desktop/Codebases/fintheon-s27-c`, branch `s27-c-capabilities`. T4 lands first; T5 stacks on top.

## Scope — Included

### 1. Agent voice map

Create [`backend-hono/src/config/agent-voices.ts`](backend-hono/src/config/agent-voices.ts):

```ts
export const AGENT_VOICES = {
  harper: { provider: "openai", voice: "nova", style: "confident, executive" },
  oracle: {
    provider: "openai",
    voice: "shimmer",
    style: "analytical, measured",
  },
  feucht: { provider: "openai", voice: "onyx", style: "terse, trader-floor" },
  consul: { provider: "openai", voice: "echo", style: "deliberate, macro" },
  herald: { provider: "openai", voice: "fable", style: "newsroom, paced" },
} as const;
```

`style` is appended to the TTS prompt as steering guidance (OpenAI `gpt-4o-mini-tts` supports free-text style hints).

### 2. Brief section attribution

Each brief today is a monolithic markdown blob. For audio, sections need to be tagged with the authoring agent so the right voice reads them.

Update brief generators under [`backend-hono/src/services/briefs/`](backend-hono/src/services/briefs/) (audit exact path) to emit a structured sections array alongside the markdown:

```ts
type BriefSection = {
  agent: keyof typeof AGENT_VOICES;
  heading: string;
  body: string; // plain text, no markdown syntax (TTS can't speak `**bold**`)
};
```

Persist sections alongside the existing brief text in Supabase (existing `briefs` table gets a new `sections jsonb` column — migration `supabase/migrations/20260419_brief_sections.sql`).

If a brief is authored by Harper-Opus synthesizing across desks, the generator should split the synthesis into per-desk sections based on the existing agent-prefix headings Harper already writes (e.g., "## Macro (Consul)" → tag `consul`).

### 3. Pre-render pipeline

At brief generation time (inside the MDB/ADB/PMDB/TOTT generator), after the text is final:

- For each `BriefSection`, call `synthesizeVoice(section.body, AGENT_VOICES[section.agent])` via the existing `voice-service.ts` helper.
- Upload each resulting mp3 to Supabase Storage bucket `brief-audio` with key `{brief_type}/{brief_id}/{section_idx}-{agent}.mp3`.
- Also render a **combined** mp3 (sections concatenated with 600ms silence between) at `{brief_type}/{brief_id}/full.mp3`. Use `ffmpeg` via existing infra (if not present, fall back to serving sections sequentially on the client).
- Store signed URLs (7-day expiry) in the new `audio_urls jsonb` column on the `briefs` row.

Failure handling: if TTS fails for any section, log + continue. The brief text still ships. Frontend shows a "audio unavailable" state for that section only.

### 4. Route addition

Add `GET /api/data/brief/audio?type=MDB&id=…` to [`backend-hono/src/routes/data/brief.ts`](backend-hono/src/routes/data/brief.ts). Returns the `audio_urls` map for a brief. No auth change — same JWT gate as `/api/data/brief/latest`.

### 5. Frontend playback control

New component [`frontend/components/briefs/BriefPlayer.tsx`](frontend/components/briefs/BriefPlayer.tsx):

- Glass pill at the top of the brief body with: play/pause, section skip, current-agent indicator ("CONSUL" in accent gold), elapsed time.
- Audio element reads from the `full.mp3` URL; section skip seeks to known timestamps (generator emits a `section_offsets` array alongside URLs).
- Reduced-motion: no waveform animation. Just a static accent underline that fills as playback progresses (CSS transition, no JS tick).

Wire into the existing brief viewer in Consilium. Audit existing brief component path; likely `frontend/components/briefs/BriefViewer.tsx` or under Sanctum.

### 6. Backfill job

One-time script [`backend-hono/scripts/backfill-brief-audio.ts`](backend-hono/scripts/backfill-brief-audio.ts) to render audio for the last 30 days of briefs. Runs manually after deploy. Rate-limited to 10 briefs/minute to stay under OpenAI TTS quota.

## Scope — Excluded

- Voicebox (Qwen3-TTS) self-hosting — deferred. Voice map schema leaves the door open.
- Voice-cloned agent voices — deferred.
- Brief-time voice selection UI (TP picks voice per agent via env or config edit, not in-app).
- Mobile playback — backend + desktop only. Mobile gets it free once frontend lands since the PWA mirrors the same React.
- Real-time streaming TTS — pre-render only. Faster on the client, predictable cost.

## Validation

1. `cd backend-hono && bun run build` clean.
2. Trigger a fresh MDB via `POST /api/data/brief/generate` with type `MDB`. Expect: brief row has `sections`, `audio_urls.full`, and `audio_urls.sections[]` populated.
3. Open the brief in Consilium — BriefPlayer pill appears, play produces audio, section skip changes the current-agent indicator.
4. Kill OpenAI API key temporarily, regenerate brief — text renders, audio pill shows "audio unavailable."
5. Backfill script runs against last 7 days of briefs without rate-limit errors.
6. Restart local launchd backend + confirm `/api/diagnostics` green.

## Files to Touch

- NEW `backend-hono/src/config/agent-voices.ts`
- NEW `backend-hono/scripts/backfill-brief-audio.ts`
- NEW `frontend/components/briefs/BriefPlayer.tsx`
- NEW `supabase/migrations/20260419_brief_sections.sql`
- EDIT `backend-hono/src/services/briefs/*.ts` (generators — one per brief type)
- EDIT `backend-hono/src/services/voice-service.ts` (extend `synthesizeVoice` to accept style hint)
- EDIT `backend-hono/src/routes/data/brief.ts` (new audio route)
- EDIT `frontend/components/briefs/BriefViewer.tsx` (audit exact name; mount BriefPlayer)
- EDIT `src/lib/changelog.ts`

## Ship

Commit prefix: `v.27.3`. Second commit on the Track C branch after T4.
