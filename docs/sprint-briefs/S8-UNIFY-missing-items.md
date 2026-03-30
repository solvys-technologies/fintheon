# S8-UNIFY: Missing Items + Polish Pass

**Sprint**: S8 — The Mega Sprint (unification cleanup)
**Branch**: `v.8.28.1`
**Context**: S8 ran 8 parallel tracks. ~40 items landed, ~12 did not. This brief covers everything that's missing, partially done, or broken. Single agent, one thread, no parallelism. Fix everything, verify visually, ship.

## Design Direction (/the-feels)
- Observatory aesthetic: spacious, contemplative, dark bg, soft muted cards, gold ropes
- Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6
- No gradients, no colored emojis
- Breathing motion: gentle ambient drift, soft pulse on hover
- Anti-default: no uniform card grids, no generic hover states, intentional asymmetry
- Every change should feel intentional, not template-generated

---

## FILES TO READ FIRST
- `frontend/components/narrative/NarrativeFlow.tsx` — canvas wrapper
- `frontend/components/narrative/NarrativeForceCanvas.tsx` — force-directed canvas (768 lines)
- `frontend/components/narrative/NarrativeFloatingToolbar.tsx` — bottom toolbar
- `frontend/components/narrative/Sanctum.tsx` — Aquarium 3-page dashboard
- `frontend/components/narrative/SanctumNarratives.tsx` — active narratives display
- `frontend/components/narrative/SanctumTheses.tsx` — top volatile theses
- `frontend/components/narrative/TimelinePanel.tsx` — paginated timeline
- `frontend/components/RiskFlowPanel.tsx` — RiskFlow panel with header/indicators
- `frontend/components/NotificationToast.tsx` — toast notifications
- `frontend/components/consilium/AgentChattr.tsx` — boardroom chat
- `frontend/components/chat/AskHarpChatPanel.tsx` — Ask Harp chat
- `frontend/components/ui/chatgpt-prompt-input.tsx` — chat input component
- `frontend/components/layout/MainLayout.tsx` — main layout with sidebar
- `frontend/lib/theme.ts` — theme presets
- `frontend/index.css` — CSS vars and animations
- `frontend/components/apparatus/ApparatusPage.tsx` — Apparatus constellation

---

## CRITICAL FIXES (do first)

### 1. RiskFlow Feed — Only 1 Item Showing
The backend returns items via `/api/riskflow/feed?limit=30` but only ~1 shows in the UI. Debug:
- Start the backend: `cd backend-hono && bun run dev`
- Curl: `curl localhost:8080/api/riskflow/feed?limit=5` — how many items come back?
- If backend returns items but frontend shows 1: the issue is in `RiskFlowContext.tsx` polling or `RiskFlowService.list()` response mapping in `services.ts`
- If backend returns 0-1: the feed poller isn't running or the `news_feed_items` table is empty. Check `feedService.getFeed()` in `backend-hono/src/services/riskflow/feed-service.ts`
- The user MUST see 25+ items. If the DB is empty, seed it or trigger a poll via `curl -X POST localhost:8080/api/riskflow/refresh`

### 2. Only 1 Narrative Showing in NarrativeFlow
Seed flag was bumped to `v8` but the user hasn't relaunched with the new build yet. Verify:
- Open browser console, check if `[NarrativeFlow] Rope engine:` log shows card count
- If 0 cards: seeds didn't load. Check `localStorage.getItem('fintheon:narrative-seeded:v8')` — if null, seeds should load on next mount
- If cards exist but only 1 narrative hub visible: check if `visibleLaneIds` is filtering. The filter at line ~375 should compare `c.narrative` against `visibleLaneIds`. If `visibleLaneIds` is initialized with lane IDs that don't match thread slugs, most cards get filtered out
- **Fix**: In `NarrativeFlow.tsx`, the `visibleLaneIds` state initializes from `state.lanes.map(l => l.id)`. Check if lane IDs match thread slugs. If they don't, initialize as empty set (show all when empty).

