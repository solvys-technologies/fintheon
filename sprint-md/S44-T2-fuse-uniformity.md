# Sprint Brief: S44-T2 — Fuse Uniformity (canonical NothingFuse + IVStack)

## Context

Two fuse implementations in the Refinement Engine don't follow the canonical RiskFlowCard anatomy: `NotchedFuse.tsx` (Group Sensitivity, range -1..+1) and `QuickWeightEditor.tsx`'s `NothingWeightSlider` sub-component (Event Weights, range 0-10). Per `feedback_riskflow_card_anatomy`: every numeric/severity card must use a single segmented `NothingFuse` + right-stacked `IVStack` (chevron over Doto numeral). Today these two fuses use bespoke segmented bars and right-side text that doesn't match. Visible bug: tick marks bleed across the value-fill, and the value bar terminates before the numeral leaving a gray tail.

This track rewrites both to use the canonical primitives. Drag/snap behavior is preserved.

## Branch Target

`s35-unified`

## Scope — Included

- [ ] Rewrite `frontend/components/refinement/NotchedFuse.tsx` to use `NothingFuse` + `IVStack`
- [ ] Rewrite `NothingWeightSlider` sub-component inside `frontend/components/refinement/QuickWeightEditor.tsx` to use `NothingFuse` + `IVStack`. Keep the parent `QuickWeightEditor` shell (header, Save button, Show All toggle).

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/refinement/RefinementEngine.tsx` — T5 owns
- `frontend/components/refinement/RefinementGlassGate.tsx` — T1 owns (NEW file)
- `frontend/components/refinement/AdvancedPane.tsx` — T1 owns
- `frontend/components/refinement/SourceAccountsManager.tsx` — T3 owns
- `frontend/components/refinement/EconFiltersManager.tsx` — T3 owns
- `frontend/components/refinement/CommentatorManager.tsx` — T3 owns
- `frontend/components/refinement/RegimeControl.tsx` — T3 owns
- `frontend/components/shared/NothingFuse.tsx` — REUSE ONLY, do not modify
- `frontend/components/shared/IVStack.tsx` — REUSE ONLY, do not modify
- `frontend/components/SettingsPanel.tsx` — uncommitted WIP, off-limits

## Reuse Inventory

- `frontend/components/shared/NothingFuse.tsx` — props:
  ```ts
  { value: number /* 0..1 */, segments?: number, severity?: 'critical'|'high'|'medium'|'low',
    score?: number, palette?: string, orientation?: 'horizontal'|'vertical',
    thickness?: number, animateIn?: boolean, className?: string }
  ```
- `frontend/components/shared/IVStack.tsx` — props:
  ```ts
  { score: number, direction: 'Bullish'|'Bearish'|'Neutral'|null, color?: string,
    width?: number, fontSize?: number, chevronSize?: number, className?: string, style?: CSSProperties }
  ```
- `frontend/fonts.css` — Doto font already loaded; IVStack handles inline style
- Solvys Gold: `#c79f4a`

## Known Issues to Preserve

- Pointer + touch drag handlers must keep working (current impl at NotchedFuse.tsx lines 211-212 for touch)
- Snap behavior: 0.05 step on Group Sensitivity, 0.5 step on Event Weights (current QuickWeightEditor uses snap-to-1; verify on mount and preserve whatever snap is currently in place — read code first)
- "Save" button counts changed items — keep the parent shell logic in QuickWeightEditor; only rewrite the inner slider
- "Show All (35)" toggle stays
- Auto-checkpoint hook will commit WIP — expected

## Implementation Steps

### 1. Read first

```bash
# Read the existing files to understand snap, drag, and value mapping
cat frontend/components/refinement/NotchedFuse.tsx | head -301
cat frontend/components/refinement/QuickWeightEditor.tsx | head -241
cat frontend/components/shared/NothingFuse.tsx
cat frontend/components/shared/IVStack.tsx
```

### 2. Rewrite NotchedFuse

Range is -1..+1. Convert to 0..1 for NothingFuse:

```tsx
const normalized = (value + 1) / 2; // -1 → 0, 0 → 0.5, +1 → 1
const direction: "Bullish" | "Bearish" | "Neutral" =
  value > 0.1 ? "Bullish" : value < -0.1 ? "Bearish" : "Neutral";
```

Layout:

```
[ label + sublabel ]   [---- NothingFuse ----]   [IVStack chevron + score]
```

- Use `segments={11}` so each segment is 0.2 of the original -1..+1 range
- IVStack `score` displays the actual value (e.g., `0.45` not the normalized `0.725`)
- Drop the bespoke -1.0 / 0 / +1.0 tick labels — NothingFuse's segmented track is the visual language

Keep the existing pointer/touch handlers but swap the visual track for NothingFuse. Drag still computes value in -1..+1 space; just the rendering changes.

### 3. Rewrite NothingWeightSlider in QuickWeightEditor

Range is 0-10. Convert to 0..1:

```tsx
const normalized = value / 10;
// magnitude only — no chevron direction
```

Layout:

```
[ event-name ]   [---- NothingFuse ----]   [IVStack chevron+score]
```

- `segments={10}`
- Pass `direction='Neutral'` to IVStack so the chevron is suppressed (IVStack should hide chevron on Neutral; if it doesn't, pass `direction={null}` — verify against IVStack source first)
- Score numeral shows e.g., `9.5` (one decimal)
- Drop the bespoke 5-tick row at lines 187-194 — the segmented bar IS the tick visualization
- Drop the existing value popover at lines 219-230 — IVStack shows the value in real time

### 4. Preserve drag interaction

Both files have onPointerDown/onPointerMove/onPointerUp handlers. Keep them. The handlers compute a new value from pointer x-position relative to track width. NothingFuse renders read-only; the surrounding row owns the drag. Wrap NothingFuse in a div that has the drag handlers, and pass the computed `value` (still in original range) down.

### 5. Visual spec

- Row height: match RiskFlowCard mobile spec (~48px)
- IVStack width: fixed 60px right-aligned column
- NothingFuse fills middle, label fills left ~25-30%
- Solvys Gold for fill color (NothingFuse defaults to gold per its palette prop or via inline override)

## Acceptance Criteria

- [ ] Group Sensitivity rows show: label/sublabel left, segmented gold fuse middle, IVStack right (chevron + Doto numeral)
- [ ] Drag still works on both pointer and touch
- [ ] Chevron in IVStack flips Bullish (up) when value > 0.1, Bearish (down) when < -0.1, hidden when Neutral
- [ ] Event Weights rows show: event name left, segmented gold fuse middle, IVStack right (no chevron, just numeral)
- [ ] Value persists on release per existing API call
- [ ] No tick-mark bleed across fill (bug fixed via removing bespoke ticks)
- [ ] No bespoke "0.00 NEUTRAL" right-side text
- [ ] Tick marks below the bar removed (segmented bar is the tick visualization)

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/fintheon
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

## Commit Format

```
[v5.28.0] feat: S44-T2 fuse uniformity — NothingFuse + IVStack across Refinement Engine
```
