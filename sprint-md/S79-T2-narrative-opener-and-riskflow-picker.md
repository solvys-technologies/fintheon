# Sprint Brief: S79-T2 -- Narrative Opener and RiskFlow Picker

## Context

When a user opens NarrativeFlow, the first viewport should feel intentionally empty and powerful: only the centered chat input, a desk narrative history list fading toward the bottom, and a RiskFlow attach action. This track builds that unopened state and the animated RiskFlow picker interaction without wiring persistence directly into `NarrativeCanvas.tsx`.

The Orchestra reference confirms the session list needs to feel like research memory, not a generic project list: compact titles, a visible desk/project identity, subtle row separation, and immediate continuation into the active research surface.

## Linear Scope

- **Issue naming**: `S79-T2: Narrative Opener and RiskFlow Picker`
- **Beta Phase**: Closed Beta
- **Linear Project**: Beta -- Sanctum & Arbitrum UX
- **Linear Initiative**: Beta Closed
- **Cycle**: Cycle 8 - Beta Closed
- **Due date**: 2026-05-23
- **Assigned owner**: Codex Cloud
- **Brief reference**: `@sprint-md/S79-T2-narrative-opener-and-riskflow-picker.md`

## Branch Target

`sprint/S79`

## Scope -- Included

- [ ] Build a centered NarrativeFlow opener state.
- [ ] Build desk narrative session history with fading horizontal separators and bottom fade.
- [ ] Build the RiskFlow picker transition: history rolls up/fades out, headline list rolls down/fades in.
- [ ] Require at least 3 selected catalysts before the create/start button becomes active.
- [ ] Allow initial selection of default narrative chips: Rate Cut Cycle, Price Stability, Max Employment.
- [ ] Build rename/color entry affordance as a component API, but leave backend persistence to S79-T1 and final wiring to S79-T5.
- [ ] Add compact session row metadata: catalyst count, last updated time, narrative color, and active desk label.

## Scope -- Excluded (DO NOT TOUCH)

- `frontend/components/narrative/NarrativeCanvas.tsx` - owned by S79-T5.
- `frontend/components/narrative/NarrativeSensemakingDetail.tsx` - owned by S79-T3.
- `backend-hono/**` and `supabase/**` - owned by S79-T1 and S79-T4.
- Existing Toast components; only reuse their visual tokens.

## Reuse Inventory

- `NarrativeSensemakingComposer` at `frontend/components/narrative/NarrativeSensemakingComposer.tsx:15` - current bottom composer. Refactor this into the new centered opener/composer if useful.
- RiskFlow feed fetch in `NarrativeCanvas.tsx:40` - copy the endpoint contract into a new hook, but do not edit `NarrativeCanvas.tsx`.
- Toast surface styles in `frontend/components/ui/Toast.tsx:77` - use the surface appearance as color-picker inspiration, but do not create a toast popup.
- `narrative_threads` default narratives from migration lines `81`, `93`, and `99`.

## Solvys Feels Constraints

- No gradients, shadows, blur, sparkles, thick borders, rounded-full on non-circular elements, or emoji chrome.
- Use flat warm near-black surfaces, 1px gold borders at low opacity, warm off-white text, and compact labels.
- Status must be inline text such as `[SELECT 3 CATALYSTS]`, not a toast.
- Color picker must look like the existing toast surface but behave as an inline popover near the rename field.

## File Ownership

- `frontend/components/narrative/NarrativeFlowLanding.tsx` [NEW]
- `frontend/components/narrative/NarrativeSessionHistory.tsx` [NEW]
- `frontend/components/narrative/NarrativeRiskFlowPicker.tsx` [NEW]
- `frontend/components/narrative/NarrativeColorPopover.tsx` [NEW]
- `frontend/components/narrative/NarrativeSensemakingComposer.tsx`
- `frontend/hooks/useNarrativeRiskFlowHeadlines.ts` [NEW]

## Implementation Steps

1. Create `useNarrativeRiskFlowHeadlines.ts` to fetch `/api/riskflow/feed?limit=120&minMacroLevel=1` and normalize to the existing `NarrativeHeadlineOption` shape.
2. Refactor `NarrativeSensemakingComposer.tsx` so it can render both centered opener mode and compact session mode. Keep the current export stable.
3. Create `NarrativeSessionHistory.tsx` with:
   - desk label `Priced In Capital`
   - session rows
   - first-run placeholder chips for `Rate Cut Cycle`, `Price Stability`, and `Max Employment`
   - rename affordance callback
   - bottom opacity fade using flat CSS masks or progressive opacity classes. Do not use blur.
   - horizontal fading separators between rows.
4. Create `NarrativeRiskFlowPicker.tsx` with:
   - checkbox rows
   - source/time/IV metadata
   - conflict badge placeholder (`CONFIRMING`, `CONFLICT`, `NOISE`) from props
   - fading horizontal separators.
   - an inline selected-count status such as `[2/3 CATALYSTS]`.
5. Create `NarrativeColorPopover.tsx` with swatches and hex input. Use toast-like dark surface, 1px border, compact typography.
6. Create `NarrativeFlowLanding.tsx` that composes history + centered composer + picker transition state. Export prop callbacks for S79-T5:
   - `onCreateSession({ query, catalystIds, narrativeSlugs, title, color })`
   - `onOpenSession(id)`
   - `onRenameSession(id, title, color)`
7. The RiskFlow icon button should use a lucide line icon, not text-only chrome.
8. Keep each file under 300 lines.

## Acceptance Criteria

- [ ] Opening state can render with no existing session loaded.
- [ ] Session history rows have fading horizontal separators and fade toward the bottom.
- [ ] Clicking the RiskFlow attach icon rolls/fades history away and rolls/fades picker in.
- [ ] Start/create remains disabled until 3 catalysts are selected.
- [ ] Default narrative chips include Rate Cut Cycle, Price Stability, and Max Employment.
- [ ] Rows show enough context to resume a narrative without opening it blindly.
- [ ] Rename/color UI exists as callbacks without requiring backend wiring in this track.

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

## Commit Format

```bash
[v6.7.10] feat: S79-T2 narrative opener and riskflow picker
```
