# Sprint Brief: S28-T3 — Icon Bank Overhaul (expo-agent-spinners port)

## Context

The 2026-04-19 "Icon Bank — Unicode spinner library" pass introduced six preset spinners (FishSwimmer, CircleQuarters, MeterBar, ArrowShimmer, MeterToShimmer, HelixVertical) inspired by unicode.framer.website. TP tested them live and says they "all look terrible" and wants the entire bank replaced.

Target source: <https://github.com/Eronred/expo-agent-spinners> (MIT, 54 terminal-style agent spinners; React Native + Expo; text-based — just `Text` elements with `setInterval`; zero native deps). The 54 spinners cover: arc, arrow, balloon, bounce, breathe, cascade, checkerboard, circle-halves, circle-quarters, clock, columns, diagswipe, dots (1-14 variants), double-arrow, dqpb, earth, fillsweep, grow-horizontal, grow-vertical, hearts, helix, moon, noise, orbit, point, pulse, rain, rolling-line, sand, scan, simple-dots, simple-dots-scrolling, snake, sparkle, speaker, square-corners, toggle, triangle, wave, waverows, weather.

The port is straightforward because the source uses `<Text>` (React Native) + `setInterval` + Unicode chars. Swap `<Text>` → `<span>` and the component is a drop-in React web primitive. No Lottie, no raster assets, no heavy runtime.

## Branch Target

`v5.23`

## Scope — Included

- [ ] Port all 54 spinners from <https://github.com/Eronred/expo-agent-spinners> `src/components/spinners/` to `frontend/components/icon-bank/agent-spinners/`. Each file exports a React component that renders `<span>` with `className` instead of `<Text>` with `style`. Preserve the `size`, `color`, `style` props.
- [ ] Create `frontend/components/icon-bank/agent-spinners/index.ts` that re-exports all 54.
- [ ] Add a common `size`/`color` type alias so existing imports don't need to pass huge prop bags.
- [ ] **Replace every usage** of the old UnicodeSpinners presets (`FishSwimmer`, `CircleQuarters`, `MeterBar`, `ArrowShimmer`, `MeterToShimmer`, `HelixVertical`) with the appropriate agent-spinner. Mapping:
  - `FishSwimmer` (Aquarium loader) → `SnakeSpinner` or `WaveSpinner` (snake fits the "movement through a medium" vibe).
  - `CircleQuarters` (refresh icon + splash LOADING) → `CircleQuartersSpinner` (direct name match).
  - `MeterBar` → `GrowHorizontalSpinner` or `FillsweepSpinner`.
  - `ArrowShimmer` → `ArrowSpinner` or `DoubleArrowSpinner`.
  - `MeterToShimmer` (RiskFlow header refresh motion) → compose `GrowHorizontalSpinner` + `ArrowSpinner` with a handoff, OR just use `FillsweepSpinner` single-phase.
  - `HelixVertical` (chat radar pulse + AiLoader) → `HelixSpinner` (direct name match).
- [ ] Consumer updates (each file — replace the import + the JSX):
  - `frontend/App.tsx` (splash LOADING microinteraction).
  - `frontend/components/feed/RiskFlowMain.tsx` (header refresh button + top-bar shimmer).
  - `frontend/components/narrative/AquariumPredictionCards.tsx` (Aquarium loader).
  - `frontend/components/chat/FintheonThinkingIndicator.tsx`.
  - `frontend/components/chat/FintheonThread.tsx` (AiLoader).
  - Any other file grep finds.
- [ ] **Delete** the old preset file or reduce it to backward-compat shims that proxy to the new components (prefer deletion if call-sites are all updated in the same commit).
- [ ] Honor `prefers-reduced-motion` — the Eronred source uses `setInterval` unconditionally; add a wrapper that stops the interval when the media query matches.

## Scope — Excluded (DO NOT TOUCH)

- **Any fuse component** (`NothingFuse`, `VerticalFuseBar`) or spinners/loading indicators adjacent to fuses (per standing rule: fuses are sacred).
- TopHeader, MainLayout, or any voice surface file (T2 owns).
- Omi backend routes / services / prosody extractor (T1 owns).
- The Solvys Gold palette, accent border rules, no-glass-effects rule — the ports must render in monochrome Solvys palette (accent `#c79f4a` for active, text `#f0ead6` for neutral, BG `#050402`).

