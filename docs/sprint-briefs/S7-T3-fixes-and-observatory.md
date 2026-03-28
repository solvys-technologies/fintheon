# S7-T3: Critical Fixes + Observatory Map Redesign

## Context
S7 sprint built: React Flow mind map, Sanctum dropdown nav, Aquarium rename, 10 narrative threads, paginated Timeline, Apparatus constellation, prediction cards, seed reclassification. BUT several critical issues remain from this session that must be fixed first.

## CRITICAL BUGS (fix first)

### 1. RiskFlow Feed Not Loading
- **Symptom**: Dashboard and right-panel RiskFlow both show "Polling Sources..." or "No actions in the feed"
- **Backend curl works**: `curl localhost:8080/api/riskflow/feed?limit=3` returns items
- **Root cause candidates**:
  - `apiClient.ts` auth skip cascade: we added public endpoint exemptions but check if `shouldSkipRequest()` is still blocking
  - The DMG's Electron spawns `node dist/index.js` — check if the dist compiled clean after the predictions.ts import fix
  - The frontend `RiskFlowContext.tsx` polls via `backend.riskflow.list()` — trace the actual error in console
- **Files**: `frontend/lib/apiClient.ts`, `frontend/contexts/RiskFlowContext.tsx`, `frontend/lib/services.ts`
- **Fix approach**: Open browser console in the DMG app, look for the actual error. If it's `ERR_CONNECTION_REFUSED`, backend didn't start. If it's `auth_skipped`, the auth exemption isn't working.

### 2. Aquarium "ERROR" Badge
- **Symptom**: Aquarium page shows ERROR next to title
- **Root cause**: MiroFish simulation endpoint failing. The `handleRunMiroFish` in ConsiliumHub.tsx calls `/api/mirofish/simulate` which requires OpenClaw Gateway API. Check `backend-hono/.env` for `OPENCLAW_API_KEY` / `OPENCLAW_GATEWAY_URL`.
- **User wants**: Swap MiroFish for "MiroShark" — new/improved simulation engine. For now, at minimum make the error not show and ensure the persisted report loads from `/api/mirofish/latest`.
- **Files**: `frontend/components/consilium/ConsiliumHub.tsx` (handleRunMiroFish), `backend-hono/src/services/mirofish/mirofish-service.ts`

### 3. Ropes Still Not Visible
- **What was done**: Removed `parentId`/`extent` from child nodes so edges can cross groups. Added debug log.
- **Verify**: Check browser console for `[NarrativeFlow] Rope engine: X connections computed, Y valid`. If X > 0 and Y > 0, edges should render. If edges exist but aren't visible, it may be a z-index or opacity issue.
- **Files**: `frontend/components/narrative/NarrativeForceCanvas.tsx` (layoutNodes function), `frontend/lib/narrative-rope-engine.ts`

## FEATURES TO BUILD

### 4. Observatory Map Redesign (NarrativeFlow)
The map currently lays out all 612 events in a flat grid inside narrative groups. TP wants:

**Zoom-out behavior**: When zoomed out past a threshold, individual cards collapse into **summary cards** per narrative showing item count + dropdown.
- **Single click**: Expand inline preview (top 5 items as list)
- **Double-click**: Auto-zoom into that narrative group revealing all cards
- **Design feel**: Observatory — spacious, contemplative, clean. Dark bg, soft muted cards, generous spacing, subtle gold ropes, calm analytical feel.

**Layout**: Force-directed clustering — narratives with more shared events pull closer. Trump Presidency is central (connects to everything). Rate Cuts + Price Stability cluster. Middle East + Trade War cluster.

**Zoom controls**: Remove the current 55% text display. Replace with a Figma-style dropdown at that position showing zoom level + Cmd+/- keyboard shortcuts. Add `Cmd+=` to zoom in, `Cmd+-` to zoom out.

### 5. Econ Intelligence Data Pipeline
- Cards currently show no data ("ghost town")
- Fix was applied: `readEconHistory` now uses keyword patterns instead of `ECON_DATA` tag
- Needs verification that the backend keyword search actually returns FJ tweet data
- "traders price in" + "cuts" patterns for rate cut expectations
- **Files**: `backend-hono/src/services/supabase-service.ts` (readEconHistory), `backend-hono/src/routes/data/index.ts` (econ-calendar enrichment)

### 6. MiroShark Engine Swap
- TP wants to replace MiroFish with "MiroShark" — better simulation engine
- Diagnose why current engine errors, then decide whether to fix or replace
- **Files**: `backend-hono/src/services/mirofish/` directory

### 7. Add Event Button → Proposals Panel
- Currently TimelinePanel has "Add Event" at bottom
- Move it to the Proposals right panel instead
- Use `/the-feels` design language

### 8. Keyboard Shortcuts
- `Cmd+=` zoom in, `Cmd+-` zoom out on NarrativeFlow canvas
- These should call `reactFlow.zoomIn()` / `reactFlow.zoomOut()`

## Key Files
```
frontend/components/narrative/NarrativeForceCanvas.tsx  — React Flow canvas
frontend/components/narrative/NarrativeFlow.tsx          — Main wrapper
frontend/components/narrative/NarrativeFloatingToolbar.tsx — Bottom toolbar
frontend/components/narrative/TimelinePanel.tsx           — Paginated timeline
frontend/components/consilium/ConsiliumHub.tsx            — Tab routing
frontend/components/narrative/Sanctum.tsx                 — Aquarium page
frontend/lib/narrative-rope-engine.ts                     — Tag-based connections
frontend/lib/apiClient.ts                                 — API client with auth skip
frontend/contexts/RiskFlowContext.tsx                      — Feed polling
backend-hono/src/routes/predictions.ts                    — Prediction API
backend-hono/src/services/supabase-service.ts             — Econ history queries
backend-hono/src/services/mirofish/                       — Simulation engine
```

## 10 Narrative Threads (in Supabase `narrative_threads` table)
1. middle-east-conflict (146 events)
2. liquidity-credit-contraction (101)
3. ai-singularity (30)
4. usd-jpy-carry-trade (21)
5. trade-war (46)
6. us-china-relations (11)
7. rate-cut-cycle (98)
8. trump-presidency (40)
9. price-stability (100)
10. maximum-employment (19)

## Solvys Gold Palette
- BG: #050402, Accent: #c79f4a, Text: #f0ead6
- Fonts: var(--font-heading), var(--font-body), var(--font-mono)
- No gradients, no colored emojis

## Verification
1. `npx vite build` — clean
2. Open app → Dashboard → RiskFlow panel should show items
3. Consilium → Sanctum → NarrativeFlow: see grouped cards with gold rope edges
4. Consilium → Sanctum → Aquarium: no ERROR badge, prediction cards visible
5. Consilium → Sanctum → Timeline: 2-column paginated view, prev/next works
6. Consilium → Apparatus: agent constellation with nucleus + orbiting cards
