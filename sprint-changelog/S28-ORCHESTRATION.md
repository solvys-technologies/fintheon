# S28 — Voice Pipeline Rewire + Header Unification + Icon Bank Overhaul

**Branch:** `v5.23` (new minor bump — substantive voice + visual work beyond v5.22.10 polish scope)
**Sprint driver:** TP feedback post S21 ship (v5.22.10). Three unrelated surface issues surfaced on first live test.

## Context

S21 shipped the Omi voice layer (v5.22.10). On first live test TP reported three independent regressions/gaps:

1. **Voice quality is bad** — sounds like "a South Park turd." Omi's own TTS sounds fine in TP's Omi app, so the voice you heard in Fintheon is NOT going through Omi. The current sidecar / `speechSynthesis` path is speaking agent responses with a macOS default voice — and worse, the _system prompt text itself_ is being spoken verbatim ("Give a brief, casual greeting. Mention the current time…") which means the prompt is leaking into the TTS input.
2. **Header toolbar chat button duplication + floating popup UX** — S21 added a new `PerformanceChatButton` next to the existing "Ask Harp" chat button. TP doesn't want both. The existing Ask Harp button should context-switch: on /performance it fires a Coach voice session; elsewhere it opens the normal Harper chat. The floating draggable popup is gone — replace with an inline waveform rendered in an empty slot in the header toolbar. No border (or much lower opacity), no X button on the popup.
3. **Isometric icon bank is ugly** — the 2026-04-19 "Icon Bank — Unicode spinner library" pass (FishSwimmer, CircleQuarters, MeterBar, ArrowShimmer, MeterToShimmer, HelixVertical) doesn't look good in practice. TP pointed at <https://github.com/Eronred/expo-agent-spinners> (MIT, 54 terminal-style agent spinners, text-based, zero-dep) as the replacement bank. Port to React web + systematically swap every usage.

Also on deck (smaller, bundled with T1): the Harper chat renderer leaked raw agent-dossier JSON into a reply during testing. Screenshot shows `{"agentId":"feucht","name":"Feucht",...}` rendered literally in the chat bubble. Investigate whether SOUL loader is dumping grounding.extra raw or the chat renderer isn't escaping tool-call payloads.

**Decisions locked (Phase 1 discovery):**

- Voice → Omi Notifications API (all agent-to-user speech via `POST /v1/dev/user/notifications` with `speak:true`). Kill the `speechSynthesis` fallback path.
- Ask Harp on /performance → start Coach Omi voice session (not chat panel). Waveform inline in header toolbar, fade-out on dismiss.
- Icon bank → port <https://github.com/Eronred/expo-agent-spinners> (54 spinners). Replace the 2026-04-19 Unicode spinner pack everywhere.

## Outcomes

1. Every voice response the user hears comes out of Omi's TTS via the Notifications API — zero `speechSynthesis` calls remain. No more "South Park turd."
2. No system prompt ever reaches a TTS surface. The "Give a brief, casual greeting…" leak is gone at the source.
3. Single "Ask Harp" button in the header toolbar. On /performance → Coach voice session + inline waveform. Elsewhere → existing Harper chat panel. My new `PerformanceChatButton` is deleted.
4. `AgentResponsePopup` + `AgentResponsePopupHost` deleted. `WhiteWaveform` mounts inside the header toolbar in an empty slot. Fades out on dismiss.
5. Harper chat no longer renders raw dossier JSON in replies.
6. Every FishSwimmer / CircleQuarters / MeterBar / ArrowShimmer / MeterToShimmer / HelixVertical usage replaced with a ported expo-agent-spinner. Old `UnicodeSpinners.tsx` deleted or reduced to thin re-exports.

## Tracks

**T1 — Voice pipeline + chat leak** (backend-heavy, one file set)
File ownership: `backend-hono/src/services/omi/*`, `backend-hono/src/routes/omi.ts`, `backend-hono/src/services/harper-handler.ts`, `backend-hono/src/services/ai/agent-instructions/*`, `backend-hono/src/services/voice/*` (if exists), `frontend/hooks/useVoiceSession.ts`, `frontend/contexts/VoiceContext.tsx` (minor — remove speechSynthesis usage only).
Excluded: TopHeader.tsx, MainLayout.tsx, icon-bank/\*.

