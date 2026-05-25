# S68-ORCH — NarrativeFlow: Theme Intelligence Surface

- **Parent sprint branch**: `sprint/S68`
- **Cycle**: Cycle 8 (Closed Beta)
- **Due**: June 20
- **Owner**: Shashank

## What this covers

NarrativeFlow is the Solvys surface that displays market catalysts promoted from RiskFlow into narrative threads. It has not been meaningfully updated since the canvas physics foundation landed. This sprint transforms NarrativeFlow from a general narrative display into an **impact-intelligence surface** — the place where traders see which themes are moving markets, how they're shifting, and what the impact probability looks like.

Carries forward the S63 Phase 2 Theme Intelligence work (SOL-119, SOL-120, SOL-118) that was planned but never shipped because S63 got repurposed for Dock & Lockout. Adds NarrativeMap pan persistence (SOL-117) and canvas-level polish.

## Why now

S61-S67 shipped governance, lockout, desk plan, chat overhaul, and UI polish. The narrative intelligence layer is the next major gap. Traders can see catalysts in RiskFlow and deliberate in Arbitrum, but there's no surface that connects the dots — no place that says "here's what matters, here's how it's shifting, here's the impact."

## Codebase map

### Narrative surfaces (primary targets)

- `frontend/components/narrative/NarrativeCanvas.tsx` — Canvas-based bubble physics (326 lines, needs refactor)
- `frontend/components/narrative/Sanctum.tsx` — Parent container (460 lines, hosts NarrativeFlow)
- `frontend/components/narrative/SanctumNarratives.tsx` — Active narratives display
- `frontend/components/narrative/NarrativeMap.tsx` — Force-directed map view
- `frontend/components/narrative/CatalystCard.tsx` — Individual catalyst card component

### Backend services (new + replace)

- `backend-hono/src/services/regime/` — **Being replaced** by Theme Tracker (regime-detector.ts, regime-service.ts, propose.ts)
- `backend-hono/src/services/riskflow/` — RiskFlow scoring engine (source of catalyst data)
- `backend-hono/src/services/narrative/` — Existing narrative service
- `frontend/contexts/NarrativeContext.tsx` — Narrative state management (171 lines)
- `frontend/lib/narrative-physics.ts` — Bubble physics engine (219 lines)
- `frontend/lib/narrative-canvas-renderer.ts` — Canvas drawing routines (348 lines)

### Data hooks

- `frontend/hooks/useRiskFlow.ts` — RiskFlow feed hook
- `frontend/components/narrative/useIVScoreData.ts` — IV score data hook (48 lines)
- Catalyst data flows through `NarrativeContext` + `RiskFlowContext` (no dedicated useCatalystData hook)

## Child tickets

### SOL-120 — S68-T1: Replace Regime Tracker with Theme Tracker (8 pts, Critical)

Branch: `sprint/S68`

**What to do**: Replace the existing Regime Tracker system with a Theme Tracker. This is the foundation — everything else consumes its API.

The Theme Tracker manages a set of active themes, each with:
- IPV (Impact Probability Value) score
- Associated catalysts
- Drift state (computed by T2)
- Status: Active / Decaying / Resolved
- Historical trajectory data

**Backend**:
- Create `backend-hono/src/services/theme-tracker/` with types, tracker logic, persistence
- Create `backend-hono/src/routes/themes/` with API:
  - `GET /api/themes` — List all active themes with IPV + status
  - `GET /api/themes/:id` — Single theme detail with catalysts
  - `POST /api/themes` — Create theme (admin/agent)
  - `PATCH /api/themes/:id` — Update theme status/metadata
  - `GET /api/themes/:id/catalysts` — Catalysts for a theme
  - `GET /api/themes/:id/drift` — Drift data for a theme
- Deprecate `backend-hono/src/services/regime-tracker/` — remove or mark deprecated
- Migrate existing regime data to theme model if applicable

**Frontend**:
- Create `frontend/hooks/useThemes.ts` — Theme data hook
- Update `frontend/components/regimes/` to read from Theme Tracker API instead of regime data
- Theme status badges component (Active=gold, Decaying=amber, Resolved=muted)

**Validation**: Theme Tracker API returns correct data. Frontend surfaces read from new source. Old regime code removed or clearly deprecated. `bun run build` passes.

