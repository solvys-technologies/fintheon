# S14 — Aquarium Revival + Pipeline Hardening + CAO Memory

**Date**: 2026-04-11
**Tracks**: 10 parallel + 1 review/unify
**Execution**: `/solvys-orchestrate` with worktree isolation per track
**Frontend directive**: `/the-feels` on all UI tracks

## Context

MiroShark dead for days — frontend sends empty narrative state (`{ lanes: [], catalysts: [], ropes: [] }`) to simulate endpoint, producing garbage 5.0 scores with no real analysis. Feed pipeline works but goes stale from Rettiwt rate limiting; Agent Reach fallback exists but fires too passively. Timeline filters broken. Boardroom DAG shows raw API response instead of streaming agent output. SplashScreen unwired. Artifact parser, boardroom thread store, and CAO memory infrastructure exist but aren't connected. 6 confirmed orphan files. Multiple UI polish issues across chat surfaces.

---

## T1: MiroShark Revival (CRITICAL)

**Goal**: Fix MiroShark so simulations produce real analysis, not garbage 5.0 scores.

**Root cause**: `ConsiliumHub.tsx:417` sends `{ lanes: [], catalysts: [], ropes: [] }` — empty narrative state.

**Files**:

- `frontend/components/consilium/ConsiliumHub.tsx` — populate narrativeState from NarrativeContext before calling simulate
- `frontend/contexts/NarrativeContext.tsx` — expose lanes/catalysts/ropes getter
- `backend-hono/src/routes/miroshark/handlers.ts:81` — add server-side fallback: if lanes are empty, pull recent scored_riskflow_items and synthesize lanes from narrative threads
- `backend-hono/src/services/miroshark/miroshark-service.ts` — validate context snapshot has VIX + headlines before running
- `backend-hono/src/services/miroshark/miroshark-deliberation.ts` — persist deliberation results to Supabase (extend `mirofish_runs` or new table). Persist forever — no TTL

**Verify**: Trigger simulate from Consilium, confirm deliberation phases run with real headlines, composite IV reflects actual market, briefing contains specific findings.

---

## T2: Boardroom DAG Streaming Fix

**Goal**: When user writes a memo or triggers a DAG, show streamed agent output — not raw API response.

**Root cause**: Frontend dispatches DAG but doesn't subscribe to the SSE stream at `/api/boardroom/dag/:dagId/stream`.

**Files**:

- `frontend/components/miroshark/MiroSharkDebatePanel.tsx` — verify SSE subscription works for deliberation view
- `backend-hono/src/routes/boardroom/index.ts` — verify SSE stream endpoint
- Frontend boardroom component that dispatches DAGs — wire EventSource to stream URL, render agent responses as they arrive
- Wire `boardroomThreadStore.ts` — persist completed DAG threads to Supabase for history (forever, no TTL)

**Verify**: Trigger a memo/DAG from boardroom UI, see agent responses stream in real-time, thread persists after completion.

---

## T3: Feed Pipeline Hardening — Force Refresh + Source Polling

**Goal**: Every force refresh polls ALL non-Twitter scrapers. X polling runs without interruption. Agent Reach fires aggressively when rate limited.

**Files**:

- `backend-hono/src/services/riskflow/feed-poller.ts` — on manual refresh, always trigger Agent Reach scraping (not just as fallback). Scrape FinancialJuice, ZeroHedge, Reuters, CNBC, WSJ, MacENews every refresh
- `backend-hono/src/services/riskflow/econ-rettiwt-poller.ts` — ensure continuous X polling; if rate limited, reduce interval but never stop
- `backend-hono/src/services/agent-reach-service.ts` — already built, may need more aggressive invocation
- `backend-hono/src/services/riskflow/feed-service.ts:146` — reduce CACHE_REFRESH_INTERVAL_MS from 120s to 30s
- `backend-hono/src/routes/riskflow/handlers.ts` — refresh handler must trigger all scrapers, not just Rettiwt
- X auth per user: **OAuth flow** — onboarding opens CLI terminal script to auto-login to X, token captured automatically. Editable in Settings. Auto-enroll active users into polling rotation queue
- `backend-hono/src/services/riskflow/rettiwt-poller-accounts.ts` — extend to pull tokens from team_members table instead of hardcoded list
- `frontend/components/team/TeamOnboarding.tsx` — add X OAuth step with CLI auto-open

**Verify**: Hit force refresh, confirm items from multiple non-Twitter sources appear within 30s. Check feed-health.log shows `rateLimited=True` but fresh items still flowing via Agent Reach.

---

## T4: Timeline Filters Fix + Time Range

**Goal**: Fix broken filters on Timeline (Main + popover). Add time range filter. Add box toggle above first narrative filter.

**Files**:

