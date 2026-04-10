# Task Brief: Harper Consilium Real-Time Integration

**Date:** 2026-04-04
**Scope:** Wire Harper's autonomous loop output into the Consilium UI (AgentChattr, Sanctum Timeline, NarrativeFlow) with real-time rendering
**Estimated files:** 12

## Context

Harper's autonomous loop is now live — it spawns Claude CLI subprocesses on heartbeat (5min) and event triggers (Level 4 items, VIX spikes, pipeline stalls). Currently, output goes to `harper_journal` (Supabase) and `harper_ops_feed` (visible only in the footer Harper Ops panel). The problem: the Consilium — where Chief spends most of his time — shows zero Harper autonomous activity. Agent Chattr polls `/api/boardroom/messages` every 30s but Harper's loop never writes there. Sanctum Timeline shows scored catalysts but not Harper's narrative synthesis. The fix: Harper's autonomous output must flow into the Consilium in real-time, appearing as agent messages in Chattr, as narrative thread recommendations in Timeline, and as catalyst annotations in NarrativeFlow.

## Files to Read First

- `backend-hono/src/services/harper-autonomous/loop-manager.ts` — The `processOutput()` function (line ~220) is where Harper's completed analysis gets written to journal + ops. This is the injection point for boardroom writes.
- `backend-hono/src/services/hermes-sessions.ts` — `appendToBoardroom()` function (line ~163) writes messages to the boardroom via `boardroom-store`. This is the existing pattern for agent → boardroom.
- `frontend/components/consilium/AgentChattr.tsx` — The boardroom chat UI. Polls every 30s. Messages render via `ConsiliumMessage`. Currently shows agent responses from `/api/boardroom/mention/send` only.
- `frontend/components/consilium/ConsiliumMessage.tsx` — Individual message renderer with @mention parsing, timestamps, "show full analysis" button.
- `frontend/components/narrative/TimelinePanel.tsx` — Paginated 2-column narrative timeline. Shows catalysts grouped by date across 10 narrative threads. Currently reads from NarrativeContext only.
- `frontend/components/consilium/ConsiliumHub.tsx` — Top-level tab structure. Harper status should be visible in the tab bar when the loop is active.
- `backend-hono/src/services/harper-autonomous/ops-store.ts` — Ops feed CRUD. Has `getOpsFeed()` and `writeOpsEntry()`.
- `backend-hono/src/services/harper-autonomous/journal-store.ts` — Journal CRUD. Has `writeJournalEntry()` and `getRecentEntries()`.
- `backend-hono/src/services/harper-autonomous/context-builder.ts` — Task types defined in `HarperTask` interface (line ~100).
- `backend-hono/src/services/boardroom-store.ts` — `addBoardroomMessage()` is the DB write function. Already has a `notifyHarperObserver` hook at the end.
- `frontend/components/consilium/AgentBadge.tsx` — Agent roster with icons and colors. Harper-Opus is already defined.
- `backend-hono/src/services/riskflow/sse-broadcaster.ts` — SSE broadcaster for Level 4 items. Pattern for real-time push.

## What to Build/Change

### 1. Harper → Boardroom Bridge (Backend)

- **Path:** `backend-hono/src/services/harper-autonomous/loop-manager.ts`
- **Action:** Modify
- **Spec:** In `processOutput()` (around line 225), after writing to journal and ops, also call `appendToBoardroom()` for non-heartbeat tasks. Heartbeat outputs should NOT flood the boardroom — only write when `task.type` is `level4-item`, `vix-spike`, `pipeline-stall`, `scoring-qa`, `narrative-synthesis`, `brief-review`, `consilium-intervention`, or `manual`. Format the boardroom message with a prefix tag like `[HARPER-AUTO: Level 4 Analysis]` so the UI can distinguish autonomous messages from chat responses. Pass `metadata: { autonomous: true, taskType: task.type }` so the frontend can render them differently.
- **Import:** `import { appendToBoardroom } from '../hermes-sessions.js'`
- **Max lines:** No new file — ~15 lines added to existing function

### 2. Autonomous Message Styling in AgentChattr

