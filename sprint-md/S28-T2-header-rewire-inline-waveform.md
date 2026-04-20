# Sprint Brief: S28-T2 — Ask Harp Header Rewire + Inline Waveform

## Context

S21 shipped a separate `PerformanceChatButton` in the header toolbar and a floating draggable popup (`AgentResponsePopup`) with a `WhiteWaveform` inside. TP rejected both:

- The header should have **one** chat button ("Ask Harp") that context-switches based on `activeTab`. On `/performance` it starts a Coach voice session; anywhere else it opens the existing Harper chat panel.
- The floating popup is gone. The waveform mounts **inline in the header toolbar** in an empty slot, visible only while a voice session is active. On dismiss (user clicks the mic/Ask Harp toggle to end), the waveform fades out.
- No border on the waveform slot. No X button. Lower chrome than the S21 popup.

## Branch Target

`v5.23`

## Scope — Included

- [ ] **Delete** `frontend/components/voice/AgentResponsePopup.tsx`.
- [ ] **Delete** `frontend/components/voice/AgentResponsePopupHost.tsx`.
- [ ] **Delete** `frontend/components/performance/PerformanceChatButton.tsx` (and the `performance/` dir if it ends up empty).
- [ ] Remove the `AgentResponsePopupHost` mount in `MainLayout.tsx` + the `performanceChatWidget={...}` prop + the `PerformanceChatButton` + `AgentResponsePopupHost` imports.
- [ ] Remove the `performanceChatWidget` prop from `TopHeader.tsx` signature + its conditional render.
- [ ] Locate the existing "Ask Harp" chat button in `TopHeader.tsx` (the one that currently toggles the Harper chat panel via the `onChatToggle` prop). Wrap its onClick to context-switch:
  - If `activeTab === "performance"` → call `useOmiSession().start("performance_chat")`. Do NOT toggle the chat panel.
  - Else → existing `onChatToggle()` behavior (open/close Harper chat panel).
- [ ] Repurpose `WhiteWaveform.tsx` for inline header use. Smaller size preset for the header slot (~18px tall, ~80px wide), no border, no chrome. Keep the existing amplitude-reactive animation.
- [ ] Mount the inline waveform in a new slot inside `TopHeader.tsx` — visible only when `useOmiSession().session?.status === "active"`. When session ends (user clicks Ask Harp again to toggle off, or backend returns status "ended"), fade the waveform out via CSS transition (opacity 1 → 0 over 400ms).
- [ ] Simplify `useOmiSession.ts`: drop the `emitAgentResponse` custom-event plumbing since no popup listens anymore. The hook still manages start/stop; the waveform reads `session` state directly.
- [ ] In `HeaderVoiceControl.tsx` (the mic button), keep the Voice Assistant trigger wire as-is. But when a session is active via _any_ trigger, the mic button's aurora orb should NOT also appear — the waveform owns "something is listening/speaking" indication now. Use `useOmiSession().session` to conditionally suppress aurora.

## Scope — Excluded (DO NOT TOUCH)

- Voice pipeline internals — `VoiceContext.tsx`, `useVoiceAssistant.ts`, `useVoiceSession.ts`, `/api/omi/*` backend (T1 owns).
- Harper chat handler — `backend-hono/src/services/harper-handler.ts` (T1 owns for the JSON leak).
- Icon bank — `frontend/components/icon-bank/*` and all consumers of `UnicodeSpinners` (T3 owns).
- Fuse components (`NothingFuse`, `VerticalFuseBar`) — never touch.
- `PsychAssistDockable.tsx` — keep the S21 changes in place (the MessageSquare button + mini waveform inside the widget). Only the _floating popup_ is gone, the dockable widget itself stays.

## Known Issues to Preserve

- `useDraggable.ts` is used by Bulletin, PsychAssistDockable, and DraggablePanel — do not change its signature.
- The `VoiceAuroraOrb` and its state machine in `useVoiceAssistant` still drive the mic-button's idle/listening/speaking/thinking visuals — don't remove it, just suppress it when an Omi session is active.
- `MainLayout.tsx` wraps layout with `DNDProvider` and `ScheduleProvider` — preserve the wrapper order.

