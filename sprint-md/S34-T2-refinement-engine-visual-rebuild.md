# Sprint Brief: T2 — Refinement Engine Visual Rebuild

## Context

TP wants the Refinement Engine flipped: sidebar becomes the main interface, feed shrinks to a 25% right panel, and the whole surface gets a `/solvys-feels` + Nothing-design pass including new fuses with notches + vertical rulers replacing the current `GroupSensitivityDial`. Today the left rail is 340px fixed and the feed takes the remaining width — inverted from what TP wants. This is a pure visual + layout track; all data contracts stay identical.

## Branch target

`s34-t2-refinement-engine-visual-rebuild` off `main`.

## Scope — Included

- [ ] `frontend/components/refinement/RefinementEngine.tsx` — invert the two-column layout:
  - Main area (75% width): regime control, notched fuses, preset selector, AdvancedPane (matrix/lexicon/weights/commentator/source-accounts — and T1's new EconFiltersManager lands there too, don't break the slot).
  - Right panel (25% fixed, min-w-[280px], max-w-[420px]): the `AnnotatableItem` feed preview list.
  - Keep the header row (REFINEMENT ENGINE title + Discard/Apply/Rescore buttons) unchanged.
- [ ] New component `frontend/components/refinement/NotchedFuse.tsx`:
  - Vertical ruler with minor ticks (every 10% of range) + notched major ticks at 0/25/50/75/100.
  - Accepts same props contract as `GroupSensitivityDial` (`group: SensitivityGroup`, `value: number`, `onChange: (group, value) => void`) — swap-in compatible.
  - Doto numeral for current value readout.
  - No gradients, no glass, no shadow — flat panel with thin `var(--fintheon-accent)` border, 1px inner ruler lines at 12% opacity.
- [ ] Replace `GroupSensitivityDial` usage in RefinementEngine.tsx with `NotchedFuse` (keep the existing `GROUPS` array + `onDialChange` handler intact).
- [ ] Visual pass on the whole surface:
  - BG `#050402`, text `#f0ead6`, accent `#c79f4a`.
  - Dot-matrix divider component (tiny dots row) between major sections where flat 1px border feels too heavy.
  - All numeric readouts use `var(--font-data)` Doto.
- [ ] Changelog + top-of-file comments.

## Scope — Excluded (DO NOT TOUCH)

- `EconFiltersManager.tsx` (T1 owns).
- `SourceAccountsManager.tsx` (out of scope — already shipped).
- `CommentatorManager.tsx`, `QuickWeightEditor.tsx`, `MatrixEditor.tsx`, `LexiconEditor.tsx`, `PresetSelector.tsx`, `RegimeControl.tsx` (leave alone — they render inside the new main area as-is).
- Any backend file. Data contracts unchanged.
- `GroupSensitivityDial.tsx` — leave the file in place (other callers may exist); just stop importing it into RefinementEngine. Do NOT delete.

## Known issues to preserve

- `feedback_no_glass_effects`: flat surfaces, accent borders only. Overrides any `/solvys-feels` frosted-glass default.
- `feedback_fuses_are_sacred`: TP explicitly signed off on this notched-fuse redesign in plan mode — safe to proceed in THIS context; do not extend beyond RefinementEngine.
- `feedback_send_button_style`: if any send affordance appears, it's a circular ArrowUp, never an airplane.
- `feedback_riskflow_card_anatomy`: the right-panel feed items still render via existing `AnnotatableItem`; do not redesign card internals.
- Banned: emojis, gradients, Kanban borders, AI sparkles, shimmer, colored 3D icons.

## Implementation steps

1. Read current `RefinementEngine.tsx` (lines 324–510) end-to-end; sketch new flex split.
2. Build `NotchedFuse.tsx` standalone; verify it accepts the same `onChange` contract as `GroupSensitivityDial`.
3. Add a small `DotMatrixDivider.tsx` (or inline) — optional but nice.
4. Rewrite the two-column section of RefinementEngine: main 75% + right 25%.
5. Ensure loading skeleton still works; empty-feed state still shows "No feed items. Backend may need to be running."
6. `npx tsc --noEmit --project frontend/tsconfig.json` → clean.
7. `rm -rf frontend/dist && npx vite build --config frontend/vite.config.ts` → clean.
8. Changelog + top-of-file `// [claude-code 2026-04-24]` comments.

## Acceptance criteria

- [ ] Layout: main pane on left (75%), feed on right (25%).
- [ ] Notched fuses render in place of the old dials with matching behavior (drag/click updates `pendingSensitivities`).
- [ ] No glass / gradient / emoji / Kanban artifacts anywhere on the surface.
- [ ] All AdvancedPane children still render (matrix, lexicon, weights, commentator, source-accounts, + T1's EconFiltersManager slot — even if T1 hasn't merged yet, the slot shouldn't break).
- [ ] tsc clean, vite build clean.

## Validation commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && npx vite build --config frontend/vite.config.ts
```

## Commit format

```
[v.04.24.2] feat: T2 refinement engine layout flip + notched fuses
```