**T2 — Header rewire + inline waveform** (frontend voice surface)
File ownership: `frontend/components/layout/TopHeader.tsx`, `frontend/components/layout/MainLayout.tsx`, `frontend/components/voice/AgentResponsePopup.tsx` (DELETE), `frontend/components/voice/AgentResponsePopupHost.tsx` (DELETE), `frontend/components/voice/WhiteWaveform.tsx`, `frontend/components/voice/HeaderVoiceControl.tsx`, `frontend/components/performance/PerformanceChatButton.tsx` (DELETE), `frontend/components/performance/` (the directory may be fully removed), `frontend/hooks/useOmiSession.ts`.
Excluded: chat handler backend, VoiceContext internals (T1 owns).

**T3 — Icon bank overhaul** (frontend visual, isolated directory + audit)
File ownership: `frontend/components/icon-bank/*` (rewrite contents), plus grep-based edits to every consumer of `UnicodeSpinners` — `frontend/App.tsx`, `frontend/components/feed/RiskFlowMain.tsx`, `frontend/components/narrative/ArbitrumChamberPredictionCards.tsx`, `frontend/components/chat/FintheonThinkingIndicator.tsx`, `frontend/components/chat/FintheonThread.tsx`, and any newly-found consumers.
Excluded: TopHeader.tsx (T2), voice/ directory (T2), any fuse component or adjacent spinner per standing "Fuses are sacred" rule.

**T4 — Unification** — handled by the orchestrator (me), not a separate brief. Merges the three tracks, reconciles any TopHeader/layout overlap, and runs the full validation suite.

## Execution

### Wave 1 (parallel — three tracks, disjoint file sets)

```
@sprint-md/S28-T1-voice-pipeline-and-chat-leak.md
```

```
@sprint-md/S28-T2-header-rewire-inline-waveform.md
```

```
@sprint-md/S28-T3-icon-bank-agent-spinners.md
```

### Wave 2 (orchestrator unifies + validates)

The orchestrating Claude Code instance (this thread) will:

1. Verify T1 + T2 + T3 have all landed on `v5.23`.
2. Resolve any shared-import conflicts (likely in `MainLayout.tsx` and `TopHeader.tsx` where T2 and T3 might overlap on icon imports).
3. Run `bun run build` in `backend-hono/`, `tsc --noEmit` on frontend, and `rm -rf dist && npx vite build` at repo root.
4. Live smoke: trigger a voice session, confirm Omi's voice (not browser) speaks; navigate between /performance and /dashboard and confirm the Ask Harp button changes behavior correctly; scroll the app and confirm no lingering FishSwimmer/CircleQuarters renders.
5. Changelog + deploy via `/solvys-deploy`.

**Wave 1** splits three unrelated concerns so they don't block each other. T1 fixes voice + chat-leak backend-side while T2 reshapes the header UI. T3 is completely isolated (icon bank audit + port) and can land any time during or after Wave 1.

**Wave 2** is the integration + live test. No separate brief — orchestrator handles merge, regression checks, and deploy.

## Validation (full sprint)

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
cd mobile && rm -rf dist && npx vite build
```

Live smoke:

- Click Ask Harp outside /performance → Harper chat panel opens.
- Click Ask Harp on /performance → Coach voice session starts, waveform renders inline in header toolbar.
- Speak → Omi speaks response back in TP's ear with Omi's voice (confirm NOT browser voice).
- Chat with Harper via keyboard → reply is prose, no raw JSON dossier text in the message.
- Grep `grep -r "FishSwimmer\|CircleQuarters\|MeterBar\|ArrowShimmer\|MeterToShimmer\|HelixVertical" frontend/` → zero hits.

## Out of scope (explicit)

- OAuth pair flow for Omi (still manual pair endpoint only — follow-up sprint).
- PsychAssist widget visual re-polish beyond what S21 shipped.
- Onboarding UI for system permissions (TP is running this as a separate sprint).
- Deploy automation improvements (already done in S21 install-script refresh).
