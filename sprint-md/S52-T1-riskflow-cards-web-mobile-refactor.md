# Sprint Brief: T1 -- RiskFlow Cards Web/Mobile Refactor (Rollback First)

## Context

S51 card changes are considered regressed in local desktop/mobile behavior. This track owns the UI rollback-first recovery and full finished refactor for RiskFlow cards on web and mobile. The final state must match TP's original request: bucket label left, time-ago right, no duplicate expanded copy, remainder-stream micro interaction, footer/fuse relocation, and indicator strip removal.

## Branch Target

`s51-cards-and-arbitrum`

## Scope -- Included

- [ ] Roll back broken RiskFlow card UI changes in owned files to a known-stable baseline.
- [ ] Rebuild mobile and desktop expanded card anatomy to finished state.
- [ ] Keep category label left (`Econ`, etc.) and time-ago right-justified on both surfaces.
- [ ] Remove duplicate expanded description blocks on mobile and desktop.
- [ ] Implement "headline remainder streams in" micro interaction on expand.
- [ ] Move desktop gray rule to expanded footer area above sawdust fuse.
- [ ] Add/standardize sawdust fuse footer on desktop and mobile expanded cards.
- [ ] Remove momentum/timing/event-weight/vix-context indicator rows from expanded cards.
- [ ] Show deviation only when econ print tags + surprise data are present.
- [ ] Wire paperclip on mobile expanded card to open original source URL.
- [ ] Apply source icon mapping for Wire/Econ/Macro/Geopolitical/Earnings.

## Scope -- Excluded (DO NOT TOUCH)

- `backend-hono/src/services/riskflow/*`
- `backend-hono/src/routes/*`
- `frontend/components/arbitrum/*`
- `frontend/components/narrative/Sanctum.tsx`
- `src/lib/changelog.ts` (owned by T4 only)

## File Ownership

- `mobile/components/riskflow/RiskFlowCard.tsx`
- `mobile/components/riskflow/RiskFlowCardExpanded.tsx`
- `frontend/components/RiskFlowMini.tsx`
- `frontend/styles/transitions.css`

## Reuse Inventory (existing code to call, not reinvent)

- `bucketOf()` in `mobile/lib/source-buckets.ts` and `frontend/lib/source-buckets.ts` for bucket mapping.
- `NothingFuse` in `frontend/components/shared/NothingFuse.tsx` for segmented horizontal/vertical fuse behavior.
- `timeAgo()` in `frontend/lib/time-utils.ts` for right-aligned time labels.

## Known Issues to Preserve

- Keep existing collapse/expand interaction stable, no regressions in tap/click affordance.
- Preserve Solvys bans: no gradients, emojis, Kanban side stripes, generic shadows.
- Do not alter unrelated TradeIdea row behavior in `RiskFlowMini`.

## Implementation Steps

1. Revert only RiskFlow card regressions inside owned files, confirm baseline.
2. Implement mobile expanded copy cleanup:
   - remove duplicate expanded body passage,
   - compute/render headline remainder only,
   - keep image and source handoff behavior.
3. Implement desktop expanded copy cleanup with same remainder-only rule.
4. Normalize header row anatomy:
   - bucket/icon left,
   - time-ago right (`justify-between`) on both surfaces.
5. Remove legacy indicator strips and keep only deviation gate logic.
6. Move desktop gray divider to expanded footer section.
7. Add/verify sawdust fuse footer at bottom of expanded section on both surfaces.
8. Verify paperclip opens source URL and does not trigger row toggle.

## Acceptance Criteria

- [ ] No duplicated expanded copy remains on mobile or desktop.
- [ ] Expanded state reveals only headline remainder via micro interaction.
- [ ] Header shows bucket left and right-justified time on both web/mobile.
- [ ] Desktop gray rule appears at bottom footer zone (not preview boundary).
- [ ] Sawdust fuse appears in expanded footer on both surfaces.
- [ ] Indicator rows are stripped; deviation appears only for econ-print + surprise.
- [ ] Mobile paperclip opens source URL safely in new tab/external browser.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build
```

## Commit Format

```text
[v.5.29.1] feat: S52-T1 RiskFlow web/mobile card rollback + refactor
```
