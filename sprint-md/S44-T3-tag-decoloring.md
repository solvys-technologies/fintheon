# Sprint Brief: S44-T3 — Tag De-coloring (monochrome pills across managers)

## Context

Four manager files in the Refinement Engine use multi-hue category tags that violate the Solvys monochrome rule. Current state:

- `SourceAccountsManager.tsx`: Wire=accent, OSINT=cyan-400, Geopolitical=red-400, Macro=emerald-400, Custom=zinc-400
- `EconFiltersManager.tsx`: Fiscal=accent, Inflation=amber-400/80, Supply Chain=zinc-400, Job Market=slate-400
- `CommentatorManager.tsx` (POI): T1=accent, T2=cyan-400, T3=zinc-400
- `RegimeControl.tsx`: regime color map at lines 25-34 includes cyan ("Macro/Econ Driven" renders cyan)

This track collapses everything to Solvys Gold (`#c79f4a`) intensity-stepped. Active vs inactive becomes opacity, not hue. Pill shape unified across all four files.

## Branch Target

`s35-unified`

## Scope — Included

- [ ] `frontend/components/refinement/SourceAccountsManager.tsx` — color map at lines 28-36, pill shape
- [ ] `frontend/components/refinement/EconFiltersManager.tsx` — color map at lines 36-43, pill shape
- [ ] `frontend/components/refinement/CommentatorManager.tsx` — tier color map at lines 29-36, pill shape, T1/T2/T3 weight pills
- [ ] `frontend/components/refinement/RegimeControl.tsx` — REGIME_COLORS at lines 25-34, regime badge style at line 98 only

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/refinement/RefinementEngine.tsx` — T5 owns
- `frontend/components/refinement/RefinementGlassGate.tsx` — T1 owns
- `frontend/components/refinement/AdvancedPane.tsx` — T1 owns
- `frontend/components/refinement/NotchedFuse.tsx` — T2 owns
- `frontend/components/refinement/QuickWeightEditor.tsx` — T2 owns
- `frontend/components/layout/FooterToolbar.tsx` — T4 owns
- RegimeControl.tsx body text at lines 104-110 (Confidence/Source) — T4 owns; T3 only touches the badge
- `frontend/components/SettingsPanel.tsx` — uncommitted WIP, off-limits

## Reuse Inventory

- Solvys Gold hex: `#c79f4a`
- Tailwind opacity syntax already used in repo: `text-[#c79f4a]/60`, `border-[#c79f4a]/40`, `bg-[#c79f4a10]`
- No central CSS variable for gold — use hex literals consistently

## Known Issues to Preserve

- Active/inactive Power-icon toggle behavior in SourceAccountsManager and EconFiltersManager — keep unchanged
- Drag-and-drop in CommentatorManager (GripVertical at line 292) — keep unchanged
- Sort order in all three managers — keep unchanged
- `weightMultiplier` display ("1.5x", "1.2x") — keep, just restyle the pill

## Intensity Ladder (apply to all four files uniformly)

| Tier          | Use case                                                                             | Tailwind class snippet                                 |
| ------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 1 (primary)   | T1 commentators, Wire sources, Fiscal econ filters, critical regimes                 | `text-[#c79f4a] border-[#c79f4a]/60 bg-[#c79f4a]/10`   |
| 2 (secondary) | T2 commentators, Macro/OSINT sources, Inflation/Supply Chain filters, normal regimes | `text-[#c79f4a]/75 border-[#c79f4a]/40 bg-[#c79f4a]/5` |
| 3 (tertiary)  | T3 commentators, Geopolitical/Custom sources, Job Market filters, calm regimes       | `text-[#c79f4a]/55 border-[#c79f4a]/25 bg-transparent` |

Inactive (Power-icon off) overlays a parent `opacity-40` on the entire row — current behavior, keep.

## Pill Shape (unified)

```tsx
className =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase";
```

Apply this base class to every category/tier pill across all four files. Overlay the intensity classes from the ladder on top.

## Regime Mapping (RegimeControl.tsx)

Read existing REGIME_COLORS at lines 25-34. Map by criticality:

