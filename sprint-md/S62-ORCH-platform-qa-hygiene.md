# S62-ORCH — Platform QA and Hygiene

- **Parent sprint branch**: `sprint/S62`
- **Cycle**: Cycle 7 (Pre-Release)
- **Due**: May 16
- **Owner**: Shashank

## What this covers

Platform-wide QA and hygiene pass before Closed Beta. Covers MiroShark rename, canonical naming documentation, modularity check, pre-release QA checklist, micro-interactions pass, econ countdown widget review, and PsychAssist tilt scoring lockout UX. This is the primary QA/hygiene track for the S62 sprint.

## Codebase map

### MiroShark → Agent Desk rename

- `backend-hono/src/routes/mcp/index.ts` — MCP server config (references "MiroShark" in descriptions)
- `backend-hono/src/routes/data/index.ts` — Data routes (may reference MiroShark)
- `backend-hono/src/services/supabase-service.ts` — Supabase service (references table names)
- `backend-hono/src/config/feature-flags.ts` — Feature flags
- `backend-hono/src/boot/services.ts` — Service boot
- `backend-hono/migrations/011_context_bank.sql` — DB migration (table names)
- `frontend/components/narrative/SanctumRiskAssessment.tsx` — Risk assessment (may reference MiroShark)
- `frontend/components/apparatus/MemoryCard.tsx` — Memory card (references desk agents)
- `frontend/components/strategium/DayCardBulletinTab.tsx` — Bulletin tab
- `sprint-changelog/S56-BRIEF-arbitrum-settings-health-panel.md` — Changelog (reference in docs)
- `docs/sprint-briefs/S20-*.md` — Sprint briefs (references to MiroShark in historical context)
- `src/lib/changelog.ts` — Master changelog
- `mobile/components/home/ArbitrumChamberSummary.tsx` — Mobile surface
- `frontend/components/agent-desk/AgentDeskPanel.tsx` — NEW Agent Desk panel (post-rename)

### Modularity pass

- All `.ts` and `.tsx` files in the project (check for files over 300 lines, split as needed)

### Econ countdown widget

- `frontend/components/layout/EconCountdownWidget.tsx` — Countdown widget component
- `frontend/components/layout/TopHeader.tsx` — Header that hosts the widget
- `frontend/components/layout/MainLayout.tsx` — Main layout
- `frontend/components/feed/EconCountdownModal.tsx` — Countdown modal
- `frontend/components/narrative/SanctumOpsChips.tsx` — Ops chips
- `frontend/components/feed/RiskFlowMain.tsx` — RiskFlow feed
- `frontend/components/SignalFeed.tsx` — Signal feed
- `frontend/hooks/useFloatingDrag.ts` — Drag hook

### PsychAssist + tilt scoring

- `frontend/hooks/useERScoring.ts` — ER scoring hook (tilt detection)
- `frontend/components/mission-control/WaveformCanvas.tsx` — Waveform visualization
- `frontend/components/mission-control/ThreadHistory.tsx` — Thread history
- `frontend/utils/healingBowlSounds.ts` — Healing bowl sound effects
- `frontend/components/TraderNametag.tsx` — Trader nametag (psych state display)
- `frontend/components/mission-control/CompactERMonitor.tsx` — ER monitor
- `frontend/contexts/ThreadContext.tsx` — Thread context

## Child tickets

### SOL-49 — S62-T11: MiroShark rename to Agent Desk (code + UI)

Branch: `sprint/S62`
Assignee: Sam Frederique

