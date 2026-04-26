# Sprint Brief: S42-T2 — Composer + cmdk Palette + MessageQueue Wiring

## Context

The desktop and mobile composers get a Brotzky-style keyboard-first upgrade. Cmd+K opens a global command palette (cmdk), `↑↓` recalls history, slash-commands (`/oracle`, `/feucht`, `/consul`, `/herald`) override persona for the next turn, `@TICKER` injects a ticker as context, `Esc` cancels in-flight stream. The orphaned `MessageQueue.tsx` component gets wired into chat state so users can queue messages mid-stream and offline. **All existing toolbar primitives (ToolsDropdown, HeadlinePickerPopover, FintheonAttachPopup, persona dropdown, Relay dispatch) are preserved** — they slot into the new `ComposerPrimitive.Root` toolbar without modification.

## Branch Target

`s42-t2-composer` (cut from worktree `~/Desktop/Codebases/fintheon-s42-chat-sota` off `v5.28.0`)

## Scope — Included

### Web

- [ ] Wrap `frontend/components/chat/FintheonComposer.tsx` in `<ComposerPrimitive.Root>` from `@assistant-ui/react`
- [ ] Wire `frontend/components/chat/MessageQueue.tsx` (currently orphan — exists but unused) into `ChatInterface.tsx` state
- [ ] NEW `frontend/components/chat/CommandPalette.tsx` using `cmdk`
- [ ] Cmd+K listener registered in `ChatInterface.tsx`
- [ ] `↑↓` arrow-key history recall in composer
- [ ] Slash-command persona override (`/oracle`, `/feucht`, `/consul`, `/herald`) at composer-input layer — passes overridden persona for one turn only
- [ ] `@TICKER` inline injection (regex `@[A-Z]{1,5}` → context attachment)
- [ ] `Esc` key cancels in-flight stream (call assistant-ui `cancel()` or existing abort handler)

### Mobile

- [ ] Wrap `mobile/components/chat/ChatInput.tsx` in `<ComposerPrimitive.Root>` from `@assistant-ui/react` (install package on mobile)
- [ ] NEW `mobile/components/chat/MessageQueue.tsx` (mirror web shape: `QueuedMessage[]` state + edit/remove buttons)
- [ ] Swipe-up gesture on the composer opens the same palette as a bottom sheet (no Cmd+K on phones)
- [ ] Long-press send to open MessageQueue editor

### Both