### 3. Simulation History Still in Sanctum
**File**: `frontend/components/narrative/Sanctum.tsx`
Find and DELETE the simulation history section entirely. It renders past MiroFish/MiroShark runs as rows (Mar 26 full-brief IV 6.7 conf 72% REGIME). The agent scorecards (`SanctumAgentScorecard` or equivalent) should be in its place. If no agent scorecard component is rendering there, wire it in.

---

## UI POLISH (after critical fixes)

### 4. "X CLI" → "X"
**File**: `frontend/components/RiskFlowPanel.tsx`
Find `"X CLI"` and replace with `"X"`. There's 1 remaining reference — likely in a comment or label. Grep and kill it.

### 5. "Risk Flow" Title Left of Indicator
**File**: `frontend/components/RiskFlowPanel.tsx` (~line 607)
Current: `<Zap icon> RiskFlow <high count badge> <StatusDot label="X">`
Change to: `<Zap icon> Risk Flow <high count badge> Risk Flow <StatusDot label="X">`
Wait — the title already says "RiskFlow" at line 607. The user wants "Risk Flow" (with space) as a label specifically to the LEFT of the X status indicator. So it should read: `Risk Flow [X dot]` not just `RiskFlow ... [X dot]` with stuff between them. Move the title or add a label right before the StatusDot.

### 6. Auto Polling Description
**File**: `frontend/components/RiskFlowPanel.tsx`
Find the `<AutoRefreshToggle />` component. Everywhere it appears EXCEPT the strategium (right panel), add descriptive text: "Automatically refreshes every 30s" as a small label near the toggle. In every location except strategium, also add the word "auto" next to the toggle.

### 7. Active Narratives → NarrativeFlow Link
**File**: `frontend/components/narrative/SanctumNarratives.tsx`
When user clicks an active narrative in the Aquarium page 2, it should navigate to that narrative on the Observatory map. Add an `onClick` that calls a navigation function (passed as prop from `ConsiliumHub` or `Sanctum`) to switch to the NarrativeFlow tab and optionally zoom to that narrative hub.

### 8. Zoom Dropdown (Figma-style)
**File**: `frontend/components/narrative/NarrativeFloatingToolbar.tsx`
Replace the current zoom percentage text display with a proper dropdown:
- Shows current zoom level (e.g. "55%")
- Dropdown options: 25%, 50%, 75%, 100%, 150%, 200%, Fit to Screen
- Show keyboard shortcut hints (Cmd+/Cmd-)
- On select: call `onZoomTo(level)` or `onFitView()`
- Styled in Solvys Gold (dark bg, gold accent, small text)

### 9. Think Harder → Pulsing Icon (everywhere)
**Files**: `frontend/components/chat/AskHarpChatPanel.tsx`, `frontend/components/ui/chatgpt-prompt-input.tsx`, any other chat input
The pulsing icon was added to `chatgpt-prompt-input.tsx` (3 references) but NOT to `AskHarpChatPanel.tsx` (0 references). Make sure EVERY chat input that talks to an agent has:
- The Think Harder button replaced with a pulsing icon
- Icon ONLY pulses (CSS `scale(1) → scale(1.15) → scale(1)` over 1.5s infinite)
- No background, no border when clicked/enabled
- When disabled: static, slightly dimmed

### 10. Boardroom Newspaper RiskFlow Button
**File**: `frontend/components/consilium/AgentChattr.tsx`
In the boardroom chat input ONLY:
- Swap Think Harder for a newspaper icon (`Newspaper` from lucide-react)
- Click opens a RiskFlow item picker — same as "Import RiskFlow items" in NarrativeFlow (reuse `RiskFlowImportModal` or similar)
- Selected items attach to the message as context chips

### 11. TopStepX Theme Matching
**Files**: `frontend/lib/theme.ts`, `frontend/index.css`
When TopStepX browser is enabled (`topStepXEnabled === true`), the Fintheon UI chrome must blend with TopStepX's darker charcoal background.
- Add a CSS class `.topstepx-active` that slightly darkens `--fintheon-bg` and `--fintheon-surface` by ~10%
- Apply in `MainLayout.tsx` when `topStepXEnabled` is true
- The Strategium border should not clash with TopStepX's chart area
- Target: seamless appearance between Fintheon panels and the TopStepX iframe