- **Path:** `frontend/components/consilium/ConsiliumMessage.tsx`
- **Action:** Modify
- **Spec:** Detect `message.metadata?.autonomous === true` and render a subtle visual differentiator. Add a small `Bot` icon (from lucide-react) next to the agent badge when the message is autonomous. Add a `text-[9px] font-mono uppercase tracking-wider` tag showing the task type (e.g., `LEVEL 4 ANALYSIS`, `SCORING QA`, `REGIME SHIFT`). Use a left border color of `var(--fintheon-accent)` with opacity 30% for autonomous messages (vs. no left border for regular chat). Do NOT change the overall message layout — just add the visual cues.
- **Max lines:** ~20 lines added

### 3. Harper Heartbeat Indicator in ConsiliumHub Tab Bar

- **Path:** `frontend/components/consilium/ConsiliumHub.tsx`
- **Action:** Modify
- **Spec:** Add a small pulsing dot next to the "Boardroom" dropdown label when Harper's loop is alive. Use the existing `useHarperOps` hook (from `frontend/hooks/useHarperOps.ts`) to check `status?.loop?.alive`. If alive, show a 6px emerald-400 dot with `animate-pulse`. If not alive, show nothing (no red dot — absence is the signal). Place it after the "Boardroom" text in the dropdown button, same position as the WiFi bars in AgentChattr.
- **Max lines:** ~10 lines added

### 4. Harper Activity Feed in Boardroom Sub-View

- **Path:** `frontend/components/consilium/HarperActivityFeed.tsx`
- **Action:** Create
- **Spec:** A new component that renders Harper's recent autonomous activity inline within the Boardroom context. It fetches from `GET /api/harper-ops/feed?limit=20` and renders a compact timeline of actions. Each entry shows: timestamp (ET), severity dot (emerald/amber/red), title, and expandable detail. This is NOT a duplicate of the footer HarperOpsPanel — it's a slimmer, read-only feed designed to sit alongside AgentChattr. No approve/deny buttons. No quick actions. Just the activity log. Styled to match `ConsiliumMessage` aesthetics (same fonts, colors, spacing).
- **Max lines:** 120

### 5. Wire Harper Activity into Boardroom Agentic Chat View

- **Path:** `frontend/components/consilium/ConsiliumHub.tsx`
- **Action:** Modify
- **Spec:** In the `agentic-chat` sub-view of Boardroom (around the section that renders `<AgentChattr />`), add a split layout: AgentChattr on the left (70% width), HarperActivityFeed on the right (30% width) with a thin vertical divider (`w-px bg-white/5`). The feed should be collapsible (chevron toggle). Default state: expanded on desktop, collapsed on narrow viewports. Use the same flex layout pattern as the existing Debate/Proposals side panels.
- **Max lines:** ~25 lines added

### 6. Narrative Synthesis → Timeline Integration

- **Path:** `backend-hono/src/services/harper-autonomous/loop-manager.ts`
- **Action:** Modify
- **Spec:** In `processOutput()`, when `task.type === 'narrative-synthesis'`, parse the output for narrative thread recommendations. Harper's soul file instructs it to identify clusters and recommend new narrative threads. When the output contains identifiable narrative thread references (matching the 10 thread slugs: `middle-east-conflict`, `liquidity-credit-contraction`, `ai-singularity`, `usd-jpy-carry-trade`, `trade-war`, `us-china-relations`, `rate-cut-cycle`, `trump-presidency`, `price-stability`, `maximum-employment`), write a catalyst card link via the existing Supabase `narrative_card_links` table. This makes Harper's narrative synthesis visible in the Timeline panel automatically.
- **Max lines:** ~30 lines added

### 7. Harper Journal Endpoint for Consilium

- **Path:** `backend-hono/src/routes/harper-ops/index.ts`
- **Action:** Modify (already exists)
- **Spec:** Add a new endpoint `GET /api/harper-ops/journal/latest-synthesis` that returns the most recent `narrative-synthesis` or `scoring-qa` journal entry. This gives the Timeline panel a quick way to show "Harper's latest take" without fetching the full journal. Return `{ entry: JournalEntry | null }`.
- **Max lines:** ~15 lines added

### 8. Harper Status Badge in AgentBadge

- **Path:** `frontend/components/consilium/AgentBadge.tsx`
- **Action:** Modify
- **Spec:** Add an optional `autonomous` prop to AgentBadge. When `true` AND the agent is `Harper-Opus`, render a tiny `Bot` icon (8x8, `text-emerald-400`) in the top-right corner of the badge, overlapping slightly. This visually marks messages that came from Harper's autonomous loop vs. Harper responding to a user message.
- **Max lines:** ~10 lines added

### 9. SSE Stream for Harper Ops (Future-Ready)

