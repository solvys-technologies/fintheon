# Sprint Brief: T6 -- Design System, Icons, Spinners, Fuses, and Charts

## Context

Several issues request consistent fuses, better expanded cards, new source icons, SOTA loaders, Evil Charts, and design-skill upgrades. This track owns shared visual primitives only after T0 choices are known and feature contracts from T1-T5 are stable.

## Branch Target

`s47-wave3-design-system`

## Scope -- Included

- [ ] Standardize all fuses around a shared notched 0-10 visual spec.
- [ ] Add X, globe, social network, official source, and chart/source icons.
- [ ] Refactor app loaders/spinners with dotmatrix-inspired Solvys-compatible loaders.
- [ ] Apply RiskFlow expanded-card transparency and hierarchy cleanup.
- [ ] Add Evil Charts components only in tab views where charts are needed.
- [ ] Use devl.dev and Jakub interface details as reference checks for new/changed UI.
- [ ] Update Solvys design skills after TP picks from T0.

## Scope -- Excluded (DO NOT TOUCH)

- Backend data contracts and routes.
- Chat/Agentic Forum feature logic owned by T4.
- Voice/VibeVoice owned by T5.
- Arbitrum business logic owned by T2/T3.

## Reuse Inventory

- `NothingFuse` at `frontend/components/shared/NothingFuse.tsx:46` -- current shared fuse primitive.
- `DigitGroup` at `frontend/components/shared/DigitGroup.tsx` -- animated Doto/tabular digits.
- `NotchedFuse` at `frontend/components/refinement/NotchedFuse.tsx` -- refinement-specific fuse to reconcile.
- `RiskFlowDetailCard` at `frontend/components/feed/RiskFlowDetailCard.tsx` -- expanded RiskFlow card.
- `RiskFlowMini` at `frontend/components/RiskFlowMini.tsx` -- mini feed card patterns.
- `EconKpiFuses` at `frontend/components/narrative/econ/EconKpiFuses.tsx` -- econ fuse surface.
- `BoardroomAgentPanel` at `frontend/components/consilium/BoardroomAgentPanel.tsx` -- Agentic Forum agent card visual.
- `frontend/components/icons/` -- existing icon location.
- `frontend/index.css` -- shared animation tokens/classes.
- `.claude/skills/solvys-feels/` -- design rules.
- `.claude/skills/impeccable/` -- current imported impeccable skill set.

## Known Issues to Preserve

- No gradients, no emojis, no Kanban borders, no AI sparkles.
- Dotmatrix loaders must be adapted; do not copy neon/multicolor styles directly.
- Evil Charts are Recharts/shadcn-based; do not introduce heavy chart dependency duplication if Recharts is already present or avoid install until necessary.
- UI is mostly complete; new chart-heavy areas should use tabs instead of cluttering existing panels.

## Implementation Steps

1. Read T0 tooling selection. If TP did not approve a tool, do not import it.
2. Define `NothingFuse` API clearly: incoming `value` remains 0-1; `score` is 0-10; visible labels use 0.0-10.0 where requested.
3. Audit fuses in Arbitrum, Econ Intel, RiskFlow, Refinement, Agentic Forum, and instrument cards. Replace one-off fuses with shared primitive or wrapper.
4. Add source icon components as simple SVG/line icons under `frontend/components/icons/`. Do not use emoji glyphs.
5. Add a shared loader component inspired by dotmatrix `Braille Beat`, `Radar Arc`, or `Core Spiral`. Use Solvys Gold, reduced-motion support, and no decorative sparkle copy.
6. Replace ad hoc loading indicators across high-visibility surfaces only: Chat, Agentic Forum, RiskFlow, Arbitrum, Econ countdown.
7. Redesign RiskFlow expanded card so expanded area shares the same transparent/surface treatment as parent. Remove border around severity/priority tag.
8. Simplify RiskFlow expanded hierarchy: source icon/source, headline, time ago, severity/IV fuse, then body/details. Remove footer/header clutter.
9. Add Evil Charts only to tabbed sections where a chart adds value: Performance > Agents, Trade Ledger analytics, or Econ historical print views. Prefer existing Recharts if already installed.
10. Apply Jakub interface detail checks: text-wrap balance/pretty, concentric radii, tabular numbers, interruptible transitions, subtle exits, optical icon alignment.
11. Add/update changelog entry.

## Acceptance Criteria

- [ ] Fuses are visually consistent across touched app surfaces.
- [ ] Source icons distinguish X/social, official/government, generic web/RSS.
- [ ] Shared loader replaces scattered spinners in major surfaces.
- [ ] RiskFlow expanded cards no longer show mismatched background blocks or bordered severity tags.
- [ ] Any chart additions live in tabs and do not clutter existing layout.

## Validation Commands

```bash
# Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build
```

## Commit Format

```bash
[v5.34.0] feat: T6 unify visual primitives and charts
```
