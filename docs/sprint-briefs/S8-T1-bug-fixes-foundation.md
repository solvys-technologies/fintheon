# S8-T1: Bug Fixes + Foundation

**Sprint**: S8 — The Mega Sprint
**Track**: T1 (runs first, all other tracks depend on this)
**Branch**: `v.8.28.1`

## Context
Multiple critical bugs block the app from being usable: RiskFlow feed shows "Polling Sources...", Aquarium shows ERROR badge + "Simulation failed: 500", Timeline shows 0 events despite 628 in the DB, and zero ropes render on the Observatory map despite all 612 cards having tags. Additionally, kanban-style borders need to be killed everywhere, the layout needs padding removed, and foundational cleanup (MiniMap removal, duplicate toolbar, keyboard shortcuts) must happen before other tracks can build.

## Files to Read First
- `frontend/lib/apiClient.ts` (322 lines) — auth skip cascade, `shouldSkipRequest()`, public endpoint exemptions
- `frontend/contexts/RiskFlowContext.tsx` (392 lines) — feed polling logic, merge/dedup
- `frontend/lib/services.ts` (257-351) — `RiskFlowService.list()` response mapping
- `frontend/components/RiskFlowPanel.tsx` (line 655) — "Polling Sources..." text
- `frontend/components/consilium/ConsiliumHub.tsx` (160-206) — `handleRunMiroFish()`, error state
- `frontend/components/narrative/SanctumHeader.tsx` (48-51) — ERROR badge display
- `frontend/components/narrative/NarrativeForceCanvas.tsx` (320-360) — `filteredCatalysts` filter, `visibleLaneIds` bug
- `frontend/components/narrative/TimelinePanel.tsx` — data flow for events
- `frontend/components/narrative/NarrativeFloatingToolbar.tsx` — zoom display
- `frontend/components/narrative/NarrativeFlow.tsx` — wrapper, state management
- `frontend/components/layout/MainLayout.tsx` (695-720) — sidebar/content padding
- `frontend/components/ui/KanbanTitle.tsx` — kanban border component
- `frontend/components/narrative/CategoryScoreCard.tsx` — `border-l-2` kanban style
- `frontend/lib/severity-config.ts` — severity colors (theme-sensitive CSS vars)
- `frontend/index.css` — CSS variables, design tokens

## Fixes to Implement

### 1. RiskFlow Feed Fix
Open browser console in the Electron app, identify the actual error:
- If `ERR_CONNECTION_REFUSED` → backend not running, check `dist/index.js` compilation
- If response shape mismatch → fix `RiskFlowService.list()` mapping (services.ts:257-351). It maps `headline→title`, `body→content+summary`. Verify backend response fields match.
- If `auth_skipped` → check `shouldSkipRequest()` (apiClient.ts:72-84). `/api/riskflow/` is in the exemption list (line 149), so auth should be bypassed.
- Add defensive fallbacks in the service mapping for missing fields.

### 2. Aquarium ERROR Badge Fix
In `ConsiliumHub.tsx`:
- On mount, fetch `/api/mirofish/latest` to load cached report (read-only, no simulation)
- Set default state to `'idle'` (not `'error'`). Only show ERROR badge if user clicks "Update" and the simulation actually fails.
- Check `.env` for `FINTHEON_FEATURE_FLAGS={"mirofish":true}` — if missing, add it.

### 3. Timeline Empty Fix
In `TimelinePanel.tsx`:
- Trace data flow: does it read from `useNarrative().state.catalysts`?
- Check if the seed loader (`loadSeedEvents()`) runs before TimelinePanel renders
- Check the localStorage flag `fintheon:narrative-seeded:v5` — if already set, seed events won't load again. May need to bump the version or clear it.
- Verify events have the `narrative` field set (used for grouping into threads)

### 4. Rope Visibility Root Cause
In `NarrativeForceCanvas.tsx` lines 332-343:
```
let cards = state.catalysts.filter(c => {
  const cat = c.category ?? c.narrativeIds?.[0];
  if (!cat) return true;
  return visibleLaneIds.size === 0 || visibleLaneIds.has(cat);
});
```
- `visibleLaneIds` contains thread slugs like `'rate-cut-cycle'`
- `c.category` contains category names like `'macroeconomic'`
- These are DIFFERENT namespaces — cards get filtered out!
- **Fix**: Change to compare `c.narrative` (the thread slug) against `visibleLaneIds`, OR use `c.category` only when `visibleLaneIds` is empty, OR map categories to thread slugs.
- After fix, verify console shows `[NarrativeFlow] Rope engine: X connections computed, Y valid` with X > 0.

