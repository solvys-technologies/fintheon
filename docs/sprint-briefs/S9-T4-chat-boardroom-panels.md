# S9-T4: Chat Interface + Boardroom Agents + Slide-Out Panels + Apparatus Polish

**Sprint**: S9 — Fix Everything Right
**Track**: T4 (after T1 completes, parallel with T2/T3)
**Branch**: `v.8.28.1`

## Context
Chat interface needs Claude CLI wired correctly (NOT Claude SDK — use harper-handler.ts which spawns the CLI binary directly). Boardroom agents (Oracle, Feucht, Consul, Herald) are MIA — they need to use Grok 4.20 Fast via Nous Research API. Harper-Opus stays on Claude CLI. Slide-out panels (MiroShark debate, artifacts) must behave like ProposalWidget — only one open at a time. Apparatus agent bios need to be legible. Apparatus needs SVG connection lines between agents. Timeline shimmer needs verification.

**IMPORTANT**: T1 renamed components. Use NEW names:
- `AskHarpChatPanel` → `AskHarpSidebar` (file: `chat/AskHarpSidebar.tsx`)
- `ApparatusPage` → `ApparatusMap` (file: `apparatus/ApparatusMap.tsx`)
- `TopStepXBrowser` → `TradingBrowser`
- `Harper-Hermes` → `Harper-Opus` (everywhere)

**CRITICAL**: Do NOT use Claude SDK for chat. The backend uses `harper-handler.ts` which spawns `claude` CLI binary directly as a child process. This is correct. Do not change this approach.

## Design Direction
- Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6
- No gradients, no colored emojis
- Slide-out panels: right side, dark bg, one at a time
- Chat: existing components (PromptBox, FintheonThread, agent-plan). Polish, don't replace.
- Use 21st.dev components already in the repo (agent-plan.tsx, ai-loader.tsx, animated-ai-input.tsx). Don't fetch new ones.

---

## FILES TO READ FIRST
- `backend-hono/src/services/harper-handler.ts` — Claude CLI spawn, persona modifiers
- `backend-hono/src/services/claude-sdk/bridge.ts` — process management for Claude CLI
- `backend-hono/src/services/claude-sdk/process-manager.ts` — spawn mechanics
- `backend-hono/src/services/hermes-service.ts` — agent definitions, model routing
- `backend-hono/src/routes/boardroom/handlers.ts` — boardroom message endpoints
- `frontend/components/chat/AskHarpSidebar.tsx` (renamed, 61 lines) — sidebar chat
- `frontend/components/chat/FintheonThread.tsx` (581 lines) — thread renderer
- `frontend/components/chat/FintheonComposer.tsx` (146 lines) — input with PromptBox
- `frontend/components/chat/CognitionPanel.tsx` (198 lines) — agent-plan inline
- `frontend/components/consilium/AgentChattr.tsx` (365 lines) — boardroom chat
- `frontend/components/consilium/ConsiliumHub.tsx` (363 lines) — tab routing
- `frontend/components/proposals/ProposalWidget.tsx` (338 lines) — gold standard slide-out
- `frontend/components/miroshark/MiroSharkDebatePanel.tsx` (411 lines) — debate panel
- `frontend/components/apparatus/ApparatusMap.tsx` (renamed, 491 lines) — agent briefing cards
- `frontend/components/narrative/TimelinePanel.tsx` (332 lines) — timeline with shimmer

---

## FIXES

### 1. Verify Claude CLI Chat Works End-to-End

Test the full flow:
1. Read `backend-hono/src/services/harper-handler.ts` — understand the spawn pattern
2. Read `backend-hono/src/routes/harper/index.ts` — the POST `/api/harper/chat` endpoint
3. Verify the route is mounted in `backend-hono/src/routes/index.ts`
4. Check `frontend/components/chat/useHermesRuntime.ts` — does it point to `/api/harper/chat` or `/api/ai/chat`?
5. If the frontend is calling the WRONG endpoint, fix it to call `/api/harper/chat`

The harper-handler should:
- Spawn `claude` binary (the CLI, NOT the SDK)
- Pass `--print --output-format stream-json`
- Inject Fintheon context (narratives, RiskFlow state, MiroShark reports) as system prompt
- Stream SSE response back to frontend
- Support persona switching (oracle, feucht, consul, herald modifiers)

**If Claude CLI is not installed on the machine**, the handler should fall back gracefully (not crash). Check for this.

### 2. Switch Boardroom Agents to Grok 4.20 Fast

In `backend-hono/src/services/hermes-service.ts`:
- Find the `HERMES_AGENTS` array or equivalent agent definitions
- Change the model for Oracle, Feucht, Consul, Herald to `xai/grok-4-fast` (or equivalent Grok model ID on Nous Research/OpenRouter)
- Harper-Opus stays on Claude CLI — do NOT change harper-handler.ts
- Verify the Nous Research API base URL is correct: check env var `OPENROUTER_BASE_URL` or `NOUS_API_BASE_URL`

```typescript
// Example model change
{ id: 'pma-merged', model: 'xai/grok-4-fast', ... } // was: 'nous-...' or 'anthropic/...'
```

**Also verify agents actually appear in boardroom**:
- Check `backend-hono/src/routes/boardroom/handlers.ts` — does the standup trigger actually run?
- Does the boardroom poll for new messages? Check `frontend/components/consilium/AgentChattr.tsx` polling logic
- If no messages appear: the agents might not be sending. Check if there's a scheduler/cron that triggers agent conversations.

### 3. Slide-Out Panel Standardization

**Goal**: All slide-out panels behave identically to ProposalWidget. Only ONE can be open at a time.

