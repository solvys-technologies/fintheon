# Sprint Brief: S32-T2 — Harper Vision Refinement (Kimi's work, fixed)

## Context

Sprint 2 of the Super Sprint — **Harper 2.1**. Kimi's Harper Vision work (13 new files, 11 modified) landed unstaged and has real value but is not ship-ready. Audit verdict: **refine, don't throw out** — the architecture is sound (Electron `desktopCapturer`, Supabase + pgvector, HTTP chunk POST, hidden BrowserWindow for audio), migration is defensive, route handlers are complete. The problems are fixable.

This track fixes the four real defects the audit surfaced, plus wires the promised-but-not-delivered behaviors (trigger dispatch, frame description LLM, privacy mode, glass removal).

## Branch Target

`s32-harper-2-1` (cut fresh off `main` after S32-T1 Kimi rollback lands — **sequential dependency, not parallel**).

## Scope — Included

### Build-blocker fix (must be first)

- [ ] `backend-hono/src/services/harper-vision/engine.ts:158` — `result.confidence` does not exist on `VoiceTranscribeResult`. Either:
  - Remove the assignment (simplest), OR
  - Add `confidence?: number` to `VoiceTranscribeResult` in `voice-service.ts` and populate it when the provider returns one
- [ ] Verify: `cd backend-hono && bun run build` passes

### Frame description wire-up (turn the stub into a real thing)

- [ ] `backend-hono/src/services/harper-vision/frame-store.ts:91-99` — replace the `generateDescriptionAsync` stub (currently a TODO + log) with a real call path:
  - Call Claude Opus 4.6 via VProxy (`localhost:8317`) with a structured prompt: "Describe this trading-desk screen in ≤120 chars. Identify: app in focus, visible symbol, chart timeframe, any P&L or order ticket visible. Terse."
  - Route via existing VProxy client (reinstated in S32-T1)
  - Store result in `harper_vision_frames.description`
  - Generate embedding (existing pgvector column) via existing embedding service
  - Keep async — do NOT block the frame-ingestion POST

### Trigger dispatch wire-up (the headline feature)

- [ ] `engine.ts` `detectTriggers()` returns `HarperVisionTrigger[]` but nothing routes them. Add a `dispatchTriggers(triggers, userId)` function that:
  - Maps each trigger to the correct desk agent (`feucht`/`oracle`/`herald`/`consul`)
  - Calls the existing boardroom DAG or desk-agent chat endpoint (grep existing `/api/harper/chat` boardroom-mode logic; reuse — do not re-implement)
  - Rate-limits to prevent agent-spam: max 1 dispatch per trigger-type per 10-minute window per user
- [ ] Call `dispatchTriggers` from the `POST /api/harper-vision/triggers` route handler at `backend-hono/src/routes/harper-vision/index.ts:91`

### Privacy mode wire-up