### SOL-119 — S68-T2: Catalyst Drift model + drift bubble UI (5 pts, High)

Branch: `sprint/S68`

**What to do**: Build a Catalyst Drift model that tracks how a theme's narrative shifts over time. Drift measures the divergence between a theme's current IPV and its historical trajectory.

**Backend**:
- Create `backend-hono/src/services/catalyst-drift/` with:
  - Drift calculation: compare current IPV against trailing N-period average
  - Drift magnitude (0-1 scale) and direction (positive/negative)
  - Confidence score based on data volume
  - `GET /api/themes/:id/drift` endpoint (wired into T1 routes)

**Frontend**:
- Create `frontend/components/narrative/DriftBubble.tsx` — Visual bubble component
  - Color-coded by direction (gold=positive, red=negative, gray=neutral)
  - Size proportional to confidence
  - Pulse animation for high-magnitude drift
- Integration points:
  - Drift bubbles appear on catalyst cards in NarrativeFlow
  - Drift indicator in theme headers

**Validation**: Drift model produces sensible values for sample data. UI renders drift bubbles correctly. `tsc` and `vite build` pass.

### SOL-118 — S68-T3: NarrativeFlow surface refactor to impact intelligence (8 pts, Critical)

Branch: `sprint/S68`

**What to do**: Refactor the NarrativeFlow surface (NarrativeCanvas.tsx) from a general narrative display to an impact-intelligence-focused surface. This is the main user-facing deliverable.

**Changes to NarrativeCanvas.tsx**:
- Reorganize catalyst cards by theme impact (highest IPV first)
- Add IPV display to each theme section header
- Integrate drift indicators into the narrative flow
- Add theme status badges (Active/Decaying/Resolved)
- Streamline visual hierarchy: theme header > IPV summary > catalyst list > drift indicator

**Changes to Sanctum.tsx**:
- Update NarrativeFlow page to use new impact-intelligence layout
- Ensure theme data flows from Theme Tracker (T1) through to canvas
- Add filter controls: show all / active only / by theme

**New components**:
- `frontend/components/narrative/ThemeHeader.tsx` — Theme section header with IPV + drift + status
- `frontend/components/narrative/ThemeCatalystGroup.tsx` — Grouped catalyst list per theme
- `frontend/components/narrative/NarrativeFlowFilterBar.tsx` — Filter controls

**Validation**: NarrativeFlow shows impact-intelligence layout. Theme headers with IPV + drift render. Catalyst cards grouped by theme. `tsc --noEmit` passes. `vite build` passes.

### SOL-117 — S68-T4: NarrativeMap pan persistence + Sanctum nav (5 pts, High)

Branch: `sprint/S68`

**What to do**: Fix NarrativeMap pan/zoom state persistence and integrate with Sanctum navigation.

**Pan persistence**:
- Save camera state (x, y, scale) to localStorage when user navigates away
- Restore camera state when user returns to NarrativeFlow
- Add "reset view" button to return to default camera position
- Camera state key: `narrativeflow:camera:{symbol}`

**Sanctum nav integration**:
- Ensure NarrativeFlow page is properly wired in Sanctum page switching
- Add smooth transition when switching between NarrativeFlow and other Sanctum pages
- Ensure NarrativeMap force canvas and NarrativeCanvas bubble canvas share state correctly

**Validation**: Pan position persists across page switches. Reset view works. Nav transitions are smooth. No state loss on theme changes.

### S68-T5: NarrativeFlow canvas polish + micro-interactions (3 pts, Medium)

Branch: `sprint/S68`

**What to do**: Polish pass on the NarrativeFlow canvas experience.

