# S60-ORCH — Refinement Admin Controls

- **Parent sprint branch**: `sprint/S60`
- **Cycle**: Cycle 7 (Pre-Release)
- **Due**: May 16
- **Owner**: Shashank

## What this covers

Audit the Refinement Engine's admin control surfaces for modularity, consistency, and completeness. After the S60 sprint added Plane embed, GlassGate, and various admin panels to Refinement, this ORCH runs a cleanup pass: verify all admin controls are properly modular, no dead code remains, and the admin shell is consistent with the rest of the app.

## Codebase map

### Refinement Engine

- `frontend/components/refinement/RefinementEngine.tsx` — Main refinement engine component (viewMode, header toolbar at ~line 544, scoring/plane mode switch)
- `frontend/components/refinement/AdvancedPane.tsx` — Advanced scoring pane
- `frontend/components/refinement/RefinementGlassGate.tsx` — Data-center glass overlay (S44-T1)
- `frontend/components/refinement/RefinementEditLockModal.tsx` — DEPRECATED (replaced by GlassGate)
- `frontend/components/refinement/NotchedFuse.tsx` — Notched fuse control
- `frontend/components/refinement/QuickWeightEditor.tsx` — Weight editor
- `frontend/components/refinement/SourceAccountsManager.tsx` — Source accounts manager
- `frontend/components/refinement/EconFiltersManager.tsx` — Economic filters manager
- `frontend/components/refinement/CommentatorManager.tsx` — Commentator manager
- `frontend/components/refinement/RegimeControl.tsx` — Regime control
- `frontend/components/refinement/glass-gate.css` — Glass gate styles
- `frontend/lib/dev-settings-auth.ts` — Auth helpers (authenticateDev, isDevAuthenticated, clearDevAuth)

### Admin shell

- `frontend/components/admin/AdminShell.tsx` — Admin panel shell (referenced in S60-T1 for sub-tab label)

### Layout/embed

- `frontend/components/layout/EmbeddedBrowserFrame.tsx` — Electron webview / browser iframe embed (Plane surface)
- `frontend/components/layout/FooterToolbar.tsx` — Footer toolbar

### Electron

- `electron/main.cjs` — Electron main process (popup allowlist at line 450, webview at 868)

## Child tickets

### SOL-64 — S60-T1: Refinement UI: modular admin control audit

Branch: `sprint/S60`

**What to do**: Audit all admin control components under `frontend/components/refinement/` for:

- **Modularity**: Each component under 300 lines per project rules. If any is over, split it.
- **Consistency**: Check palette consistency (Solvys BG `#050402`, accent `#c79f4a`, text `#f0ead6`). No hardcoded non-Solvys colors.
- **Dead code**: Remove or mark `RefinementEditLockModal.tsx` for deletion (it was deprecated by GlassGate in S44-T1). Check for unused imports, commented code, dead route handlers.
- **Prop interfaces**: Verify all admin controls have clean TypeScript interfaces. No `any` types.
- **Error states**: Each admin control should handle loading, error, and empty states gracefully.

Also verify the Plane embed integration (S60-T1) is clean — `viewMode` state in `RefinementEngine.tsx` should toggle correctly between `"scoring"` and `"plane"` without leaking state.

**Key files to touch**: `frontend/components/refinement/RefinementEngine.tsx`, `frontend/components/refinement/AdvancedPane.tsx`, `frontend/components/refinement/RefinementEditLockModal.tsx`, `frontend/components/refinement/*.tsx`, `frontend/components/admin/AdminShell.tsx`

**Validation**:

- `npx tsc --noEmit --project frontend/tsconfig.json` passes
- `npx vite build` passes
- Verify Plane toggle in Refinement header works (TV icon → Plane content)
- Verify scoring mode restores original controls
- Verify sidebar chat remains usable in Plane mode
- Add changelog entry to `src/lib/changelog.ts`

## Validation

- [ ] All admin control components are < 300 lines (split any that aren't)
- [ ] RefinementEditLockModal is either removed or clearly marked deprecated
- [ ] No `any` types in admin control interfaces
- [ ] Plane/scoring mode toggle works correctly
- [ ] `tsc` and `vite build` pass
- [ ] Add changelog entry

## Handoff to Developer (Shashank)

This file is your single entry point for the S60-ORCH Refinement Admin Controls work. This is a single-ticket ORCH (SOL-64), so work through the suggested audit checklist.

**To execute:**
1. Read this entire plan file for codebase map and context
2. Work through SOL-64 audit items: modularity → consistency → dead code → prop interfaces → error states
3. The child ticket in Linear has enriched context with specific files and validation steps
4. After completing, run all validation steps listed in this file
5. Reference `@sprint-md/S60-T1-refinement-plane-surface.md` for Plane embed context and `@sprint-md/S44-T1-refinement-glass-gate.md` for GlassGate context
6. Add changelog entry to `src/lib/changelog.ts`

**Branch**: `sprint/S60` | **Cycle**: Cycle 7 (Pre-Release) | **Due**: May 16

## Reference

- @sprint-md/S60-T1-refinement-plane-surface.md — original Plane embed sprint brief
- @sprint-md/S44-T1-refinement-glass-gate.md — GlassGate context
- @sprint-md/S60-ORCHESTRATION.md — S60 sprint orchestration (Wave 1-3)
