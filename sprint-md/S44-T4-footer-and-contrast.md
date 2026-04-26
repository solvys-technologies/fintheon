# Sprint Brief: S44-T4 — Footer Lozenges + Secondary Text Contrast Pass

## Context

Two legibility problems compound across the platform:

1. **Footer status lozenges** at `frontend/components/layout/FooterToolbar.tsx:944` (the Gateway/AI/Database/X/Auth row) currently use four different green shades + an off-state, violating the monochrome rule.
2. **Secondary text contrast** across the Refinement Engine surface fails WCAG AA — body text rendered at ~30-40% opacity on `#050402` background is unreadable. Confidence/source labels in `RegimeControl.tsx`, descriptive copy in `QuickWeightEditor.tsx` headers, and similar low-contrast text throughout need a minimum bump to 60%+ opacity.

This track owns the footer + contrast tokens. It coordinates with T2 (fuse internals — T2 owns) and T3 (tag color — T3 owns). T4 is restricted to **secondary text and surrounding controls**, not fuse internals or category badges.

## Branch Target

`s35-unified`

## Scope — Included

- [ ] `frontend/components/layout/FooterToolbar.tsx` — status lozenge styling (Gateway/AI/Database/X/Auth row at line 944 region)
- [ ] `frontend/components/refinement/RegimeControl.tsx` lines 104-110 ONLY — confidence/source label opacity bumps
- [ ] `frontend/components/refinement/QuickWeightEditor.tsx` — header text + Save button + Show All toggle visual weight (DO NOT modify the slider sub-component — T2 owns)
- [ ] Glyph weight unification: every `lucide-react` icon used in Refinement section headers should be the same stroke width (1.5). Audit and align.

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/refinement/RefinementEngine.tsx` — T5 owns
- `frontend/components/refinement/RefinementGlassGate.tsx` — T1 owns
- `frontend/components/refinement/AdvancedPane.tsx` — T1 owns
- `frontend/components/refinement/NotchedFuse.tsx` — T2 owns
- `NothingWeightSlider` sub-component inside `QuickWeightEditor.tsx` — T2 owns (T4 only touches the parent shell's header, save, toggle)
- `frontend/components/refinement/SourceAccountsManager.tsx` — T3 owns
- `frontend/components/refinement/EconFiltersManager.tsx` — T3 owns
- `frontend/components/refinement/CommentatorManager.tsx` — T3 owns
- `RegimeControl.tsx` lines 25-34 (REGIME_COLORS) and line 98 (badge) — T3 owns
- `frontend/styles/custom.css` — recently touched per changelog; coordinate carefully or skip
- `frontend/components/SettingsPanel.tsx` — uncommitted WIP, off-limits

## Coordination Note

**`frontend/components/layout/FooterToolbar.tsx` lives in `frontend/components/layout/`, which the changelog flags as recently touched.** Read the file first. If its modification timestamp shows recent unrelated changes, leave a top-of-file comment documenting your edits and only touch the lozenge section. Do not modify other parts of the file.

## Reuse Inventory

- Solvys Gold: `#c79f4a`
- Solvys Text: `#f0ead6`
- Tailwind opacity syntax: `text-[#f0ead6]/65`, `text-[#c79f4a]/60`
- `lucide-react` icons — already imported across the codebase

## Known Issues to Preserve

- Footer is shown across multiple pages, not just Refinement Engine — your changes affect all of them. Verify visually that none of the other surfaces depend on the green color coding semantically (likely they don't — health is health).
- `useGateway()` hook drives gateway status; do NOT change the data flow, only the rendering.

## Implementation Steps

### 1. Locate the lozenge component

```bash
sed -n '930,1000p' frontend/components/layout/FooterToolbar.tsx
```

The lozenges render via a `label="Gateway"`, `label="AI"`, etc. pattern at line 944. Find the parent component or sub-component that renders each lozenge — it likely takes a `status` prop (e.g., `"online" | "idle" | "error"`).

### 2. Restyle lozenges with single-hue + opacity ladder

```tsx
const LOZENGE_STYLE: Record<Status, string> = {
  online: "text-[#c79f4a] border-[#c79f4a]/60 bg-[#c79f4a]/10",
  idle: "text-[#c79f4a]/55 border-[#c79f4a]/25 bg-transparent",
  error: "text-[#c79f4a]/85 border-[#c79f4a]/45 bg-[#c79f4a]/15", // gold heated, no red hue swap
};
```

Note: errors stay gold but visually heated via opacity boost. If TP wants a red error tint later, that's a follow-up. Default behavior here is monochrome.

### 3. RegimeControl confidence/source labels

Lines 104-110 currently render at low opacity. Bump to:

```tsx
className = "text-[10px] text-[#f0ead6]/65 tracking-wide";
```

(or whatever class is currently there — replace the opacity portion only).

### 4. QuickWeightEditor header + controls

The "EVENT WEIGHTS" header glyph (slider icon) should be `lucide-react`'s `SlidersHorizontal` at `size={14}` and `strokeWidth={1.5}`. Audit and align.

The "Show All (35)" link and "Save" button: bump their text opacity from current (likely `/40` or `/50`) to `text-[#f0ead6]/75` for the active state.

### 5. Glyph audit across Refinement section headers

Run:

```bash
grep -nE 'from "lucide-react"|<(Lock|Unlock|Wrench|BookOpen|SlidersHorizontal|Users|Rss|Calendar|Settings) ' frontend/components/refinement/*.tsx
```

For every section header glyph, ensure:

- `size={14}` for inline header chips
- `size={16}` for prominent headers
- `strokeWidth={1.5}` consistently
- No filled/solid icons mixed with outline icons

Update inline only; don't restructure.

### 6. Add changelog header to each modified file

```tsx
// [claude-code 2026-04-26] S44-T4 contrast + footer lozenge monochrome pass.
```

## Acceptance Criteria

- [ ] Footer lozenges all use a single hue (gold), distinguishable by opacity
- [ ] No green/cyan shades in `FooterToolbar.tsx` lozenge rendering path
- [ ] RegimeControl confidence/source labels readable on `#050402` (manual eye-test against AA)
- [ ] QuickWeightEditor header glyph + body text legible
- [ ] All Refinement section header glyphs same stroke weight (1.5)
- [ ] No new colors introduced
- [ ] Build clean

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/fintheon
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# Sanity grep for lingering green in footer
grep -nE 'text-(green|emerald)-|bg-(green|emerald)-' frontend/components/layout/FooterToolbar.tsx
```

## Commit Format

```
[v5.28.0] feat: S44-T4 footer monochrome lozenges + Refinement contrast pass
```
