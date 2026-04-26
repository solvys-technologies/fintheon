# Sprint Brief: S42-T3 — Message Render + streamdown + Agent Activity Rail

## Context

Assistant message bubbles get a Brotzky-style upgrade: token-level streaming cursor, inline numeric citation chips (`[1][2]` parse to clickable chips that push citations into the artifact pane), per-message footer (`agent · gen HH:MM:SS · 1.4s · 12 sources`), and a persistent live agent-activity rail that shows tool calls, citations, and thinking traces as the model works. Markdown rendering moves to `streamdown` via the official `@assistant-ui/react-streamdown` adapter (handles unterminated chunks, code blocks, mermaid, KaTeX). Boardroom `ConsiliumMessage` keeps its @mention/agent-badge but slots inside the new primitive.

## Branch Target

`s42-t3-render` (cut from worktree `~/Desktop/Codebases/fintheon-s42-chat-sota` off `v5.28.0`)

## Scope — Included

### Web

- [ ] Replace `frontend/components/chat/FintheonStreamingBubble.tsx` internals with `<AssistantMessagePrimitive>` + `<MessagePrimitive.Content>` rendered by `@assistant-ui/react-streamdown`
- [ ] NEW `frontend/components/chat/MessageFooter.tsx` — renders `{agent} · gen {HH:MM:SS} · {Ns} · {N} sources` from enriched `complete` event
- [ ] NEW `frontend/components/chat/CitationChip.tsx` — parses `[N]` markers in stream text, renders inline numeric chip
- [ ] NEW `frontend/components/chat/AgentActivityRail.tsx` — wraps Agent Elements `<ToolCall>` / `<Citation>` / `<Thinking>` components, consumes new BridgeStreamEvent types
- [ ] Update `frontend/components/consilium/ConsiliumMessage.tsx` to slot inside `MessagePrimitive` while preserving @mention/agent-badge logic

### Mobile

- [ ] Replace `mobile/components/chat/ChatMessage.tsx` internals with `<AssistantMessagePrimitive>` + `<MessagePrimitive.Content>` via `@assistant-ui/react-streamdown`
- [ ] Same MessageFooter + CitationChip components reused from frontend (or mobile-specific copies if styling differs — prefer shared)
- [ ] AgentActivityRail mobile variant (top strip above messages, collapsible)

### Both