## Known Issues to Preserve

- The old preset names (FishSwimmer etc.) may be imported from multiple places — grep thoroughly before deletion to avoid leaving dangling imports.
- `UnicodeSpinners.tsx` has a `severity` + `priority` prop convention that drives color + animation interval. The new agent-spinners should accept an equivalent — add a small wrapper `<Spinner severity="warn" priority="high" which={HelixSpinner} />` if needed, or bake the convention into each component's default props.
- Any file listed in `src/lib/changelog.ts` 2026-04-19 as modified by the icon-bank pass has intentional code around the spinner — preserve placement, only swap the component.

## Implementation Steps

1. **Clone the source locally (read-only ref)**: `gh repo clone Eronred/expo-agent-spinners /tmp/expo-agent-spinners`. Do not commit the clone — it's a reference for porting.
2. **Port pattern — one file first**: pick `circle-quarters.tsx` as the pilot. Convert RN `<Text>` → HTML `<span>`; `StyleSheet` → inline style or Tailwind; `setInterval` → `useEffect` with cleanup. Verify it renders in `App.tsx` splash first.
3. **Port the remaining 53** following the same pattern. They're all structurally identical — a `frames` array + index state + interval tick.
4. **Add the severity/priority wrapper** so existing consumers can call `<CircleQuartersSpinner severity="warn" priority="high" />` without a large props change.
5. **Grep for old presets**: `grep -rn "FishSwimmer\|CircleQuarters\|MeterBar\|ArrowShimmer\|MeterToShimmer\|HelixVertical" frontend/ --include="*.ts" --include="*.tsx"`. Walk the list, swap each usage.
6. **Delete or gut** `frontend/components/icon-bank/UnicodeSpinners.tsx`. If any stragglers reference it, leave a thin re-export shim temporarily — but aim for full deletion in this sprint.
7. **Reduced-motion wrapper**: `useReducedMotion()` hook (prefers-reduced-motion: reduce). When true, stop the interval + render a static frame.
8. **Build + sanity**: `tsc --noEmit`, `vite build`, `rm -rf mobile/dist && npx vite build` from `mobile/` (mobile's own icon-bank consumption is _separate_ — if mobile imports nothing from `frontend/components/icon-bank/` this is a no-op; check before declaring done).

## Acceptance Criteria

- [ ] 54 spinner components exported from `frontend/components/icon-bank/agent-spinners/index.ts`.
- [ ] `grep -rn "FishSwimmer\|CircleQuarters\|MeterBar\|ArrowShimmer\|MeterToShimmer\|HelixVertical" frontend/ --include="*.ts" --include="*.tsx"` returns zero hits (or only a deprecation-shim file).
- [ ] App splash loader renders with `CircleQuartersSpinner` (or chosen equivalent).
- [ ] RiskFlow header refresh button uses `GrowHorizontalSpinner`/`FillsweepSpinner`.
- [ ] Aquarium loader uses `SnakeSpinner` (or chosen equivalent).
- [ ] Chat thinking indicator + AiLoader use `HelixSpinner`.
- [ ] No fuse component touched: `git diff --name-only origin/v5.22...HEAD | grep -i fuse` returns empty.
- [ ] `prefers-reduced-motion: reduce` stops the spinner interval and renders a static glyph.
- [ ] `tsc --noEmit` + `vite build` clean.

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

grep -rn "FishSwimmer\|CircleQuarters\|MeterBar\|ArrowShimmer\|MeterToShimmer\|HelixVertical" frontend/ --include="*.ts" --include="*.tsx"
git diff --name-only origin/v5.22...HEAD | grep -i fuse  # must be empty
```

## Commit Format

```
[v5.23] feat: T3 port expo-agent-spinners (54) — replace 2026-04-19 Unicode bank
```

## License note

expo-agent-spinners is MIT. Attribute in the ported files' top-of-file comment:

```tsx
// Ported from https://github.com/Eronred/expo-agent-spinners (MIT) — S28-T3 2026-04-20
```