**What to do**: Rename all references to "MiroShark" to "Agent Desk" (or the agreed canonical name) across code, UI labels, docs, database comments, and API descriptions. Search for patterns: `MiroShark`, `miroshark`, `MIROSHARK` in all source files. Update UI strings in frontend components, API descriptions in backend route handlers, database comments in migrations, and mentions in docs/sprint-briefs/. Do NOT change internal function/variable names that are purely conventions (e.g., `miroshark` in a module path is okay if it's the module name); focus on user-facing and API-surface strings.

**Key files**: `backend-hono/src/routes/mcp/index.ts`, `frontend/components/narrative/SanctumRiskAssessment.tsx`, `frontend/components/strategium/DayCardBulletinTab.tsx`, `src/lib/changelog.ts`

**Validation**: `rg -i "miroshark" --type ts --type tsx` returns only legitimate internal module/function references (no user-facing stale names). Build passes.

### SOL-50 — S62-T12: Docs: canonical naming (routines, internal refs)

Branch: `sprint/S62`
Assignee: Sam Frederique

**What to do**: Audit project documentation for canonical name consistency. Ensure all sprint briefs, changelog entries, and inline comments use the canonical feature names from the CLAUDE.md definition (Consilium, Sanctum, Forum, Apparatus, Strategium, Arbitrum, ArbitrumChamber, RiskFlow, NarrativeFlow, CAO chat, PsychAssist, MDB/ADB/PMDB/TWT). Flag any lingering legacy names (Ask Harp, TOTT, News Worker, etc.).

**Key files**: All `sprint-md/*.md`, `sprint-changelog/*.md`, `docs/sprint-briefs/*.md`, `src/lib/changelog.ts`

**Validation**: No legacy names in user-facing docs. Report findings.

### SOL-51 — S62-T13: Modularity pass: files over 300 lines

Branch: `sprint/S62`

**What to do**: Find all `.ts`/`.tsx` files exceeding 300 lines and split them. Per project rules, each file serves one purpose and stays under 300 lines. Use `find . -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -30` to identify offenders. For each oversized file, extract related functionality into separate files. Preserve exports at the original file (re-export from new files if needed). Do NOT split files that are intentionally monolithic (e.g., `src/lib/changelog.ts`, generated files, third-party types).

**Validation**: All frontend source `.tsx`/`.ts` files under 300 lines. `npx tsc --noEmit` passes after all splits.

### SOL-52 — S62-T14: Pre-release QA checklist (builds + smoke)

Branch: `sprint/S62`
Assignee: Sam Frederique

**What to do**: Create a comprehensive pre-release QA checklist covering build, smoke, and regressio tests for the Closed Beta release. Include:

- Frontend build: `npx vite build`
- Backend build: `cd backend-hono && bun run build`
- Type check: `npx tsc --noEmit --project frontend/tsconfig.json`
- Key endpoint smoke: health, auth, chat, briefs, riskflow, arbitrum
- Key UI surface smoke: Consilium, Sanctum, chat, Strategium, Refinement
- Visual regression: check Solvys industrial-luxe palette consistency
- Electron smoke: window creation, webview, popup allowlist

Document the checklist in `sprint-md/S62-T14-qa-checklist.md`.

**Validation**: Checklist exists and is actionable. Run through it once end-to-end.

### SOL-68 — S62-T22: MicroInteractions pass (chat drawer, rich text, econ countdown)

Branch: `sprint/S62`

**What to do**: Audit micro-interactions across key surfaces. Check:

- Chat drawer open/close animation (smooth, no flicker)
- Rich text formatting transitions (no layout shift on render)
- Econ countdown widget state transitions (loading → data → empty)
- Button hover states (Solvys Gold accent on hover)
- All using Solvys timing tokens (not arbitrary durations)

**Key files**: `frontend/components/chat/slots/`, `frontend/components/chat/CognitionPanel.tsx`, `frontend/components/layout/EconCountdownWidget.tsx`, `frontend/components/feed/EconCountdownModal.tsx`

**Validation**: Record screen capture of each interaction. Check `prefers-reduced-motion` paths.

### SOL-70 — S62-T24: Econ countdown widget: review states + slot alignment

Branch: `sprint/S62`

**What to do**: Review the econ countdown widget (`EconCountdownWidget.tsx`) for completeness. Check: all loading/error/empty states render correctly; slot alignment in the header matches other header widgets; the widget works with and without data (no crashes if API returns empty). Verify the countdown modal (`EconCountdownModal.tsx`) shares the same state logic.

**Key files**: `frontend/components/layout/EconCountdownWidget.tsx`, `frontend/components/feed/EconCountdownModal.tsx`, `frontend/hooks/useFloatingDrag.ts`

**Validation**: Widget renders in header. Countdown updates correctly. Modal opens/closes. No console errors.

### SOL-71 — S62-T25: PsychAssist: assess tilt scoring + lockout UX

Branch: `sprint/S62`

**What to do**: Review the PsychAssist tilt detection system. Check ER scoring feeds into the UI correctly. Verify lockout UX (when tilt score exceeds threshold, the user should see a clear lockout state). Check `useERScoring` hook state transitions. Ensure the lockout is not permanent (auto-resets after cooldown or manual reset).

**Key files**: `frontend/hooks/useERScoring.ts`, `frontend/components/mission-control/CompactERMonitor.tsx`, `frontend/components/mission-control/WaveformCanvas.tsx`, `frontend/components/TraderNametag.tsx`

**Validation**: Simulate high ER score → lockout triggers and shows in UI. Normal state has no false positives.

## Execution order (wave sequence)

### Wave 1 (parallel — independent)

- SOL-49 — MiroShark rename (pure rename, no dependencies)
- SOL-50 — Canonical naming docs (pure docs, no deps)
- SOL-52 — QA checklist (docs, no deps)

### Wave 2 (parallel — after Wave 1, also independent among themselves)

- SOL-51 — Modularity pass (after rename to avoid conflicts)
- SOL-68 — MicroInteractions pass (after chat slots are stable)
- SOL-70 — Econ countdown review (independent)
- SOL-71 — PsychAssist lockout (independent)

## Validation

- [ ] All child tickets completed
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx vite build` passes
- [ ] Add changelog entry

## Handoff to Developer (Shashank)

This file is your single entry point for the S62-ORCH Platform QA and Hygiene work. Pick it up and work through the child tickets in wave order.

**To execute:**
1. Read this entire plan file for codebase map and context
2. Start with Wave 1 (SOL-49 rename, SOL-50 docs, SOL-52 QA checklist — parallel), then Wave 2 (SOL-51 modularity, SOL-68 micro-interactions, SOL-70 econ countdown, SOL-71 PsychAssist — parallel)
3. Each child ticket in Linear has enriched context with specific files and validation steps
4. After each ticket, run the validation steps listed in this file
5. Note: SOL-49 and SOL-50 are assigned to Sam Frederique — coordinate if needed or defer
6. Add changelog entries to `src/lib/changelog.ts` after each ticket

**Branch**: `sprint/S62` | **Cycle**: Cycle 7 (Pre-Release) | **Due**: May 16

## Reference

- @sprint-md/S62-T1-sanctum-layout.md — S62 T1 brief (Sanctum layout audit, sibling track)
