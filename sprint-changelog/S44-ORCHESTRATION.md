# S44 — Refinement Engine: Glass Gate + Design Polish (Orchestration)

## Sprint Goal

Land a unified, polished Refinement Engine surface gated by a "data-center glass" auth overlay that slides down on unlock. Fix four classes of visual bugs: bespoke fuse anatomy, multi-hue category tags, inconsistent footer lozenges, and failing-AA secondary text contrast.

## Branch

All tracks commit to `s35-unified` (current branch). No worktrees.

## Wave Sequence

### Wave 1 (parallel — 4 instances)

```
@sprint-md/S44-T1-refinement-glass-gate.md
```

```
@sprint-md/S44-T2-fuse-uniformity.md
```

```
@sprint-md/S44-T3-tag-decoloring.md
```

```
@sprint-md/S44-T4-footer-and-contrast.md
```

### Wave 2 (orchestrator — Claude in this session)

T5 unification:

- Mount `RefinementGlassGate` (from T1) inside `RefinementEngine.tsx`, replacing the current `RefinementEditLockModal` mount point
- Delete `RefinementEditLockModal.tsx` once smoke-test confirms RefinementGlassGate fully replaces it
- Resolve any interface mismatches (e.g., the 1.5s `editUnlocked` polling sync inside RefinementEngine.tsx)
- Run full validation suite (`tsc --noEmit` + `rm -rf dist && vite build`)
- Add changelog entry to `src/lib/changelog.ts` covering all 5 tracks
- Bump version (likely `v5.27.0 → v5.28.0`) in `package.json`
- Manual smoke: load engine, verify glass overlay, type wrong password (red shudder), correct password (slide-down), interact with all four sub-sections

## What Each Wave Accomplishes

**Wave 1** is four parallel tracks with zero file collisions. Each track delivers self-contained components:

- T1 builds the new auth gate (data-center glass + slide-down) but does not mount it
- T2 swaps the fuse internals to canonical `NothingFuse + IVStack` anatomy across `NotchedFuse.tsx` and `QuickWeightEditor.tsx`
- T3 collapses every category/tier badge across four manager files to Solvys Gold intensity-stepped
- T4 monochromes the footer status lozenges and bumps secondary text contrast in `RegimeControl.tsx` and `QuickWeightEditor.tsx` shell

**Wave 2** is the orchestrator-led integration: mount the gate, validate, deploy.

## Conflict Map

| File                                                      | Owned By                           | Notes                       |
| --------------------------------------------------------- | ---------------------------------- | --------------------------- |
| `RefinementEngine.tsx`                                    | T5 (orchestrator)                  | Wave 2 only                 |
| `RefinementGlassGate.tsx` (NEW)                           | T1                                 |                             |
| `glass-gate.css` (NEW)                                    | T1                                 |                             |
| `wired-mesh.svg` (NEW, public/)                           | T1                                 |                             |
| `AdvancedPane.tsx`                                        | T1                                 | strip placeholder overlay   |
| `RefinementEditLockModal.tsx`                             | T1 (mark deprecated) / T5 (delete) |                             |
| `NotchedFuse.tsx`                                         | T2                                 |                             |
| `QuickWeightEditor.tsx` slider sub-component              | T2                                 |                             |
| `QuickWeightEditor.tsx` parent shell (header/save/toggle) | T4                                 |                             |
| `SourceAccountsManager.tsx`                               | T3                                 |                             |
| `EconFiltersManager.tsx`                                  | T3                                 |                             |
| `CommentatorManager.tsx`                                  | T3                                 |                             |
| `RegimeControl.tsx` REGIME_COLORS + badge                 | T3                                 |                             |
| `RegimeControl.tsx` confidence/source body text           | T4                                 |                             |
| `FooterToolbar.tsx` lozenge section                       | T4                                 | layout/ folder — read first |

## Off-Limits Files (every track)

- `frontend/components/SettingsPanel.tsx` — uncommitted WIP from another stream
- `backend-hono/src/services/vproxy/*` — recently touched per changelog
- All other `frontend/components/layout/*` files except `FooterToolbar.tsx` — recently touched
- `frontend/styles/custom.css` — recently touched; coordinate carefully

## Glass-Rule Override

The standing memory rule "no glass effects, no `backdrop-blur`, no `box-shadow`" is **explicitly overridden inside `RefinementGlassGate.tsx` and `glass-gate.css` only**, per direct TP authorization on 2026-04-26. The override does NOT apply to any other component. T1 is the only track that may use `backdrop-filter`.

## Banned Ornaments (every track)

- No gradients
- No emojis (colored or monochrome)
- No Kanban borders
- No AI sparkles
- No `box-shadow` (T1's gold seal uses `border-top`, not shadow)
- No new fonts (Doto + Inter + system stack only)

## Validation (every track)

```bash
cd /Users/tifos/Documents/Codebases/fintheon
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

No vite dev server. Build only.

## Unification Approach

Orchestrator-led. The Claude instance running this skill performs T5 in Wave 2: mounts T1's gate, deletes the deprecated modal, runs validation, writes the changelog, bumps version. Each Wave 1 track is self-contained — no cross-track messages, no live coordination.
