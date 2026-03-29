# S8-T7: Ask Harp + Claude CLI (Harper-Opus) Integration

**Sprint**: S8 — The Mega Sprint
**Track**: T7 (after T1)
**Branch**: `v.8.28.1`

## Context
Ask Harp currently talks to Hermes via `hermes-handler.ts`. This track wires Claude CLI (Opus) into the chat interface as "Harper-Opus" — the new CAO. Main Ask Harp gets a dual-pane layout (Luke W pattern). Sidebar + Scriptorium stay single-pane with agent-plan component. All chat interfaces get uniform treatment: 21st.dev components, pulsing icon (replaces Think Harder), boardroom gets newspaper RiskFlow button. Persona switching loops analysts in/out via skills.

## Files to Read First
- `frontend/components/chat/AskHarpChatPanel.tsx` — current chat UI
- `frontend/components/consilium/ConsiliumHub.tsx` — Ask Harp tab routing
- `backend-hono/src/services/hermes-handler.ts` (495) — child process spawn pattern
- `backend-hono/src/services/hermes-service.ts` — agent definitions, `HERMES_AGENTS`
- `backend-hono/src/services/hermes-sessions.ts` — session management
- `frontend/components/proposals/ProposalWidget.tsx` — slide-out panel architecture
- `frontend/components/layout/MainLayout.tsx` (855) — sidebar Ask Harp panel

## Files to Create
- `frontend/components/ui/agent-plan.tsx` — 21st.dev task tree component (copy from brief)
- `frontend/components/ui/ai-loader.tsx` — 21st.dev loader (recolored to gold)
- `frontend/components/ui/animated-ai-input.tsx` — 21st.dev chat input
- `backend-hono/src/services/harper-handler.ts` — Claude CLI session handler

## Files to Modify
- `frontend/components/chat/AskHarpChatPanel.tsx` — refactor to dual-pane (main), kill kanban message borders
- `frontend/components/layout/MainLayout.tsx` — sidebar chat integration
- `backend-hono/src/routes/index.ts` — mount Harper-Opus routes

## Implementation

### 1. Backend: Wire Claude CLI
Create `harper-handler.ts` following the same pattern as `hermes-handler.ts` line 495:
```typescript
const claudeBin = process.env.CLAUDE_CLI_PATH ?? 'claude';
// Spawn Claude CLI as child process
// Stream responses via SSE/WebSocket to frontend
// Hardwired to Opus — no model selection
```
- Session persistence: store conversation in Supabase `harper_sessions` table
- Claude receives: full Fintheon context (active narratives, RiskFlow state, MiroShark reports)
- Claude can: create artifacts (catalyst cards, narrative items), run MiroShark, push to map
- Route: POST `/api/harper/chat` with streaming SSE response

### 2. Main Ask Harp: Dual-Pane (Luke W Pattern)
Refactor `AskHarpChatPanel.tsx` when rendered as main content (not sidebar):

**Left pane (conversation):**
- User messages (styled, no kanban borders)
- Claude (Harper-Opus) responses with reasoning traces inline
- Clean message bubbles, Solvys Gold palette

**Right pane (artifacts + tools):**
- Tool calls used (collapsible when complete)
- Artifacts created: catalyst cards, narrative items — rendered IDENTICALLY to how they appear in NarrativeFlow
- Visual previews of artifacts with smooth transition animations
- Artifacts auto-stored in backend DB, auto-placed in NarrativeFlow
- When artifact is created → soft animation → card appears in right pane → simultaneously materializes on the canvas (if NarrativeFlow is open)

### 3. Sidebar + Scriptorium: Single-Pane
When Ask Harp renders in sidebar or Scriptorium:
- Single-pane chat (no split)
- `agent-plan.tsx` component rendered inline in the conversation (shows task progress)
- Same Claude CLI session as main Ask Harp
- Same persona switching, same pulsing icon

### 4. 21st.dev Components

**agent-plan.tsx** → `frontend/components/ui/agent-plan.tsx`:
- Copy the full component from the code provided in this sprint's planning session
- Uses `framer-motion` for animations, `lucide-react` for icons
- Shows task tree with status icons (completed/in-progress/pending/need-help/failed)
- Expandable subtasks with MCP server tool badges
- Dependency badges between tasks
- Recolor: replace default colors with Solvys Gold palette CSS vars

**ai-loader.tsx** → `frontend/components/ui/ai-loader.tsx`:
- Copy from provided code
- Recolor: replace blue `#38bdf8`/`#005dff`/`#1e40af` box-shadows with gold variants using `var(--fintheon-accent)` and `color-mix()`
- Text color: use `var(--fintheon-text)` instead of white
- Background: use `var(--fintheon-bg)` gradient instead of blue
- Used inside the voice assistant circle indicator

**animated-ai-input** → `frontend/components/ui/animated-ai-input.tsx`:
- Fetch from `https://21st.dev/community/components/kokonutd/animated-ai-input/default`
- Adapt to Fintheon theme
- Used as the chat input across all Ask Harp interfaces