- [ ] `frontend/components/harper-vision/VisionPanel.tsx:25, 203-222` — `privacyMode` is local-state-only. Wire it through:
  - On toggle, call `window.electron.harperVision.setPrivacyMode(boolean)` (add IPC handler in `electron/main.cjs` + preload)
  - In `electron/services/harper-vision-screen.cjs`: when privacy mode is true, `_captureAndSend()` returns early (skip capture, don't POST)
  - Same gate on `electron/services/harper-vision-audio.cjs`
  - Persist the flag in `electron-store` so it survives restart
  - VisionStatus eye indicator turns red when privacy mode is active

### Glass effect removal (per memory)

- [ ] `frontend/components/harper-vision/VisionPanel.tsx:30` — remove `backdropFilter: "blur(20px) saturate(1.4)"`
- [ ] Line 62 — change `hover:bg-white/5` to `hover:bg-[#c79f4a]/10` (Solvys Gold alpha tick, not white)
- [ ] Line 29 — keep `rgba(10, 9, 5, 0.85)` (dark alpha, acceptable per memory — no blur)
- [ ] Replace with: flat `#0a0905` background + thin `#c79f4a` border + no blur (per `feedback_no_glass_effects.md`)

### Status endpoint completion

- [ ] `backend-hono/src/routes/harper-vision/index.ts:136` — `GET /status` is stubbed with hardcoded `{ isCapturing: false, sessionId: null }`. Implement real status:
  - Query recent frames (last 30s) → `isCapturing` = count > 0
  - Return current `sessionId` from session store (if not already a pattern, track in-memory map keyed by userId)
  - Return frame count, last-frame timestamp, last-transcript timestamp

### Storage bucket creation (ship-blocker)

- [ ] Add bucket-create migration `backend-hono/migrations/034_harper_vision_storage.sql`:
  ```sql
  -- Idempotent: will be a no-op if bucket already exists
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('harper-vision', 'harper-vision', false)
  ON CONFLICT (id) DO NOTHING;
  ```
  (If Supabase storage bucket creation must go via the dashboard UI, instead: add a one-page doc `docs/ops/harper-vision-storage-bucket.md` with the exact steps for TP.)

### Retention janitor (storage cost control)

- [ ] Wire the existing `cleanup_harper_vision_frames()` SQL function (from migration 030) to run daily
- [ ] Add a Routine doc `docs/routines/harper-vision-cleanup.md` — daily 3am ET, calls new gated endpoint `POST /api/harper-ops/harper-vision-cleanup` which invokes the SQL function

### Changelog + headers

- [ ] Changelog entry for every fix
- [ ] `// [claude-code 2026-04-23] S32-T2 Harper Vision refinement` atop each modified file

## Scope — Excluded (DO NOT TOUCH)

- VProxy client itself — already reinstated by S32-T1
- Migration `030_harper_vision.sql` — already in tree, idempotent, fine
- Mobile PWA vision read-only UI — deferred to a later sprint
- System audio capture (mic-only for now) — deferred
- Global hotkey (`Cmd+Shift+H`) — deferred
- Vision timeline gallery — deferred
- Multi-display support — deferred
- Anything unrelated to Harper Vision or the four defects above

## Known Issues to Preserve

- S32-T1 (Kimi rollback) strips Kimi K2 + GitHub Models routing + reinstates VProxy. **T2 must come AFTER T1 merges.** Harper Vision's prompt-injection depends on VProxy being live as primary.
- `harper_vision_frames` + `harper_vision_transcripts` tables + RLS policies in migration 030 are correct — do not rewrite.
- `generateDescriptionAsync` is intentionally async (fire-and-forget) — keep that contract.
- Kimi's design decisions are sound: Electron `desktopCapturer`, Supabase + pgvector, HTTP chunk POST, hidden BrowserWindow. Do not re-architect.

## Implementation Order

1. Fix TS build error (engine.ts:158). Build passes.
2. Wire privacy mode IPC + backend gating.
3. Remove glass effects from VisionPanel.
4. Wire `generateDescriptionAsync` through VProxy vision call.
5. Wire `dispatchTriggers` to existing boardroom/desk-agent endpoints.
6. Implement real `/status` endpoint.
7. Add storage bucket migration (or ops doc).
8. Add retention cleanup Routine.
9. Smoke test end-to-end: start capture → screen → ask Harper "what do you see?" → confirm description is semantic, not just `app=Chrome, window=...`.

## Acceptance Criteria

- [ ] `cd backend-hono && bun run build` passes (TS error gone)
- [ ] Starting capture then triggering a chart pattern in-app dispatches Feucht via boardroom DAG (verify in backend logs)
- [ ] Privacy toggle actually stops capture: no new frames in `harper_vision_frames` while on
- [ ] `VisionPanel` has zero `backdropFilter` / `blur()` / `bg-white/` usage
- [ ] `GET /api/harper-vision/status` returns real `isCapturing`, not hardcoded false
- [ ] Asking Harper "what am I looking at?" during capture returns a semantic description, not just window title
- [ ] `POST /api/harper-ops/harper-vision-cleanup` with Routine secret deletes frames >24h old; without secret returns 401
- [ ] All modified files <300 lines
- [ ] Changelog entry added

## Validation Commands

```bash
cd backend-hono && bun run build
cd ..
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Glass-effect gate
grep -r "backdropFilter\|backdrop-blur\|bg-white/" frontend/components/harper-vision/ && echo "FAIL: glass residue" || echo "OK"

# Smoke
curl -s http://localhost:8080/api/harper-vision/status | jq .
```

## Commit Format

```
[v5.23.0] feat: S32-T2 Harper Vision refinement — TS fix, trigger dispatch, privacy wire, LLM descriptions, glass removal
```