### 12. Toast Notifications — Full Refactor
**File**: `frontend/components/NotificationToast.tsx`
Refactor toasts to look like RiskFlow items in the Strategium panel:
- Same card structure, layout, badges as Strategium RiskFlow items
- Maintain frosted glass: `bg-[var(--fintheon-surface)]/80 backdrop-blur-xl`
- Bullish/bearish coloring on implied point value: `var(--fintheon-bullish)` / `var(--fintheon-bearish)`
- Theme-sensitive (colors follow user's selected theme)

### 13. Expand Content Panel — Kill Padding
**File**: `frontend/components/layout/MainLayout.tsx`
Check for any padding/margin/gap between the NavSidebar and the start of content on both sides. If there's visual spacing between the sidebar edge and content start, remove it. Content should fill edge-to-edge.

### 14. Apparatus Text Size on Expand
**File**: `frontend/components/apparatus/ApparatusPage.tsx`
When commandment cards expand (Rules of Engagement), the body text is too small. Increase to 13-14px for body, 16px for headings. Make sure expanded content is readable at a glance.

### 15. Checkpoints → Conversation History
**File**: `frontend/components/chat/AskHarpChatPanel.tsx` or wherever "Checkpoints" tab renders
The "Dawn Dispatch", "New Chat", "Checkpoints" header in Ask Harp — swap "Checkpoints" for actual conversation history. Harper-Opus (Claude CLI) now has real conversations stored via `harper-handler.ts` → conversation store. List past conversations with timestamps, allow clicking to load history.

---

## VERIFICATION
1. `bun run build` — clean
2. Open app → NarrativeFlow: ALL 10 narrative hubs visible with cards orbiting
3. Ropes visible: colored by narrative thread, breathing animation
4. Canvas command palette: type → ephemeral response → auto-hides
5. RiskFlow panel: 25+ items loading, infinite scroll working
6. RiskFlow header: "Risk Flow" title, "X" (not "X CLI"), status dot
7. Aquarium: No simulation history, agent scorecards visible
8. Active narratives: clicking navigates to NarrativeFlow
9. Timeline: shimmer numbers, bigger title
10. Ask Harp: pulsing icon in all chat inputs, boardroom has newspaper icon
11. TopStepX: enable browser → panels blend seamlessly
12. Toasts: look like Strategium RiskFlow items with frosted glass
13. Apparatus: expanded text readable (13-14px)
14. Zoom dropdown works with Cmd+/Cmd- hints
15. Checkpoints → shows conversation history

## CHANGELOG
```typescript
{ date: '2026-03-29T__:__:__', agent: 'claude-code', summary: 'S8-UNIFY: Fix missing items — RiskFlow feed, narrative display, sim history removal, TopStepX theme, toast refactor, pulsing icons, boardroom newspaper, zoom dropdown, conversation history', files: ['frontend/components/narrative/Sanctum.tsx', 'frontend/components/RiskFlowPanel.tsx', 'frontend/components/NotificationToast.tsx', 'frontend/components/consilium/AgentChattr.tsx', 'frontend/components/chat/AskHarpChatPanel.tsx', 'frontend/components/narrative/NarrativeFloatingToolbar.tsx', 'frontend/components/narrative/SanctumNarratives.tsx', 'frontend/components/layout/MainLayout.tsx', 'frontend/lib/theme.ts', 'frontend/index.css'] }
```

## DO NOT
- Do NOT rewrite components that already work (force layout, hub nodes, ropes, CategoryScoreCard)
- Do NOT touch the MiroShark backend (it's done)
- Do NOT modify the context bank or infrastructure (T8 is done)
- Do NOT create new components unless absolutely necessary — wire existing ones
- Do NOT add features beyond what's listed here
