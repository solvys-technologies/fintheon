# Sprint Brief: S42-T4 — Dual-Pane Artifact Preview

## Context

Modern chat interfaces (ChatGPT, Claude) ship an **artifact preview pane**: chat-on-left, artifact-on-right. Fintheon already has dual-pane plumbing in `ChatInterface.tsx` (`dualPane` + `showArtifacts` state, hard-coded to mount only when `surfaceId === "chat"`). This track extends that plumbing to a real artifact system: agents emit `{type:"artifact", kind, payload}` events (T1), the pane renders the appropriate slot (TradingView iframe, browserbase live browser, agent HTML report, or scroll-pinned citation source). Mobile gets a bottom-sheet equivalent (`ArtifactSheet`).

The pane reuses **existing** `EmbeddedBrowserFrame.tsx` for iframes (TradingView + browserbase) and **existing** `ReportViewer.tsx` for HTML reports — no parallel iframe wrapper.

## Branch Target

`s42-t4-artifact` (cut from worktree `~/Desktop/Codebases/fintheon-s42-chat-sota` off `v5.28.0`)

## Scope — Included

### Web

- [ ] Extend `frontend/components/ChatInterface.tsx` dualPane logic (lines 162-217) — split the right pane into a real `<ArtifactPane>` instead of inline JSX
- [ ] NEW `frontend/components/chat/ArtifactPane.tsx` — right-side container, resizable (default 60/40), collapse-X button, slides in via `t-panel-slide`
- [ ] NEW `frontend/components/chat/ArtifactSlot.tsx` — switch on `kind` prop, renders one of: `tradingview`, `browserbase`, `report`, `citation`
- [ ] Listen to `BridgeStreamEvent { type: "artifact" }` and to `fintheon:artifact` CustomEvent (T3 dispatches when CitationChip is clicked)

### Mobile

- [ ] NEW `mobile/components/chat/ArtifactSheet.tsx` — bottom-sheet container, swipe-up to expand to full-screen, swipe-down to dismiss
- [ ] Mount in `mobile/components/chat/ChatPage.tsx` shell-level (alongside ChatList, NOT inside the message list)

### Both

- [ ] Artifact slot types implemented:
  - `tradingview` — `<EmbeddedBrowserFrame url="https://www.tradingview.com/chart/?symbol={ticker}" />`
  - `browserbase` — `<EmbeddedBrowserFrame url={browserbaseSessionUrl} mode="browserbase" />` (T5 wires `mode` prop on EmbeddedBrowserFrame)
  - `report` — `<ReportViewer html={...} />` (existing srcDoc HTML report viewer)
  - `citation` — scroll-pinned source card (RiskFlow item / SEC filing snippet / Arbitrum verdict summary) with link out