### 5. Think Harder → Pulsing Icon
In EVERY chat input that talks to an agent (Ask Harp sidebar, main, Scriptorium, canvas mini-chat):
- Swap the Think Harder button (snowflake icon) for a pulsing icon
- **Icon only pulses** — CSS animation on the SVG, no background, no border when clicked/enabled
- Pulse: `scale(1) → scale(1.15) → scale(1)` over 1.5s, infinite, ease-in-out
- When disabled: static, slightly dimmed

### 6. Boardroom Special: Newspaper RiskFlow Button
In the Boardroom chat input ONLY:
- Swap Think Harder for a newspaper icon (from lucide-react: `Newspaper`)
- Click → opens RiskFlow item picker (same as "Import RiskFlow items" in NarrativeFlow)
- Selected items attach to the chat message as context
- Renders as preview chips in the input area

### 7. Persona Switching
The existing persona dropdown in Ask Harp (Harper-Hermes, Oracle, Feucht, Consul, Herald):
- When user selects a different persona (e.g., Oracle):
  - Fire a "loop analyst in" skill: injects a system prompt modifier telling Claude CLI to respond as that analyst for the next few messages
  - Show visual indicator: analyst name + colored dot in the chat header
- When user switches back to Harper-Opus:
  - Fire "back to Harper mode" skill: restores default CAO system prompt
  - Visual indicator returns to "Harper-Opus" with gold dot
- Works in all chat interfaces EXCEPT boardroom (boardroom is always multi-agent, no persona switching)

### 8. Kill Kanban in Chat Messages
- Remove bordered containers around agent response messages
- Use clean, borderless message styling
- Agent name + role as small header above response text
- No card-like wrapping

### 9. Artifact System
Items created by Claude CLI in the chat = "artifacts":
- Catalyst cards, narrative items, trade ideas, etc.
- Stored in backend DB (Supabase) automatically
- Placed in NarrativeFlow automatically (dispatched to NarrativeContext)
- Smooth transitions: artifact appears in right pane → fades in on canvas
- Artifact renders identically in chat and on canvas (same component, same props)

## Dependencies
- `framer-motion` (check if installed, likely yes)
- `lucide-react` (already installed)

## Verification
1. `bun run build` — clean
2. Ask Harp main: dual-pane renders, left=conversation, right=artifacts
3. Ask Harp sidebar: single-pane with agent-plan inline
4. Type message → Claude CLI responds (may need Claude CLI installed/configured)
5. Pulsing icon visible in all chat inputs (not snowflake)
6. Boardroom: newspaper icon, not pulsing icon
7. Persona dropdown → switching changes response style
8. No kanban borders on chat messages
9. ai-loader renders in gold (not blue)
10. agent-plan component shows task tree

## Changelog Entry
```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S8-T7: Wire Claude CLI (Harper-Opus) into Ask Harp, dual-pane main chat, 21st.dev components (agent-plan, ai-loader, animated-input), pulsing icon, boardroom newspaper button, persona switching, artifact system', files: ['frontend/components/chat/AskHarpChatPanel.tsx', 'frontend/components/ui/agent-plan.tsx', 'frontend/components/ui/ai-loader.tsx', 'frontend/components/ui/animated-ai-input.tsx', 'backend-hono/src/services/harper-handler.ts'] }
```

### 10. QuickScope Skill (Claude CLI)
Create a Claude CLI skill file at `backend-hono/src/skills/quickscope.md` (or equivalent skill location) that:

**What it does:**
1. Uses browser-use to open TopStepX iframe and read chart information
2. **READ ONLY** — MUST NOT click DOM, order ticket, buy/sell buttons, or anything that could trigger a trade
3. Identifies key levels: support/resistance zones, trend lines, volume profile areas
4. Charts those levels visually (if browser-use supports annotation)
5. Gauges market risk from the visual chart state

**Fallback (if browser-use can't interact fast enough):**
1. Fullscreen the HTF chart (left pane)
2. Take a screenshot
3. Analyze the screenshot visually (Claude is multimodal)
4. Combine with RiskFlow data (latest feed items, IV scores, macro level)

**Output:**
1. Decide a directional bias: bullish / bearish / neutral with confidence %
2. Write a trade proposal with: bias, key levels, entry zone, stop zone, target zone, risk/reward
3. Automatically input the proposal into the Proposals window (via ProposalWidget API or dispatch)
4. All in one command — user says "quickscope" and gets a proposal

**Safety guardrails:**
- Whitelist only read-only browser actions (navigate, screenshot, scroll)
- Blacklist any click on elements matching: "BUY", "SELL", "MARKET", "LIMIT", "FLATTEN", order ticket selectors
- If accidental click detected, abort immediately

## DO NOT
- Do NOT modify NarrativeFlow canvas layout (T2 owns that)
- Do NOT touch rope rendering (T3 owns that)
- Do NOT modify Aquarium/Sanctum (T4 owns that)
- Do NOT rename MiroFish (T5 owns that)
- Do NOT implement full CAO takeover (S9 scope)