## Implementation Steps

1. **Delete the dead S21 popup surfaces**: AgentResponsePopup.tsx, AgentResponsePopupHost.tsx, PerformanceChatButton.tsx. Remove imports from MainLayout and TopHeader.
2. **Remove `performanceChatWidget` prop**: in TopHeader.tsx delete the prop from the interface + destructure + the `{activeTab === "performance" && performanceChatWidget}` render.
3. **Find Ask Harp**: `grep -n "onChatToggle\|Ask Harp\|chatOpen" frontend/components/layout/TopHeader.tsx`. Identify the existing button. It's the one that receives `onChatToggle` as the click handler in the current prop list.
4. **Wrap the Ask Harp click handler**: inside TopHeader.tsx, import `useOmiSession`, read `activeTab` (already a prop). Replace the button's onClick with:
   ```tsx
   const omi = useOmiSession();
   const handleAskHarpClick = () => {
     if (activeTab === "performance") {
       if (omi.session?.status === "active") void omi.stop();
       else void omi.start("performance_chat");
     } else {
       onChatToggle?.();
     }
   };
   ```
5. **Add the inline waveform slot**: in TopHeader.tsx, find an empty slot in the toolbar row (next to the VIX readout / near the right-side controls). Mount:
   ```tsx
   {
     omi.session?.status === "active" && (
       <div
         className="flex items-center transition-opacity duration-400"
         style={{ opacity: 1 }}
       >
         <WhiteWaveform active width={80} height={18} barCount={20} />
       </div>
     );
   }
   ```
   Manage fade-out by keeping the element mounted for 400ms after `session` flips to null, with a local `visible` ref that flips false then true-to-remove via timeout.
6. **Suppress aurora when Omi session active**: in HeaderVoiceControl.tsx, pass `showOrb = enabled && orbState !== "idle" && !omiSession?.status === "active"` (or equivalent) so only one visual indicator appears at a time.
7. **Simplify useOmiSession**: drop the `emitAgentResponse` export + the `fintheon:agent-response` event. The hook now just returns `{ session, starting, start, stop }`. No more CustomEvent plumbing.
8. **Verify click flows in both tabs**:
   - `/performance` → Ask Harp → Omi session starts → inline waveform appears.
   - `/dashboard` (or any non-performance tab) → Ask Harp → Harper chat panel toggles.
9. **Visual check**: waveform slot has no border, no X, just the animation. Fade-out on dismiss is smooth.

## Acceptance Criteria

- [ ] `find frontend/components -name "AgentResponsePopup*.tsx" -o -name "PerformanceChatButton.tsx"` returns nothing.
- [ ] `grep -n "performanceChatWidget" frontend/components/layout/TopHeader.tsx` returns zero.
- [ ] On `/performance`, clicking Ask Harp fires `POST /api/omi/session/start` with `trigger:"performance_chat"` (visible in Network tab).
- [ ] Outside `/performance`, clicking Ask Harp opens/closes the Harper chat panel (existing behavior).
- [ ] Inline waveform appears in the header toolbar while an Omi session is active. No border, no dismiss X, just animation.
- [ ] Waveform fades out over ~400ms when the session ends.
- [ ] Aurora orb on the mic button is suppressed while an Omi session is active — no double indicator.
- [ ] `tsc --noEmit` on frontend exits 0.
- [ ] `rm -rf dist && npx vite build` exits 0.

## Validation Commands

```bash
# Dead code check
find frontend/components -name "AgentResponsePopup*.tsx" -o -name "PerformanceChatButton.tsx"

# Type check + build
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# Live (after deploy)
# /performance → click Ask Harp → curl -s https://fintheon.fly.dev/api/omi/session/active → expect active session
```

## Commit Format

```
[v5.23] refactor: T2 Ask Harp context-switch + inline waveform; delete S21 popup surfaces
```