- [ ] MessageQueue behavior:
  - User sends → message goes to queue (visible above composer)
  - If stream is idle → flushes immediately
  - If mid-stream (any in-flight assistant turn) → waits for `complete` event, then flushes next
  - If offline (no `/api/diagnostics` health for 10s) → queues persistently in `localStorage` under key `fintheon:msgQueue:<conversationId>`, retries on reconnect
  - Edit/remove buttons in `MessageQueue.tsx` already exist — wire to state actions

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/chat/FintheonStreamingBubble.tsx` (T3)
- `frontend/components/chat/ToolsDropdown.tsx` (preserved verbatim — slot into composer toolbar)
- `frontend/components/chat/HeadlinePickerPopover.tsx` (preserved verbatim)
- `frontend/components/narrative/RiskFlowImportModal.tsx` (preserved verbatim)
- `frontend/components/chat/FintheonAttachPopup.tsx` (preserved verbatim)
- `frontend/lib/internalConnectors.ts` (preserved verbatim)
- `frontend/hooks/useMcpConnectors.ts` (preserved verbatim)
- `frontend/hooks/useRelayDispatch.ts` (preserved verbatim — Relay button stays in toolbar)
- Persona dropdown component (preserved — slash-commands are an additive override)
- `backend-hono/*` (T1)
- `frontend/components/ChatInterface.tsx` shell (extends, not rewrites — only composer mount + state wiring changes; T4 owns dual-pane extension; T7 owns mount perf)
- Refinement Engine S37 Advanced pane (memory: edit lock; reuse `dev-settings-auth` helpers without modifying them)
- TradingView Sanctum chart (T4 instantiates `EmbeddedBrowserFrame` separately)

## Reuse Inventory

- `<ComposerPrimitive.Root>` / `<ComposerPrimitive.Input>` / `<ComposerPrimitive.Send>` from `@assistant-ui/react@^0.12.15` (already in `frontend/package.json`) — primary primitive
- `MessageQueue.tsx` at `frontend/components/chat/MessageQueue.tsx` (orphan) — exists with `QueuedMessage { id, text, timestamp }` interface and edit/remove UI; just needs state wiring
- `useRelayDispatch` at `frontend/hooks/useRelayDispatch.ts:1-50` — keep relay button rendering inside composer toolbar
- `ToolsDropdown` at `frontend/components/chat/ToolsDropdown.tsx:1-80` — slot into `ComposerPrimitive` toolbar
- `HeadlinePickerPopover` at `frontend/components/chat/HeadlinePickerPopover.tsx:1-70` — slot into toolbar; mounted from headline-attach button
- `FintheonAttachPopup` at `frontend/components/chat/FintheonAttachPopup.tsx:1-60` — slot into attachment button
- `dev-settings-auth` helpers (existing keyboard registration pattern, per memory: Refinement Engine S37) — REUSE for Cmd+K + Esc registration
- Solvys-transitions `t-modal` for cmdk palette opening animation
- Existing circular ArrowUp send button (memory locked — never replace with airplane/Send icon)

## Known Issues to Preserve

- Send button MUST stay circular ArrowUp (memory: feedback_send_button_style)
- No glass effects: GlassEffect / backdrop-blur / box-shadow banned (memory: feedback_no_glass_effects)
- Image attach uses base64 data URLs — keep
- HeadlineChips with context injection — keep current shape

## Implementation Steps

1. **Install cmdk in frontend**: `cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && bun add cmdk`
2. **Install assistant-ui on mobile**: `cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && bun add @assistant-ui/react`
3. **Create `frontend/components/chat/CommandPalette.tsx`** using cmdk:
   - `<Command label="Fintheon">` with `<Command.Input>`, `<Command.List>`
   - Groups: Agents (`/oracle`, `/feucht`, `/consul`, `/herald`), Surfaces (Sanctum/Arbitrum/Strategium jumps), Recent messages (last 10 user messages)
   - Style with Solvys palette (`bg-[#050402]`, `border-[#c79f4a]`, `text-[#f0ead6]`) — flat surfaces, no glass
   - Animate open via `t-modal` (solvys-transitions)
4. **Wrap `FintheonComposer.tsx` in `<ComposerPrimitive.Root>`**:
   - Replace existing form/textarea wrapper with `<ComposerPrimitive.Root>` + `<ComposerPrimitive.Input>` + `<ComposerPrimitive.Send>` (the Send slot wraps the existing circular ArrowUp icon)
   - Toolbar slot keeps ToolsDropdown + HeadlinePickerPopover button + FintheonAttachPopup button + persona dropdown + Relay dispatch button — order unchanged
5. **Add keyboard handlers in `ChatInterface.tsx`**:
   - `Cmd+K` (Mac) / `Ctrl+K` (others) → toggle CommandPalette
   - `Esc` → if stream in-flight, call `cancel()`; else close palette
   - `↑` / `↓` in empty composer → recall previous user messages (cycle through `messages.filter(m => m.role === 'user').slice(-10)`)
6. **Slash-command override**: in composer onSubmit, regex-match `^/(oracle|feucht|consul|herald)\s` at start of input → strip prefix, set `personaOverride` for that one chat send, then clear override
7. **`@TICKER` injection**: in composer onSubmit, regex `@([A-Z]{1,5})\b` → strip from text, attach as `{type:'ticker', symbol}` context (use existing context-injection pattern from HeadlinePickerPopover)
8. **MessageQueue wiring in `ChatInterface.tsx`**:
   - State: `const [pendingMessages, setPendingMessages] = useState<QueuedMessage[]>([])`
   - Mount `<MessageQueue messages={pendingMessages} onEdit={...} onRemove={...} />` ABOVE the composer
   - On user submit while `isStreaming === true` → push to `pendingMessages` instead of immediate send
   - On `complete` event → if `pendingMessages.length > 0` → shift first, send it
   - Offline detection: poll `/api/diagnostics` every 10s; if fail → enable persistent localStorage queue under `fintheon:msgQueue:<conversationId>`
   - On reconnect → drain queue
9. **Mirror MessageQueue on mobile**: create `mobile/components/chat/MessageQueue.tsx` with same shape; wire into `mobile/components/chat/ChatPage.tsx` state; expose via long-press send gesture
10. **Mobile palette as bottom sheet**: gesture-detect swipe-up on `ChatInput.tsx` (use existing gesture pattern from artifact sheet — see T4) → mount CommandPalette in bottom-sheet shell
11. No backend changes. No `harper-handler.ts` edits.

## Acceptance Criteria

- [ ] Cmd+K opens palette from any web chat surface; `Esc` closes
- [ ] Type `/oracle <message>` in composer → submits with Oracle persona for that turn only; persona dropdown returns to default after
- [ ] Type `@NVDA what is happening?` → submits with NVDA ticker context attached; user message displays without `@NVDA` prefix
- [ ] `↑` in empty composer recalls previous user message; repeated `↑` walks back; `↓` walks forward
- [ ] Send a message while assistant is streaming → message appears in MessageQueue above composer; flushes when assistant `complete` fires
- [ ] Disable network → send 3 messages → all queue to localStorage; re-enable network → all 3 flush in order
- [ ] All preserved primitives (ToolsDropdown, HeadlinePickerPopover, FintheonAttachPopup, persona dropdown, Relay dispatch button) still visible and functional in composer toolbar
- [ ] Send button is still a circular ArrowUp (visual diff acceptable for the surrounding composer; the button itself unchanged)
- [ ] Mobile: long-press send shows MessageQueue editor; swipe-up opens palette as bottom sheet
- [ ] `cd frontend && npx tsc --noEmit --project tsconfig.json` clean
- [ ] `cd mobile && npx tsc --noEmit` clean
- [ ] `cd frontend && rm -rf dist && npx vite build` clean
- [ ] `cd mobile && rm -rf dist && npx vite build` clean

## Validation Commands

```bash
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && bun add cmdk
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && bun add @assistant-ui/react

cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx tsc --noEmit --project tsconfig.json
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx tsc --noEmit

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx vite build

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx vite build
```

## Banned Ornaments (memory: /solvys-feels)

- No gradients
- No emojis (colored or monochrome)
- No Kanban borders
- No AI sparkles (✨, shimmer, animated gradient text)
- No glassmorphic surfaces — flat + accent border only

## Commit Format

```
[v5.29.0] feat: T2 ComposerPrimitive + cmdk palette + MessageQueue wiring (web + mobile)
```
