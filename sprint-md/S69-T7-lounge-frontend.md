# Sprint Brief: T7 — Lounge Frontend Overhaul

## Context

Replace the synthetic dream feed in the Agent Lounge with real deliberation threads, session views, brief display, and agent presence indicators. The current `AgentLounge.tsx` shows placeholder dreams with no real ingestion, no inter-agent conversation, and no SSE streaming. This track builds the full UI on top of the T4+T5+T6 backend APIs.

## Branch Target

`sprint/S69`

## Scope — Included

- [ ] `frontend/components/lounge/AgentLounge.tsx` — Replace dream feed with session-based UI
- [ ] `frontend/components/lounge/LoungeSession.tsx` [NEW] — Active session view
- [ ] `frontend/components/lounge/LoungeBrief.tsx` [NEW] — Gathered materials display
- [ ] `frontend/components/lounge/DeliberationThread.tsx` [NEW] — Agent conversation thread
- [ ] `frontend/components/lounge/LoungeReport.tsx` [NEW] — Report viewer
- [ ] `frontend/hooks/useLounge.ts` [NEW] — Lounge SSE hook
- [ ] `frontend/types/lounge.ts` [NEW] — Lounge type definitions

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/` — all backend owned by T1-T6
- `frontend/components/layout/` — layout chrome, leave alone
- `frontend/contexts/` — global contexts, leave alone

## Reuse Inventory

- `frontend/components/lounge/AgentLounge.tsx` — existing component to replace
- `frontend/components/feed/RiskFlowCardAnatomy.tsx` — card rendering pattern
- `frontend/components/shared/FadingRuler.tsx` — separator component
- `frontend/components/shared/SolvysLoader.tsx` — loading state component
- `frontend/contexts/RiskFlowContext.tsx` — SSE context pattern to follow
- `frontend/hooks/useAgentBusSSE.ts` — existing SSE hook pattern
- `frontend/components/narrative/CatalystCard.tsx` — frosted-glass card pattern
- `frontend/components/editor/agentic-sidebar.tsx` — document/report display pattern

## Known Issues to Preserve

- Current lounge has: dream feed grouped by date, agent presence indicators (colored dots), afterhours detection, "Summon" button
- Replace dream feed, keep agent presence indicators (now based on actual deliberation activity)
- Follow Solvys UI constraints: no gradients, no emojis, no Kanban borders, no AI sparkles
- Frosted-glass surfaces for all cards/panels
- Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6

## Implementation Steps

1. Create `frontend/types/lounge.ts`:
   - `LoungeSession`, `LoungeBrief`, `DeliberationEntry`, `LoungeReport`, `ConsensusResult`
   - Mirror backend types from T4, T5, T6

2. Create `frontend/hooks/useLounge.ts`:
   - SSE connection to lounge surface events
   - Subscribe to `lounge.brief`, `lounge.reflection`, `lounge.consensus` topics
   - Expose: sessions, activeSession, briefs, deliberations, consensus, isLoading
   - Auto-reconnect on disconnect

3. Create `frontend/components/lounge/LoungeBrief.tsx`:
   - Display gathered materials from Herald's gather cycle
   - Sections: YouTube transcripts, X posts with chart images, model scout findings
   - Frosted-glass card per source type
   - Timestamp, source label, digest text
   - Expandable for full content

4. Create `frontend/components/lounge/DeliberationThread.tsx`:
   - Display agent reflections in chronological order
   - Reply threading: indent replies under parent reflection
   - Agent-colored avatars/indicators (Harper=gold, Oracle=purple, Feucht=red, Consul=teal)
   - Timestamp per entry
   - Consensus result shown at bottom when available

5. Create `frontend/components/lounge/LoungeSession.tsx`:
   - Main session view combining brief + deliberations
   - Session header: status, startedAt, gatherer agent
   - Brief section (collapsible)
   - Deliberation thread section
   - Consensus badge when available
   - Report link when generated

6. Create `frontend/components/lounge/LoungeReport.tsx`:
   - Display generated lounge reports
   - Sections: executive summary, source materials, deliberations, consensus, recommendations
   - Use existing document viewer pattern from editor/agentic-sidebar

7. Refactor `frontend/components/lounge/AgentLounge.tsx`:
   - Replace dream feed with session list
   - Active session prominently displayed
   - Past sessions in collapsible history
   - Agent presence indicators based on recent deliberation activity
   - "Summon" button triggers manual gather cycle (POST /api/lounge/sessions/start)
   - Afterhours detection preserved (16:30-17:30 ET)
   - SSE-driven real-time updates

## Acceptance Criteria

- [ ] Lounge shows real deliberation threads, not synthetic dreams
- [ ] Brief materials displayed with source attribution
- [ ] Deliberation thread shows agent reflections with reply threading
- [ ] Agent presence indicators reflect actual activity
- [ ] SSE streaming updates UI in real-time
- [ ] "Summon" button triggers manual gather cycle
- [ ] Session history accessible
- [ ] Reports viewable from lounge
- [ ] Frosted-glass surfaces throughout
- [ ] Solvys Gold theming applied consistently
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build
```

## Commit Format

```
[v6.5.0] feat: S69-T7 lounge frontend overhaul
```
