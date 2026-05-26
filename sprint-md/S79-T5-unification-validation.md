# Sprint Brief: S79-T5 -- NarrativeFlow Unification and Validation

## Context

This is the integration pass. S79-T1 through T4 should produce persistence, opener UX, loaded workspace, classifier, and Situation Map pieces without fighting over shared files. This track owns `NarrativeCanvas.tsx`, reconciles contracts, wires the full experience, and validates that NarrativeFlow opens as a centered chat/session-history surface before loading into the drawer/tab workspace.

## Linear Scope

- **Issue naming**: `S79-T5: NarrativeFlow Unification and Validation`
- **Beta Phase**: Closed Beta
- **Linear Project**: Beta -- Sanctum & Arbitrum UX
- **Linear Initiative**: Beta Closed
- **Cycle**: Cycle 8 - Beta Closed
- **Due date**: 2026-05-23
- **Assigned owner**: TP acceptance, local Solvys Agent execution
- **Brief reference**: `@sprint-md/S79-T5-unification-validation.md`

## Branch Target

`sprint/S79`

## Scope -- Included

- [ ] Wire new S79 components into the live NarrativeFlow surface.
- [ ] Update frontend/backend sensemaking contracts as needed.
- [ ] Validate session create/open/rename/color/catalyst attach flows.
- [ ] Validate Flow, Timeline, Docs, and Situation Map views.
- [ ] Replace Sticky Bulletin Catalyst contents with a bulletin-based watchlist.
- [ ] Validate Zen-only Desk Narrative filtering with one visible test note and one blocked test note.
- [ ] Link the quick access header lock to the in-app platform blocker only.
- [ ] Add Blocker settings for choosing the quick lock target by platform dropdown or custom link.
- [ ] Update changelog.
- [ ] Run the full validation suite.

## Scope -- Excluded (DO NOT TOUCH)

- Do not rewrite S79-T1 data model unless required to compile.
- Do not redesign components owned by S79-T2/T3/T4 beyond integration fixes.
- Do not add invite UI or broad team-management flows.
- Do not start a Vite dev server.

## Reuse Inventory

- `NarrativeCanvas` at `frontend/components/narrative/NarrativeCanvas.tsx:27` - main integration point.
- Current response submit path at `NarrativeCanvas.tsx:86` - replace or wrap with session creation flow.
- Current map placement at `NarrativeCanvas.tsx:140` - loaded workspace canvas belongs here.
- Current detail drawer at `NarrativeCanvas.tsx:165` - replace with S79-T3 `NarrativeWorkDrawer`.
- `createNarrativeRoutes` at `backend-hono/src/routes/narrative/index.ts:24` - ensure route mounts from T1/T4 are present.
- `src/lib/changelog.ts:5` - add a new entry after validation.

## Solvys Feels Constraints

- No gradients, shadows, blur, sparkles, thick borders, or emoji chrome.
- Use inline status text instead of toast popups for NarrativeFlow session actions.
- Color customization must remain compact and flat.
- The first viewport should only show the centered chat input and the fading desk session history list.

## File Ownership

- `frontend/components/narrative/NarrativeCanvas.tsx`
- `frontend/components/narrative/sensemaking-types.ts`
- `backend-hono/src/services/narrative-sensemaking/types.ts`
- `src/lib/changelog.ts`
- Small compile-fix edits in S79-owned new files only.

## Implementation Steps

1. Review S79-T1 through T4 diffs before editing.
2. Update `sensemaking-types.ts` on frontend and backend only if payloads now include session metadata, docs, conflicts, or colors.
3. In `NarrativeCanvas.tsx`, replace the always-loaded map/detail layout with state:
   - `activeSessionId: string | null`
   - no active session: render `NarrativeFlowLanding`.
   - active session: render `NarrativeSessionWorkspace`.
4. Wire create session:
   - require 3 selected catalysts client-side.
   - call S79-T1 `POST /api/narrative/sessions`.
   - set active session on success.
5. Wire open session:
   - fetch session details/artifacts.
   - load Flow, Timeline, Docs artifacts.
   - preserve the transcript/work context so the session feels like continuing research, not reopening a static map.
6. Wire rename/color:
   - call `PATCH /api/narrative/sessions/:id`.
   - update local history row and active session title.
7. Wire Situation Map access:
   - add compact control in loaded session chrome.
   - render S79-T4 `NarrativeSituationMap` as a view, overlay, or drawer tab only if it does not disrupt Flow/Timeline/Docs.
8. Verify the loaded-session layout against the Orchestra reference:
   - left or center research transcript remains readable if present.
   - canvas cards have clear type/status chips.
   - right drawer is resizable and limited to Flow/Timeline/Docs.
   - no Agents, Experiments, or Files top-level tabs are introduced.
9. Add changelog entry to `src/lib/changelog.ts`.
10. Run validations. Fix compile issues without broad refactors.
11. Patch Sticky Bulletin Catalyst tab:

- replace the phrase-watch contents with a desk bulletin watchlist.
- include Desk Narrative toggles that mirror the narrative visibility controls.
- apply those toggles only while Trading Browser Zen mode is active.
- show an inline blocked-count status when Zen hides bulletin notes.

12. Before completion, create two deterministic QA bulletin notes:

- `S79-T5 TEST FILTERED POPUP` attached to an enabled narrative and visible in the Catalyst watchlist.
- `S79-T5 TEST BLOCKED` attached only to a disabled narrative and blocked from the active list in Zen mode.

13. Wire the quick access header lock to the platform blocker:

- use only the Electron runtime/webRequest blocker path.
- replace the blocker domain list with the selected platform or custom link target.
- do not schedule `/api/lockout/toggle` or system-wide hosts/resolver blocking from this header button.
- keep the target selectable inside Blocker settings.

## Acceptance Criteria

- [ ] First NarrativeFlow viewport shows only centered chat input and desk session history.
- [ ] RiskFlow picker transition works and enforces minimum 3 catalysts.
- [ ] Session creation persists and opens loaded workspace.
- [ ] Loaded workspace has resizable right drawer with Flow, Timeline, Docs tabs.
- [ ] Sessions can be renamed and recolored.
- [ ] Situation Map can show all desk-selected catalysts and multi-narrative links.
- [ ] Existing `/api/narrative/sensemaking` and `/api/narrative/catalysts` do not regress.
- [ ] Sticky Bulletin Catalyst tab shows bulletin notes instead of phrase watches.
- [ ] Desk Narrative toggles filter bulletin notes only in Zen mode.
- [ ] T5 validation records a visible `S79-T5 TEST FILTERED POPUP` note and a blocked `S79-T5 TEST BLOCKED` note.
- [ ] Quick access header lock blocks only the Blocker settings target in-app.
- [ ] Blocker settings can save a platform target or custom link target for the header lock.

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
git diff --check
```

## Commit Format

```bash
[v6.7.10] feat: S79-T5 unify narrativeflow sessions
```