- **Path:** `backend-hono/src/routes/harper-ops/index.ts`
- **Action:** Modify
- **Spec:** Add a new SSE endpoint `GET /api/harper-ops/stream` that pushes new ops feed entries in real-time instead of polling. Follow the exact pattern from `backend-hono/src/services/riskflow/sse-broadcaster.ts` — register clients in a Set, push on write, remove on disconnect. In `ops-store.ts`, add an EventEmitter that fires on `writeOpsEntry()`. The frontend `useHarperOps` hook should prefer SSE when available, falling back to polling. This replaces the 10s polling with instant updates.
- **Max lines:** ~60 lines for SSE endpoint, ~15 lines for EventEmitter in ops-store, ~20 lines for hook SSE mode

### 10. Consilium Sanctum — Harper Overlay on NarrativeMap

- **Path:** `frontend/components/narrative/NarrativeMap.tsx`
- **Action:** Modify
- **Spec:** When Harper's loop is alive (check via `useHarperOps`), show a small floating badge in the bottom-left corner of the NarrativeMap canvas: "Harper watching" with a pulsing emerald dot. When Harper writes a narrative-synthesis journal entry, briefly flash the badge gold for 3 seconds to indicate fresh analysis. This is purely visual — no functional change to the map itself. The badge should be position: absolute, pointer-events: none (doesn't interfere with canvas interactions).
- **Max lines:** ~20 lines added

## Key Rules

- All agent colors are `#D4AF37` (Solvys Gold). Never use per-agent color variations.
- Boardroom messages use the `BoardroomMessage` type from `ConsiliumMessage.tsx` (line 8-16).
- `appendToBoardroom()` requires a string content and role. Pass metadata as 3rd arg.
- The 10 narrative thread slugs are hardcoded in `TimelinePanel.tsx` (lines 10-21). Match these exactly.
- AgentChattr polls every 30s. The SSE stream (item 9) is additive — don't remove polling as fallback.
- The `useHarperOps` hook already exports `status`, `feed`, `triggerHeartbeat` etc. Reuse it.
- ConsiliumHub uses spring-physics CSS transitions (150ms + 200ms). Match existing timing.
- Backend uses `createLogger('ModuleName')` for all logging. Follow this pattern.

## DO NOT

- Touch the Harper Soul File (`HARPER-SOUL.md`) — it's complete
- Modify the heartbeat scheduler or loop manager's core spawn logic
- Add new Supabase tables — use existing `boardroom_messages`, `harper_journal`, `harper_ops_feed`, `narrative_card_links`
- Create new React contexts — reuse `useHarperOps` hook and existing context patterns
- Touch files outside the listed scope
- Add WebSocket — use SSE (the codebase pattern is SSE everywhere)
- Add gradients or colored emojis to any UI

## Verification

```bash
# Backend typecheck
cd backend-hono && bunx tsc --noEmit

# Frontend build
cd /Users/tifos/Documents/Codebases/fintheon && npx vite build

# Verify Harper writes to boardroom (after restart)
curl -s "http://localhost:8080/api/boardroom/messages?search=HARPER-AUTO" | python3 -m json.tool

# Verify SSE stream connects
curl -N "http://localhost:8080/api/harper-ops/stream"

# Verify ops feed has entries
curl -s "http://localhost:8080/api/harper-ops/feed?limit=5" | python3 -m json.tool
```

## Changelog Entry

```typescript
{
  date: '2026-04-05T00:00:00',
  agent: 'claude-code',
  summary: 'Harper Consilium real-time integration: autonomous loop output → boardroom messages, AgentChattr autonomous message styling, HarperActivityFeed sidebar, SSE stream for ops, NarrativeMap Harper overlay, ConsiliumHub heartbeat indicator, narrative-synthesis → timeline card links',
  files: [
    'backend-hono/src/services/harper-autonomous/loop-manager.ts',
    'backend-hono/src/services/harper-autonomous/ops-store.ts',
    'backend-hono/src/routes/harper-ops/index.ts',
    'frontend/components/consilium/ConsiliumMessage.tsx',
    'frontend/components/consilium/ConsiliumHub.tsx',
    'frontend/components/consilium/HarperActivityFeed.tsx',
    'frontend/components/consilium/AgentBadge.tsx',
    'frontend/components/narrative/NarrativeMap.tsx',
    'frontend/hooks/useHarperOps.ts',
  ],
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