- [ ] Token-level cursor uses `t-text-swap` from `solvys-transitions`
- [ ] CitationChip click → push citation event to ArtifactPane (T4 will consume; for now expose `onCitationClick` prop and call `window.dispatchEvent(new CustomEvent('fintheon:artifact', {detail: {kind:'citation', payload}}))` as fallback if T4 hasn't landed)
- [ ] AgentActivityRail consumes `tool_call`, `citation`, `thinking` events from T1's stream — degrades to empty when those events are absent (T1 not deployed yet)

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/chat/FintheonComposer.tsx` (T2)
- `frontend/components/chat/MessageQueue.tsx` (T2)
- `frontend/components/chat/ToolsDropdown.tsx`
- `frontend/components/chat/HeadlinePickerPopover.tsx`
- `frontend/components/chat/FintheonAttachPopup.tsx`
- `frontend/components/ChatInterface.tsx` shell (T7 owns mount perf; T4 owns dualPane extension)
- `mobile/components/chat/ChatPage.tsx` shell (T7)
- `mobile/components/chat/ChatInput.tsx` (T2)
- `frontend/components/shared/NothingFuse.tsx` (T8 owns the visual treatment of fuses; T3 imports and uses but does not modify)
- All spinner files: `RadarSpinner.tsx`, `SegmentedSpinner.tsx`, `ai-loader.tsx`, `UnicodeSpinners.tsx` (T8)
- `backend-hono/*` (T1)
- TradingView Sanctum chart (T4 reuses `EmbeddedBrowserFrame` separately)
- Refinement Engine S37 Advanced pane

## Reuse Inventory

- `@assistant-ui/react@^0.12.15` (already in frontend) — `AssistantMessagePrimitive`, `MessagePrimitive.Content`
- `streamdown@^2.5.0` (already in frontend + mobile) — wired via the adapter below
- `@assistant-ui/react-streamdown` (NEEDS INSTALL on both frontend and mobile) — official adapter
- Agent Elements package (verify exact name during install — `agent-elements.21st.dev` is the docs URL; the npm package may differ)
- `solvys-transitions`: `t-text-swap` for token cursor, `t-badge` for activity-rail items
- Existing `ChatMessageBubble` Take Note bookmark — slot into `<AssistantMessagePrimitive>` action bar
- BridgeStreamEvent types at `frontend/types/bridge-stream.ts` (extended by T1)

## Known Issues to Preserve

- Take Note bookmark feature — keep behavior, slot into new action bar
- ConsiliumMessage @mention parsing (AgentMention + EveryoneMention components) — keep behavior; render inside `MessagePrimitive`
- ConsiliumMessage AgentBadge (emoji + name) — TP allows existing agent-badge emoji here (memory ban is on AI sparkles + decorative emoji, not agent-identity badges); keep
- ContextInjectionBadge — keep
- Per-agent metadata badges (CAO/All-Seer/Futures & Risk/Fundamentals/News & Sentiment) — keep
- Boardroom DAG panel is separate from this rail (the AgentActivityRail is for SOLO chat; boardroom keeps its own DAG panel until a future sprint unifies them)

## Implementation Steps

1. **Install adapters**:
   ```bash
   cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && bun add @assistant-ui/react-streamdown
   cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && bun add @assistant-ui/react-streamdown @assistant-ui/react
   # Agent Elements: search for the npm package name first
   # Likely candidates: @21st-extensions/agent-elements OR agent-elements
   # cd frontend && bun add <verified-package-name>
   ```
2. **Replace `FintheonStreamingBubble.tsx` internals**:
   - Wrap with `<AssistantMessagePrimitive>` from assistant-ui
   - Inside, use `<MessagePrimitive.Content components={{ Text: StreamdownText }} />` where `StreamdownText` is the streamdown adapter
   - Preserve role-based styling (assistant dark accent border, user right-aligned)
   - Preserve cancelled-state opacity
3. **Replace `mobile/components/chat/ChatMessage.tsx` internals** with the same primitive + streamdown adapter, mobile-appropriate styling
4. **Create `MessageFooter.tsx`**:
   - Props: `agent: string, generatedAt: Date, latencyMs: number, sourceCount: number, model?: string`
   - Layout: small monospace row at bottom of assistant message: `Harper · gen 17:14:08 · 1.4s · 12 sources`
   - Use Solvys palette accent for separators
   - Hide gracefully when fields are absent (T1 not deployed)
5. **Create `CitationChip.tsx`**:
   - Parse text content for `[N]` patterns where N is a positive integer
   - Replace each `[N]` with a `<CitationChip id={N} />` element (numeric, accent-colored, small)
   - On click → dispatch `fintheon:artifact` CustomEvent with `{kind:'citation', payload:{id, source, url}}` (T4 ArtifactPane will listen)
   - Lookup table comes from `citation` events accumulated for the current message
6. **Create `AgentActivityRail.tsx`**:
   - Web: vertical rail docked between chat and artifact pane (`w-64`, flat surface, accent border)
   - Mobile: horizontal strip above message list (collapsible)
   - Renders Agent Elements `<ToolCall>`, `<Citation>`, `<Thinking>` items consuming new BridgeStreamEvent types
   - Each item animates in via `t-badge` transition
   - Tool-call status pills use NothingFuse-style segmented progress (import from `frontend/components/shared/NothingFuse.tsx`; do NOT modify the fuse — T8 owns visual treatment)
   - Thinking trace items expand/collapse on click
7. **Update `ConsiliumMessage.tsx`** to render inside `<MessagePrimitive>` while keeping @mention/agent-badge/ContextInjectionBadge logic untouched
8. **Token cursor**: in the streamdown adapter, append a CSS-animated cursor `<span class="t-text-swap" />` at the tail of the latest streaming chunk; remove on `complete`

## Acceptance Criteria

- [ ] Assistant messages render markdown via streamdown (test: ask for a code block + a table — both render correctly mid-stream)
- [ ] Token cursor blinks at the streaming tail; removes on complete
- [ ] When T1 events arrive: `tool_call` events render as items in AgentActivityRail with status pulse; `citation` events render as items + populate CitationChip lookup; `thinking` events render as collapsed items in rail
- [ ] When T1 events absent (degraded path): bubble still renders correctly, rail is empty (no errors)
- [ ] MessageFooter shows `agent · gen HH:MM:SS · Ns · N sources` when complete event has the new fields; collapses gracefully when absent
- [ ] `[1]` `[2]` markers in assistant text render as numeric chips; click dispatches `fintheon:artifact` event
- [ ] ConsiliumMessage still shows agent badge + @mentions + context injection in boardroom view
- [ ] Take Note bookmark still works
- [ ] Mobile parity: same flow on `ChatMessage.tsx`; rail mounts as collapsible top strip
- [ ] `cd frontend && npx tsc --noEmit --project tsconfig.json` clean
- [ ] `cd mobile && npx tsc --noEmit` clean
- [ ] `cd frontend && rm -rf dist && npx vite build` clean
- [ ] `cd mobile && rm -rf dist && npx vite build` clean

## Validation Commands

```bash
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && bun add @assistant-ui/react-streamdown
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && bun add @assistant-ui/react-streamdown @assistant-ui/react

cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx tsc --noEmit --project tsconfig.json
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx tsc --noEmit

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx vite build

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx vite build
```

## Banned Ornaments

- No gradients, no emojis (except existing agent-identity badges in ConsiliumMessage), no Kanban borders, no AI sparkles, no glassmorphic surfaces

## Commit Format

```
[v5.29.0] feat: T3 streamdown messages + AgentActivityRail + MessageFooter + CitationChip (web + mobile)
```
