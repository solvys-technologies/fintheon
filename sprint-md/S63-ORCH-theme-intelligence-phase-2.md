# S63-ORCH Phase 2 — Theme Intelligence: IPV + Drift + Tracker

- **Parent sprint branch**: `sprint/S63`
- **Cycle**: Cycle 8 (Closed Beta)
- **Due**: June 6
- **Milestone**: Phase 2 — IPV + Drift + Tracker
- **Owner**: Shashank

## What this covers

Phase 2 of the Theme Intelligence refactor. Build the Catalyst Drift model with drift bubble UI (SOL-81), replace the Regime Tracker with a Theme Tracker (SOL-82), and refactor the NarrativeFlow surface to focus on impact intelligence (SOL-83). This phase creates the user-facing intelligence surfaces.

## Codebase map

### Narrative surfaces

- `frontend/components/narrative/NarrativeCanvas.tsx` — Narrative flow canvas (main surface for catalyst display)
- `frontend/components/narrative/Sanctum.tsx` — Sanctum surface (hosts narratives, Arbitrum, risk)
- `frontend/components/narrative/NarrativePreviewSlot.tsx` — Narrative preview in chat slots
- `frontend/components/narrative/SanctumNarratives.tsx` — Active narratives display inside Sanctum

### Regime system (being replaced)

- `frontend/components/regimes/` — Regime components (ConfidenceBar, etc.)
- `backend-hono/src/services/regime-tracker/` — Existing regime tracker service (being replaced by Theme Tracker)

### Catalyst/RiskFlow system

- `frontend/components/feed/RiskFlowMain.tsx` — RiskFlow feed main
- `frontend/components/chat/slots/CatalystCardSlot.tsx` — Catalyst card in chat
- `frontend/hooks/` — Data hooks for RiskFlow and catalysts
- `backend-hono/src/services/riskflow/` — RiskFlow scoring engine

## Child tickets

### SOL-81 — S63-T4: Catalyst Drift model + drift bubble UI (5 pts, High)

Branch: `sprint/S63`

**What to do**: Build a Catalyst Drift model that tracks how a theme's narrative shifts over time. Drift measures the divergence between a theme's current IPV and its historical trajectory. Create:

- Backend drift calculation: compare current IPV against trailing N-period average, compute drift magnitude and direction
- Drift bubble UI: visual bubble component showing drift state (color-coded by magnitude/direction, size proportional to confidence)
- Integration with NarrativeFlow: drift bubbles appear on related catalyst cards

**Key files to create**: `backend-hono/src/services/catalyst-drift/` (backend drift model), frontend drift bubble component
**Key files to touch**: `frontend/components/narrative/NarrativeCanvas.tsx` (add drift integration), `frontend/components/chat/slots/CatalystCardSlot.tsx` (add drift indicator)

**Validation**: Drift model produces sensible values for sample data. UI renders drift bubbles correctly. `tsc` and `bun run build` pass.

### SOL-82 — S63-T5: Replace Regime Tracker with Theme Tracker (5 pts, High)

Branch: `sprint/S63`

**What to do**: Replace the existing Regime Tracker system with a Theme Tracker. The Theme Tracker:

- Manages a set of active themes (each with IPV, catalysts, drift, status)
- Provides CRUD operations for themes
- Replaces the Regime Tracker data model in the backend
- Updates the frontend to read from Theme Tracker instead of Regime Tracker
- API: `GET /api/themes`, `POST /api/themes`, `GET /api/themes/:id`, `PATCH /api/themes/:id`
- Remove deprecated Regime Tracker code

**Key files to create**: `backend-hono/src/services/theme-tracker/`, `backend-hono/src/routes/themes/`
**Key files to touch/remove**: `backend-hono/src/services/regime-tracker/` (deprecate and remove), `frontend/components/regimes/` (update to theme-based data)

**Validation**: Theme Tracker replaces Regime Tracker functionality. API endpoints work. Frontend surfaces read from new data source. Old regime code is removed or clearly deprecated.

### SOL-83 — S63-T6: NarrativeFlow surface refactor to impact intelligence (5 pts, High)

Branch: `sprint/S63`

**What to do**: Refactor the NarrativeFlow surface (NarrativeCanvas.tsx) from a general narrative display to an impact-intelligence-focused surface. Changes:

- Reorganize catalyst cards by theme impact (highest impact first)
- Add IPV display to each theme section
- Integrate drift indicators into the narrative flow
- Add theme status badges (Active/Decaying/Resolved)
- Streamline the visual hierarchy: theme header > IPV summary > catalyst list > drift indicator

**Key files**: `frontend/components/narrative/NarrativeCanvas.tsx`, `frontend/components/narrative/SanctumNarratives.tsx` (if used), `frontend/components/narrative/`

**Validation**: NarrativeFlow shows impact-intelligence layout. Theme headers with IPV + drift render. Catalyst cards grouped by theme. `tsc --noEmit` passes.

## Execution order (wave sequence)

### Parallel (after Phase 1 contract is locked)

All three tickets can run in parallel since they operate on different parts of the stack:

- SOL-81 — Catalyst Drift (backend model + new UI component)
- SOL-82 — Theme Tracker (replaces Regime Tracker, backend + frontend)
- SOL-83 — NarrativeFlow refactor (frontend-only, consumes from T2 and T5)

However, recommended order if sequencing needed:

1. **SOL-82 — Theme Tracker**: Fundamental — other tracks consume its API
2. **SOL-81 — Catalyst Drift**: Uses Theme Tracker data for drift calculation
3. **SOL-83 — NarrativeFlow refactor**: UI integration, consumes both T4 and T5

## Validation

- [ ] Catalyst drift model produces sensible values
- [ ] Drift bubble UI renders correctly on catalyst cards
- [ ] Theme Tracker replaces Regime Tracker with full API
- [ ] NarrativeFlow shows impact-intelligence layout
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `npx vite build` passes
- [ ] Add changelog entry

## Handoff to Developer (Shashank)

This file is your single entry point for the S63-ORCH Phase 2 — Theme Intelligence work. Can run in parallel after Phase 1 contract is locked.

**To execute:**

1. Read this entire plan file for codebase map and context
2. All three tickets can run in parallel, but recommended order: SOL-82 (Theme Tracker) → SOL-81 (Catalyst Drift) → SOL-83 (NarrativeFlow refactor)
3. Each child ticket in Linear has enriched context with specific files and validation steps
4. After each ticket, run the validation steps listed in this file
5. Phase 1 contract (`@sprint-md/S63-ORCH-theme-intelligence-phase-1.md`) must be locked before starting Phase 2
6. Phase 2 output feeds into Phase 3
7. Add changelog entries to `src/lib/changelog.ts` after each ticket

**Branch**: `sprint/S63` | **Cycle**: Cycle 8 (Closed Beta) | **Due**: June 6 | **Milestone**: Phase 2

## Reference

- @sprint-md/S63-ORCH-theme-intelligence-phase-1.md — Phase 1 context (product contract, IPV engine, Stage B gate)
- `frontend/components/narrative/NarrativeCanvas.tsx` — main surface being refactored
- `backend-hono/src/services/regime-tracker/` — being replaced