- [ ] Pane persists across messages until user closes or new artifact replaces

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/chat/FintheonComposer.tsx` (T2)
- `frontend/components/chat/MessageQueue.tsx` (T2)
- `frontend/components/chat/FintheonStreamingBubble.tsx` (T3)
- `frontend/components/chat/CitationChip.tsx` (T3 — T4 only listens to its dispatched events)
- `frontend/components/chat/AgentActivityRail.tsx` (T3)
- `frontend/components/layout/EmbeddedBrowserFrame.tsx` — T5 owns the `mode="browserbase"` extension; T4 just consumes it
- `frontend/components/chat/ReportViewer.tsx` — preserved verbatim, T4 only mounts it inside ArtifactSlot
- `frontend/components/narrative/SanctumChart.tsx` — Sanctum's pinned chart preserved as-is
- `frontend/components/narrative/Sanctum.tsx` chartMode toggle — untouched (separate from chat artifact pane)
- `mobile/components/chat/ChatInput.tsx` (T2)
- `mobile/components/chat/ChatMessage.tsx` (T3)
- `backend-hono/*` (T1, T5)
- T7 mount perf — T4 only adds artifact pane mounting, does not gate first paint

## Reuse Inventory

- `EmbeddedBrowserFrame` at `frontend/components/layout/EmbeddedBrowserFrame.tsx:28-33` — webview on Electron, sandboxed iframe in browser. T4 instantiates with TradingView and browserbase URLs.
- `ReportViewer` at `frontend/components/chat/ReportViewer.tsx:1-95` — `srcDoc` HTML render with theme injection. T4 wraps in ArtifactSlot for `kind: "report"`.
- `ChatInterface.tsx` existing `dualPane` + `showArtifacts` state at lines 28-49, 162-217 — extend, do NOT replace
- `solvys-transitions`: `t-panel-slide` for pane open/close, `t-badge` for tab indicators
- BridgeStreamEvent `{type:"artifact",...}` from T1's extended types
- `fintheon:artifact` CustomEvent dispatched by T3's CitationChip
- Mobile bottom-sheet pattern — search `mobile/components/` for any existing sheet primitive (HeadlinePicker uses one); reuse the gesture handler if available

## Known Issues to Preserve

- Sanctum's chart-mode 50/50 split (separate from chat) — do not touch
- ConsiliumHub research iframe (preload pattern at `MainLayout.tsx:935-952`) — do not touch
- ChatInterface's existing transition `duration-[240ms]` — match this with `t-panel-slide` timing for visual continuity

## Implementation Steps

1. **Audit `ChatInterface.tsx` lines 162-183** — current right pane is inline JSX. Extract into `<ArtifactPane>` while preserving:
   - `w-96` collapse-X button behavior
   - 240ms slide transition
   - Mount only when `surfaceId === "chat"` (memory: surfaceId pattern)
2. **Create `ArtifactPane.tsx`**:
   - Props: `currentArtifact: ArtifactPayload | null, onClose: () => void`
   - Renders `<ArtifactSlot artifact={currentArtifact} />` inside
   - Resizable handle on left edge (default 60% chat / 40% artifact, drag to resize, persist to localStorage `fintheon:artifactSplit`)
   - Slide-in via `t-panel-slide` when `currentArtifact !== null`
   - X button calls `onClose`
3. **Create `ArtifactSlot.tsx`**:
   - Props: `artifact: { kind, payload }`
   - Switch on `kind`:
     - `tradingview` → `<EmbeddedBrowserFrame url={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(payload.symbol)}`} />`
     - `browserbase` → `<EmbeddedBrowserFrame url={payload.sessionUrl} mode="browserbase" />` (T5 adds the `mode` prop)
     - `report` → `<ReportViewer html={payload.html} />`
     - `citation` → flat surface with source title, snippet text, "Open source ↗" link to `payload.url` if present
4. **Wire artifact state in `ChatInterface.tsx`**:
   - State: `const [currentArtifact, setCurrentArtifact] = useState<ArtifactPayload | null>(null)`
   - Listen to BridgeStreamEvent `{type:"artifact",...}` from chat stream → `setCurrentArtifact({kind, payload})`
   - Listen to `window.addEventListener('fintheon:artifact', e => setCurrentArtifact(e.detail))` for citation chip clicks
   - Pass `currentArtifact` to `<ArtifactPane>`; pass `onClose={() => setCurrentArtifact(null)}`
5. **Mobile sheet**:
   - Create `mobile/components/chat/ArtifactSheet.tsx` — fixed bottom container (`bottom-0`, full-width, sliding up via `t-panel-slide`), with header bar + drag handle
   - Use existing mobile gesture pattern (search `mobile/components/` for swipe handlers)
   - Same `<ArtifactSlot>` inside
   - Mount in `mobile/components/chat/ChatPage.tsx` at the page-shell level (sibling of message list, not inside it)
   - Three states: closed, peek (40vh), full (95vh) — swipe up advances, swipe down retreats
6. **Persistence**: `currentArtifact` persists across messages within a conversation; reset only when user closes (X button) or new `artifact` event arrives

## Acceptance Criteria

- [ ] Artifact pane mounts when `currentArtifact !== null`; slides in with `t-panel-slide`; collapses to 100% chat width when closed
- [ ] Pane is resizable on web (drag the left edge); split persists in localStorage
- [ ] Send message that triggers tool call returning a TradingView artifact (mock until T1+T5 deployed: `window.dispatchEvent(new CustomEvent('fintheon:artifact', {detail:{kind:'tradingview', payload:{symbol:'NVDA'}}}))` in console) → pane mounts with TradingView NVDA chart loaded
- [ ] CitationChip click in T3 → ArtifactPane opens with citation source slot
- [ ] Agent emits `{kind:'report', payload:{html:...}}` → ArtifactPane mounts ReportViewer with that HTML
- [ ] Agent emits `{kind:'browserbase', payload:{sessionUrl:...}}` → ArtifactPane mounts EmbeddedBrowserFrame with that URL (T5 must have shipped `mode="browserbase"` prop for this to fully work; degrade to plain iframe if not)
- [ ] Mobile: swipe up on bottom sheet expands to peek then full; swipe down retreats; X button dismisses entirely
- [ ] Sanctum's pinned TradingView chart (separate from this) still works exactly as before
- [ ] `cd frontend && npx tsc --noEmit --project tsconfig.json` clean
- [ ] `cd mobile && npx tsc --noEmit` clean
- [ ] `cd frontend && rm -rf dist && npx vite build` clean
- [ ] `cd mobile && rm -rf dist && npx vite build` clean

## Validation Commands

```bash
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx tsc --noEmit --project tsconfig.json
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx tsc --noEmit

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx vite build

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx vite build
```

## Banned Ornaments

- No gradients, no emojis, no Kanban borders, no AI sparkles, no glassmorphic surfaces — flat + accent border for the pane chrome

## Commit Format

```
[v5.29.0] feat: T4 dual-pane ArtifactPane (TradingView/browserbase/report/citation) + mobile ArtifactSheet
```