- `frontend/components/narrative/TimelinePanel.tsx` — fix filter state, add time range dropdown (1h, 4h, 1d, 1w, custom)
- `frontend/components/layout/TimelineOverlay.tsx` — same filter fixes for popover timeline
- Add toggle box row above first narrative filter dropdown for quick enable/disable
- Ensure filters actually filter the rendered items (currently they don't)

**Design**: `/the-feels`

**Verify**: Open Timeline, apply filters, confirm items filter correctly. Toggle time range, confirm items scope correctly. Open popover timeline, confirm same filters work.

---

## T5: Feed Refresh Consistency (Red Flag Kill)

**Goal**: Feeds across Dashboard, Strategium, RiskFlow Main, and Boardroom refresh consistently without going stale.

**Files**:

- `frontend/contexts/RiskFlowContext.tsx:334-342` — ensure poll interval fires reliably
- `frontend/components/feed/RiskFlowMain.tsx` — verify infinite scroll + refresh cycle
- `frontend/components/executive/MainDashboard.tsx` — verify feed widget refreshes
- `backend-hono/src/boot/services.ts:129` — ensure `seedCacheFromDb()` blocks boot until cache is warm
- `backend-hono/src/services/riskflow/feed-service.ts` — reduce cache staleness window
- Add "attach recent headlines" — pull from scored_riskflow_items. Support **multi-select** via **popover list** (searchable, checkboxes, inline near input bar). Available in: **boardroom chat, sidebar chat, and main Consilium chat**

**Verify**: Open each surface (Dashboard, Strategium, RiskFlow Main), confirm items appear within 5s of app load. Wait 2 minutes, confirm new items appear without manual refresh.

---

## T6: SplashScreen Redesign

**Goal**: Replace black temple doors with liquid glass loading screen.

**Design spec**:

- Background: shuffled image from `public/halftone-heroes/` rotation (same as login)
- Transition current bg to next shuffled bg
- Floating liquid glass window (black tint, backdrop-blur, rounded) centered on screen
- Inside: `public/fintheon-logo.png` (logo without app name, sized ~80px)
- Below logo: status text in **Playfair Display** (non-italicized), Solvys Gold color
- No "FINTHEON" text, no Cinzel font, no full-width black bars
- Fade out when app is ready
- Show on **first-ever launch** (full splash) and **cold starts** (after quit). NOT on resume from background

**Files**:

- `frontend/components/SplashScreen.tsx` — full rewrite
- `frontend/components/auth/AuthShell.tsx` — reference for HERO_BACKGROUNDS array and shuffle logic
- Wire SplashScreen into `MainLayout.tsx` or `App.tsx` so it actually renders on load

**Design**: `/the-feels`

**Verify**: Reload app, see liquid glass splash with shuffled background, logo, Playfair text. Confirm it fades when app loads.

---

## T7: Artifact Parser + Chat Wiring

**Goal**: Wire artifact-parser.ts into chat so trade proposals, catalysts, and narrative items render inline.

**Files**:

- `frontend/lib/artifact-parser.ts` — already complete (parseArtifacts, toCatalystPayload, stripArtifactBlocks)
- `frontend/components/chat/FintheonThread.tsx:121-137` — in FintheonTextPart, call parseArtifacts on text content, strip blocks for markdown, render artifact cards inline
- `frontend/contexts/NarrativeContext.tsx` — dispatch parsed catalysts via ADD_CATALYST action
- New: `frontend/components/chat/ArtifactCard.tsx` — inline render for trade-proposal and catalyst types
- Boardroom agent panel — same artifact parsing for agent responses

**Design**: `/the-feels`

**Verify**: Send a message to Harper that triggers a trade proposal artifact. Confirm it renders as a card in chat, not raw JSON. Confirm catalyst artifacts dispatch to NarrativeFlow.

---

## T8: CAO Memory System + Naming

**Goal**: Per-user Chief Agentic Officer (default: Harper) with shared firm memory bank, interval flush, and rename capability.

**Existing infrastructure**:

- `peer_shared_memory` table in Supabase (categories, TTL, CRUD)
- `backend-hono/src/services/peers/shared-memory.ts` — shared memory service
- `backend-hono/src/routes/memory/index.ts` — memory CRUD routes
- `backend-hono/src/services/agent-context-bank-service.js` — agent context bank
- `frontend/components/memory/SharedMemoryPanel.tsx` — memory UI

**New work**:

- Add `cao_name` field to user profile / team_members table (default: "Harper")
- Onboarding: prompt user to name their Chief Agentic Officer during team card creation
- First chat open: if CAO unnamed, modal reminder
- Settings UI: always editable in Settings, persist via endpoint
- Backend: memory flush every **10 messages** — scan conversation for saveable insights, trade ideas, analysis notes. Sessions under 10 messages are not flushed. Also support **verbal flush** — user says "remember this" or similar in chat prompt and CAO saves immediately
- Shared firm memory: team-wide entries visible to all CAOs, individual entries scoped to user
- Frontend: CAO name reflects everywhere Harper is referenced (chat header, team panel, etc.)

**Verify**: Go to Settings, rename CAO. Chat with CAO, confirm memory entries appear in SharedMemoryPanel. Switch users, confirm shared firm entries visible but individual entries scoped.

---

## T9: Consilium Chat + Sidebar + Imperium UI Polish

**Goal**: Fix chat interface colors, input bar behavior, sidebar formatting, rename Boardroom to Imperium, smooth transitions everywhere.

**Color & Input**:

1. Chat header background — match `var(--fintheon-bg)` seamlessly like Timeline does
2. Gradient removal — remove visible gradient in chat area
3. Chat input bar — transparent when idle, on focus: soft 1.3s glow on borders + send button lights up
4. Sidebar chat — same color fixes, fix button formatting going off-screen
5. Remove "Local" text from provider selector pill, icon only
6. Sidebar persona selector → CAO-only (no sub-analyst calls). Main chat keeps full persona selection
7. Delete duplicate provider selector in sidebar chat header

**Transitions**: 8. Smooth transitions on: new chat selection, suggestion chip clicks, conversation history popups, team onboarding modal, bulletin open/close, footer panel expand/collapse, all modals/panels

**Renames & Restructure**: 9. Boardroom tab → **Imperium**. Subheader: "Wield the Consul". Strip old Imperium view from app entirely. Agent Forum is a sub-view within Imperium 10. Remove timeframe toggle from Agent Forum area 11. Harper Activity re-expand — add toggle button after closing
11b. RiskFlow in Strategium re-expand — add toggle + transition when section reappears

**Chat Header Cleanup**: 12. Remove "What needs orchestrating today?" subtitle
12b. Remove "Claude Opus 4.6" model label
12c. Rename "Harper-Opus" → "Harper" everywhere (header, persona pill, sidebar, all references)

**Team Cards & Onboarding**: 13. RiskFlow killswitch pill toggle on team cards — description left, toggle right, smooth animation 14. Remove "Login with Supabase account" from onboarding Step 1. Google OAuth is the single gate. Onboarding starts at team card creation

**Files**:

- `frontend/components/consilium/ConsiliumHub.tsx`
- `frontend/components/chat/FintheonThread.tsx`
- `frontend/components/ui/chatgpt-prompt-input.tsx`
- Sidebar chat component
- `frontend/components/team/TeamMemberCard.tsx`
- `frontend/components/team/TeamOnboarding.tsx`
- `frontend/components/layout/FooterToolbar.tsx`
- All Imperium/Boardroom components

**Design**: `/the-feels`

**Verify**: Chat header blends like Timeline. Input bar glows on focus. Sidebar clean. Imperium renamed. All panels have smooth transitions. Harper-Opus → Harper everywhere. Team cards have killswitch toggle. Onboarding skips Supabase step.

---

## T10: Dead Code Cleanup + Orphan Deletion

**Goal**: Delete confirmed orphans, clean stale references, rename X labels, verify build.

**Delete**:

- `frontend/components/InterventionSidebar.tsx` (146 lines)
- `frontend/components/MainContent.tsx` (68 lines)
- `frontend/components/NotFoundPage.tsx` (81 lines)
- `frontend/components/executive/AgentChatroomView.tsx` (orphan + hardcoded localhost)
- `frontend/hooks/useCloudState.ts` (141 lines)
- `frontend/components/ui/SPQRStamp.tsx` (orphan stamp)

**Keep** (wired in other tracks):

- `frontend/lib/artifact-parser.ts` → T7
- `frontend/lib/boardroomThreadStore.ts` → T2
- `frontend/lib/easter-eggs.ts` → Sunday project
- `frontend/lib/FintheonModelCatalog.ts` → wire into chat model config
- `frontend/lib/iv-agent.ts` → future Hermes integration

**Also**:

- Clean stale `twitter-cli` string references in feed-service.ts comments
- Rename all user-facing "Rettiwt" and "Twitter" labels → "X" (footer status, source filters, card badges)
- `frontend/.env.production` — localhost:8080 is correct (Electron app), leave as-is
- Update `src/lib/changelog.ts` with all S14 changes

**Verify**: `bun run build` passes. No broken imports. No TypeScript errors.

---

## T11: Review + Unify (FINAL — after T1-T10 merge)

**Goal**: Independent review instance. Debug, test, debug, test, unify.

1. Pull all T1-T10 changes
2. `bun run build` — must pass
3. `npx tsc --noEmit` — must pass
4. Start backend + frontend dev servers
5. Test each track's verify criteria end-to-end
6. Fix integration issues between tracks
7. Feed health check — confirm pipeline flows
8. MiroShark simulation — confirm real analysis with real data
9. Boardroom DAG streaming — confirm memo works
10. Timeline filters — confirm filtering works
11. Chat UI — confirm all polish items match screenshots
12. Final build + commit + changelog

---

## Execution Order

**Wave 1 (Parallel)**: T1 through T10 — all launch simultaneously via worktree isolation. No cross-dependencies during implementation.

**Wave 2 (Sequential)**: T11 launches after all T1-T10 complete. Merges, tests, fixes integration, ships.

## Design Directive

All frontend tracks use `/the-feels`. No generic AI aesthetics. Solvys Gold palette (#c79f4a accent, #050402 bg, #f0ead6 text). No gradients. No colored emojis. No kanban borders.