- "Macro/Econ Driven", "Fed Pivot", "Crisis", "Risk-Off" → Tier 1
- "Earnings", "Geopolitical", "Sector Rotation" → Tier 2
- "Calm", "Range-bound", "Low Vol" → Tier 3
- Anything else → Tier 2 (default fallback)

If a regime in the map isn't listed above, default to Tier 2. Do NOT add new regimes; only restyle existing ones.

## Implementation Steps

### 1. SourceAccountsManager.tsx

Locate the color map (lines 28-36). Replace each entry:

```tsx
// before:
Wire: 'text-[#c79f4a]',
OSINT: 'text-cyan-400',
Geopolitical: 'text-red-400',
Macro: 'text-emerald-400',
Custom: 'text-zinc-400',

// after — single pill className per category:
const CATEGORY_PILL: Record<string, string> = {
  Wire:         'text-[#c79f4a] border-[#c79f4a]/60 bg-[#c79f4a]/10',
  Macro:        'text-[#c79f4a]/75 border-[#c79f4a]/40 bg-[#c79f4a]/5',
  OSINT:        'text-[#c79f4a]/75 border-[#c79f4a]/40 bg-[#c79f4a]/5',
  Geopolitical: 'text-[#c79f4a]/55 border-[#c79f4a]/25 bg-transparent',
  Custom:       'text-[#c79f4a]/55 border-[#c79f4a]/25 bg-transparent',
};
```

Apply pill base class + category class together.

### 2. EconFiltersManager.tsx

Same pattern at lines 36-43:

```tsx
const FILTER_PILL: Record<string, string> = {
  Fiscal: "text-[#c79f4a] border-[#c79f4a]/60 bg-[#c79f4a]/10",
  Inflation: "text-[#c79f4a]/75 border-[#c79f4a]/40 bg-[#c79f4a]/5",
  "Supply Chain": "text-[#c79f4a]/75 border-[#c79f4a]/40 bg-[#c79f4a]/5",
  "Job Market": "text-[#c79f4a]/55 border-[#c79f4a]/25 bg-transparent",
};
```

### 3. CommentatorManager.tsx

Tier color map at lines 29-36:

```tsx
const TIER_PILL: Record<string, string> = {
  T1: "text-[#c79f4a] border-[#c79f4a]/60 bg-[#c79f4a]/10",
  T2: "text-[#c79f4a]/75 border-[#c79f4a]/40 bg-[#c79f4a]/5",
  T3: "text-[#c79f4a]/55 border-[#c79f4a]/25 bg-transparent",
};
```

Pill display at line 309 (`T1 1.5x` etc.) — keep the text, restyle the wrapper.

### 4. RegimeControl.tsx

Replace REGIME_COLORS at lines 25-34 with criticality-based mapping above. Apply pill at line 98 with the same intensity ladder.

DO NOT modify confidence/source labels at lines 104-110 — that's T4's territory.

### 5. Add changelog header to each modified file

Top of each file:

```tsx
// [claude-code 2026-04-26] S44-T3 monochrome tag pass — gold intensity-stepped, no off-palette colors.
```

## Acceptance Criteria

- [ ] Zero non-gold colors in tags across all four files (grep for `cyan`, `red-`, `green-`, `emerald`, `amber`, `slate-`, `zinc-` inside tag rendering paths returns 0 hits — `zinc-400` text used elsewhere is fine, but not on tag pills)
- [ ] All four files render pills with the same base shape: `rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide border`
- [ ] Active vs inactive distinguishable via row opacity, not hue
- [ ] Regime header pill renders gold (Tier 1/2/3 by criticality), not cyan
- [ ] POI tier pills (T1/T2/T3) all gold, intensity-stepped
- [ ] Drag, sort, Power-toggle, drag-handle behaviors all unchanged

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/fintheon
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# Sanity grep for lingering hue tokens in tag paths
grep -nE 'text-(cyan|red|emerald|amber|slate)-' frontend/components/refinement/SourceAccountsManager.tsx frontend/components/refinement/EconFiltersManager.tsx frontend/components/refinement/CommentatorManager.tsx frontend/components/refinement/RegimeControl.tsx
```

## Commit Format

```
[v5.28.0] feat: S44-T3 monochrome tag pass — Refinement Engine pills to gold intensity ladder
```