### 5. Kill Kanban Borders
- `KanbanTitle.tsx` — Either remove the component entirely or refactor to a flat heading (no bordered container, no `border` class). Keep the title text styling.
- `CategoryScoreCard.tsx` — Replace `border-l-2` with full card border: `border` (all sides) colored by category heat via `ivHeatColor(score)`. Add volatility fuse (progress bar showing the IV score metric). Replace confidence bar with percentage text (`72%`) in same spot.
- `Sanctum.tsx` — Remove `<KanbanTitle>` usage at line 282 (Econ Intelligence header) and any other instances. Use flat heading text instead.
- `AskHarpChatPanel.tsx` — Remove bordered message card containers around agent responses.

### 6. Layout Expansion
In `MainLayout.tsx`:
- Find padding between NavSidebar and center content. The sidebar is in a `<div className="relative">` and content is `<div className="flex-1 overflow-hidden">`. Kill any gap/padding between them on both sides.
- Right panels have `border-l border-[var(--fintheon-accent)]/15` — keep but reduce opacity.

### 7. Remove MiniMap + White Square
In `NarrativeForceCanvas.tsx`:
- Remove `<MiniMap />` component and its import from `@xyflow/react`
- The white square in top-right — find and remove or replace with zoom controls

### 8. Remove Duplicate Floating Toolbar
In `NarrativeFlow.tsx`:
- Find the duplicate toolbar rendering (there are two toolbar instances, one sitting underneath)
- Remove the duplicate, keep one

### 9. Keyboard Shortcuts + Zoom Dropdown
In `NarrativeFlow.tsx`:
- Add `useEffect` with `keydown` listener for `Cmd+=` (zoom in) and `Cmd+-` (zoom out)
- Call `reactFlowInstance.zoomIn()` / `reactFlowInstance.zoomOut()`
- `e.preventDefault()` to stop browser zoom

In `NarrativeFloatingToolbar.tsx`:
- Replace `Math.round(scale * 100)%` text display with a dropdown
- Options: 25%, 50%, 75%, 100%, 150%, 200%, Fit to Screen
- Show `Cmd+/Cmd-` hints
- Styled in Solvys Gold palette

### 10. Install Impeccable
```bash
npx skills add pbakaus/impeccable
```

## Verification
1. `bun run build` — clean, no errors
2. Open app → Dashboard → RiskFlow panel shows feed items (not "Polling Sources...")
3. Consilium → Sanctum → Aquarium: No ERROR badge on initial load
4. Consilium → Sanctum → Timeline: Events visible for at least some narratives
5. Consilium → Sanctum → NarrativeFlow: Console shows rope connections > 0
6. No kanban left-borders visible anywhere (CategoryScoreCard has whole border)
7. No MiniMap in bottom-right of React Flow
8. No duplicate toolbar
9. Cmd+= and Cmd+- zoom works
10. Content fills edge-to-edge between sidebar and right panels

## Changelog Entry
```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S8-T1: Fix RiskFlow feed, Aquarium ERROR, Timeline empty, rope visibility root cause, kill kanban borders, layout expansion, MiniMap removal, keyboard shortcuts', files: ['frontend/lib/apiClient.ts', 'frontend/contexts/RiskFlowContext.tsx', 'frontend/components/narrative/NarrativeForceCanvas.tsx', 'frontend/components/narrative/NarrativeFloatingToolbar.tsx', 'frontend/components/narrative/CategoryScoreCard.tsx', 'frontend/components/ui/KanbanTitle.tsx', 'frontend/components/layout/MainLayout.tsx', 'frontend/components/consilium/ConsiliumHub.tsx'] }
```

### 11. TopStepX Theme Color Matching
When TopStepX browser is enabled (iframe open), the Fintheon UI chrome (header, sidebar, strategium) must blend seamlessly with TopStepX's dark trading UI. Currently there's a color mismatch between Fintheon's Solvys Gold/Stone themes and TopStepX's darker charcoal/orange palette.
- Match `--fintheon-bg` and `--fintheon-surface` to TopStepX's background tone when in "Castra" layout mode
- The Strategium right panel border should not clash with TopStepX's chart area
- TopStepX uses orange accents (#F97316-ish) for its buttons — Fintheon's gold (#c79f4a / #D4AF37) is close but the backgrounds differ
- Check `frontend/components/TopStepXBrowser.tsx` for the iframe wrapper styling
- May need a CSS class or theme override that activates when `topStepXEnabled === true` to darken surfaces slightly
- **Files**: `frontend/lib/theme.ts` (Solvys Stone preset), `frontend/components/TopStepXBrowser.tsx`, `frontend/index.css`

## DO NOT
- Do NOT touch force-directed layout logic (T2 owns that)
- Do NOT redesign card visuals (T2/T4 own that)
- Do NOT rename MiroFish to MiroShark (T5 owns that)
- Do NOT modify Ask Harp chat (T7 owns that)
- Do NOT add new components — this track is fixes only