Read `ProposalWidget.tsx` to understand its pattern, then apply to:
- `MiroSharkDebatePanel.tsx` — must slide from right, same width, same animation
- Any artifact/tool panel in the chat view

**Implementation in ConsiliumHub.tsx or MainLayout.tsx** (whichever manages panel state):
```typescript
type ActivePanel = 'proposals' | 'miroshark' | 'artifacts' | null;
const [activePanel, setActivePanel] = useState<ActivePanel>(null);

// Only one panel open at a time
const openPanel = (panel: ActivePanel) => {
  setActivePanel(prev => prev === panel ? null : panel);
};
```

Each panel receives `open={activePanel === 'panelName'}` and `onClose={() => setActivePanel(null)}`.

### 4. Agent-Plan Inline Polish

`CognitionPanel.tsx` renders during streaming in the sidebar chat. Verify:
- It actually appears when Claude CLI is processing
- The task tree from `agent-plan.tsx` is legible (gold-themed, not blue)
- Steps show status icons (completed/in-progress/pending)
- It collapses when response is complete

Check `frontend/components/ui/agent-plan.tsx` — it uses framer-motion. Make sure:
- Colors use `var(--fintheon-accent)` not hardcoded blue
- Background uses `var(--fintheon-surface)` not white/gray

### 5. Apparatus Agent Bios Readable

In `ApparatusMap.tsx` (renamed), the expanded card sections:
- Bio: verify `text-[13px]` (was bumped from 9px earlier)
- Dossier: verify `text-[13px]`
- Notable intel: verify `text-[12px]`
- Narrative notes: verify `text-[11px]`
- Connection details: verify `text-[11px]`

If any text is still at 8-9px, bump it. The user wants to READ these bios before bed.

### 6. Apparatus SVG Connection Lines

When an agent card is expanded, draw SVG lines to connected agents:

```tsx
{/* SVG overlay for agent connections */}
{expandedAgent && (
  <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
    {/* For each connection involving the expanded agent */}
    {agentConnections.map(conn => {
      // Get bounding rects of source and target cards
      // Draw a bezier path between them
      return (
        <path
          key={`${conn.from}-${conn.to}`}
          d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
          stroke={agentAccentColor}
          strokeWidth={1}
          opacity={0.2}
          fill="none"
          className="rope-breathe"
        />
      );
    })}
  </svg>
)}
```

Use `CONNECTIONS` array already defined in ApparatusMap.tsx (~line 147-155). Use refs on card elements to get positions. Lines should use `rope-breathe` animation from index.css.

### 7. Timeline Shimmer Verification

Check `TimelinePanel.tsx` for:
- `.shimmer-number` CSS class on event/narrative counts
- Title "TIMELINE" at increased size
- "Structured Narrative View" subheader at increased size

If shimmer CSS doesn't exist in `frontend/index.css`, add:
```css
@keyframes text-shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
.shimmer-number {
  background: linear-gradient(90deg, var(--fintheon-accent) 0%, var(--fintheon-text) 50%, var(--fintheon-accent) 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: text-shimmer 3s linear infinite;
}
```

### 8. Boardroom RiskFlow Picker Verification

The newspaper icon + dropdown picker was recently wired in AgentChattr.tsx. Verify it works:
- Click newspaper icon → dropdown shows top 10 RiskFlow items
- Click an item → appears as context chip above input
- Send message → chips appended to message text
- Chips are dismissible (X button)

---

## VERIFICATION

```bash
# 1. Build passes
npx vite build

# 2. Harper routes mounted
grep -n "harper" backend-hono/src/routes/index.ts

# 3. Grok model referenced
grep -n "grok\|xai" backend-hono/src/services/hermes-service.ts

# 4. Agent-plan uses theme vars
grep -n "fintheon-accent\|fintheon-surface" frontend/components/ui/agent-plan.tsx | head -5

# 5. Apparatus text sizes
grep -n "text-\[1[23]px\]" frontend/components/apparatus/ApparatusMap.tsx

# 6. Shimmer CSS exists
grep -n "shimmer" frontend/index.css

# 7. Start backend + test boardroom
cd backend-hono && bun run dev &
sleep 3
curl -s localhost:8080/api/boardroom/messages | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Messages: {len(d.get(\"messages\",[]))}')"
```

## Changelog Entry
```typescript
{ date: '2026-03-30T01:00:00', agent: 'claude-code', summary: 'S9-T4: Wire Claude CLI chat, Grok 4.20 Fast boardroom agents, slide-out panel standardization, agent-plan gold theme, Apparatus SVG ropes + readable bios, timeline shimmer, boardroom RiskFlow picker', files: ['backend-hono/src/services/hermes-service.ts', 'frontend/components/consilium/ConsiliumHub.tsx', 'frontend/components/consilium/AgentChattr.tsx', 'frontend/components/apparatus/ApparatusMap.tsx', 'frontend/components/narrative/TimelinePanel.tsx', 'frontend/components/ui/agent-plan.tsx', 'frontend/components/miroshark/MiroSharkDebatePanel.tsx', 'frontend/index.css'] }
```

## DO NOT
- Do NOT use Claude SDK — the backend spawns Claude CLI binary directly
- Do NOT rename components (T1 did that)
- Do NOT modify RiskFlowContext or scoring logic (T2 owns that)
- Do NOT modify dashboard layout (T3 owns that)
- Do NOT modify NarrativeForceCanvas (T3 owns that)
- Do NOT replace chat components with new 21st.dev ones — polish existing
- Do NOT fetch new components from 21st.dev or GitHub — use what's in the repo