- Add hover states to catalyst cards (lift + gold accent border)
- Add click-to-expand for catalyst details (modal or inline)
- Smooth camera transitions (animated pan/zoom, not instant)
- Add loading state for theme data (glassmorphic spinner)
- Add empty state when no themes are active
- Ensure Solvys Gold theming throughout (BG #050402, Accent #c79f4a, Text #f0ead6)
- Strip any remaining Kanban-style card borders — use frosted-glass surfaces

**Validation**: All interactions feel polished. Loading/empty states render. Solvys Gold applied consistently. No banned ornaments (no gradients, no emojis, no AI sparkles, no Kanban borders).

## Execution order (wave sequence)

### Wave 1: Foundation (must land first)

```
SOL-120 — S68-T1: Theme Tracker (backend foundation)
```

T1 builds the Theme Tracker service and API. T2 and T3 both consume this. No other track can run until T1 lands.

### Wave 2: Parallel (after T1 contract is locked)

```
SOL-119 — S68-T2: Catalyst Drift (backend model + UI component)
S68-T4: NarrativeMap pan persistence + Sanctum nav
```

T2 and T4 have zero file overlap. T2 builds drift model + bubble UI. T4 fixes pan persistence + nav.

### Wave 3: Surface integration (after T1 + T2)

```
SOL-118 — S68-T3: NarrativeFlow surface refactor
```

T3 consumes T1 (Theme Tracker API) and T2 (drift indicators). Refactors the main canvas surface.

### Wave 4: Polish

```
S68-T5: Canvas polish + micro-interactions
```

Polish pass after all functional work is complete.

## Validation

- [ ] Theme Tracker replaces Regime Tracker with full API
- [ ] Drift model produces sensible values for sample data
- [ ] Drift bubble UI renders on catalyst cards
- [ ] NarrativeFlow shows impact-intelligence layout
- [ ] Theme headers with IPV + drift + status badges render
- [ ] Catalyst cards grouped by theme (highest impact first)
- [ ] Pan position persists across page switches
- [ ] Sanctum nav transitions smoothly to/from NarrativeFlow
- [ ] Loading and empty states render correctly
- [ ] Solvys Gold theming applied throughout
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] Changelog entry added to `src/lib/changelog.ts`

## Handoff to Developer

This file is your single entry point for the S68 NarrativeFlow sprint.

**To execute:**

1. Read this entire plan file for codebase map and context
2. Follow the wave sequence — do not skip ahead
3. Each child ticket in Linear has enriched context with specific files and validation steps
4. After each ticket, run the validation steps listed in this file
5. Add changelog entries to `src/lib/changelog.ts` after each ticket
6. No gradients, no emojis, no AI sparkles, no Kanban borders — Solvys Gold only

**Branch**: `sprint/S68` | **Cycle**: Cycle 8 (Closed Beta) | **Due**: June 20

## Reference

- `@sprint-md/S63-ORCH-theme-intelligence-phase-2.md` — Original S63 Phase 2 plan (carried forward)
- `@sprint-md/S63-ORCH-theme-intelligence-phase-1.md` — Phase 1 context (IPV engine, Stage B gate)
- `@sprint-md/S63-ORCH-theme-intelligence-phase-3.md` — Phase 3 (explainability panel, depends on this sprint)
- `frontend/components/narrative/NarrativeCanvas.tsx` — Main surface being refactored (326 lines)
- `frontend/components/narrative/Sanctum.tsx` — Parent container (460 lines)
- `frontend/components/narrative/NarrativeMap.tsx` — Force-directed map (773 lines, has layout save stubs)
- `frontend/components/narrative/CatalystCard.tsx` — Catalyst card (94 lines)
- `frontend/contexts/NarrativeContext.tsx` — Narrative state (171 lines)
- `frontend/lib/narrative-physics.ts` — Physics engine (219 lines)
- `frontend/lib/narrative-canvas-renderer.ts` — Canvas drawing (348 lines)
- `backend-hono/src/services/regime/` — Being replaced by Theme Tracker (3 files)
- `backend-hono/src/services/riskflow/` — Source of catalyst data
- `backend-hono/src/routes/narrative/` — Existing narrative routes
- `CLAUDE.md` — Solvys Gold palette, banned ornaments, design doctrine

## Linear Issues

| Issue | Title | Points |
| ----- | ----- | ------ |
| SOL-115 | S68-ORCH: NarrativeFlow Theme Intelligence | — |
| SOL-120 | S68-T1: Replace Regime Tracker with Theme Tracker | 8 |
| SOL-119 | S68-T2: Catalyst Drift model + drift bubble UI | 5 |
| SOL-118 | S68-T3: NarrativeFlow surface refactor to impact intelligence | 8 |
| SOL-117 | S68-T4: NarrativeMap pan persistence + Sanctum nav | 5 |
| SOL-116 | S68-T5: NarrativeFlow canvas polish + micro-interactions | 3 |
