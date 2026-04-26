# Sprint Brief: S42-T8 — Nothing Fuses + Spinners + Doto Display Font

## Context

TP wants the existing `NothingFuse` and every spinner refactored to a Nothing-design language — clean, segmented, monochrome, deliberate motion (not jittery; no AI sparkles). Add the **Doto** display font (already wired in mobile via `mobile/index.css`) to the desktop frontend so numeric displays use the same monospace monumental typography across both surfaces.

This is a foundation track: T3 (AgentActivityRail tool-call status) imports NothingFuse; T7 (mount perf) replaces spinners with skeletons. Both consume from this track. **T8 owns the visual treatment** of all fuses + spinners; other tracks must IMPORT and USE these primitives without modifying their internals.

The earlier memory rule "fuses are sacred" is **explicitly REVERSED for this sprint** by TP's R2 answer.

## Branch Target

`s42-t8-nothing` (cut from worktree `~/Desktop/Codebases/fintheon-s42-chat-sota` off `v5.28.0`)

## Scope — Included

### NothingFuse refactor

- [ ] `frontend/components/shared/NothingFuse.tsx` — Nothing-design segmented bar: thin segments, accent fill, micro-gap between segments, deliberate (slow) progressive fill animation, no jitter, no glow
- [ ] Mobile equivalent at `mobile/components/shared/VerticalFuseBar.tsx` — apply same Nothing language (vertical orientation preserved)
- [ ] Document the pattern in a JSDoc comment at the top of `NothingFuse.tsx` so other tracks know what to import

### Spinner overhaul

- [ ] `mobile/components/shared/RadarSpinner.tsx` — Nothing-design: thin sweeping line, no glow, deliberate motion
- [ ] `mobile/components/shared/SegmentedSpinner.tsx` — same segmented language as NothingFuse but rotational
- [ ] `frontend/components/ui/ai-loader.tsx` — strip any AI-sparkle / shimmer; convert to Nothing segmented spinner
- [ ] `frontend/components/icon-bank/UnicodeSpinners.tsx` — audit; if any use unicode dots/stars that read as decorative, replace with simple geometric variant; otherwise leave

### Doto display font (desktop)

- [ ] Add `Doto` `@font-face` block to `frontend/index.css` mirroring the mobile pattern at `mobile/index.css`
- [ ] Add `--font-display: "Doto", monospace;` CSS var to desktop frontend `:root`
- [ ] Apply to digit/number elements where applicable — search `frontend/components/` for components that render numerals (especially KPI displays, IV scores, latency footers from T3, NothingFuse percentage labels)
- [ ] Copy `public/fonts/doto.woff2` from mobile to frontend public dir if not already shared

## Scope — Excluded (DO NOT TOUCH)

- Existing fuse INSTANCES in components (e.g., `RiskFlowMini.tsx`, `narrative/InstrumentFusesPanel.tsx`, `BlendedVIXCard.tsx`, `SanctumRiskAssessment.tsx`, `NextSessionForecastCard.tsx`) — those CALL NothingFuse; T8 only changes the primitive's visual treatment. Callers are untouched.
- T3 AgentActivityRail — imports NothingFuse; do not modify the rail
- T7 skeleton placeholders — separate primitive; not a spinner
- All chat surfaces (T2, T3, T4, T6)
- Backend
- TradingView Sanctum chart
- Refinement Engine S37
- RiskFlow ingest pipeline

## Reuse Inventory

- Existing `frontend/components/shared/NothingFuse.tsx` — refactor in place; do NOT fork
- Existing `mobile/components/shared/VerticalFuseBar.tsx` — refactor in place
- Mobile `Doto` `@font-face` at `mobile/index.css` lines (search `font-display.*Doto`) — mirror to frontend
- `mobile/public/fonts/doto.woff2` — likely lives at `mobile/public/fonts/doto.woff2`; copy to `frontend/public/fonts/doto.woff2` if not shared via a common path
- `solvys-transitions`: `t-badge` for segmented fade-in if needed
- Solvys palette only — accent `#c79f4a`, no gradients

## Known Issues to Preserve

- NothingFuse SHAPE (segmented horizontal bar with N segments) — preserve; only refine visual treatment
- VerticalFuseBar orientation — preserve
- Existing instances render correctly — visual change is acceptable (this is the point), but layout dimensions should not shift (consumers depend on width/height)
- Memory: "SVG animations → WAAPI not CSS keyframes" — if RadarSpinner uses CSS keyframes for `cx/cy`, convert to WAAPI

## Implementation Steps

1. **Refactor `NothingFuse.tsx`**:
   - Visual treatment: segments are 2-3px tall, `gap-px` between segments, filled segments use accent color with no glow, empty segments use `border-[var(--accent)]/30`
   - Animation: progressive fill on data change uses `transition-all duration-[600ms] ease-out` (deliberate, not snappy)
   - No drop-shadow, no inner glow, no gradient fill
   - Width/height props preserved
   - Add JSDoc at top documenting the pattern: "Nothing-design segmented fuse. Used by activity rails, RiskFlow cards, IV displays. Segment fill = accent #c79f4a; empty = border accent at 30% opacity. Do not add gradient or glow — banned ornaments."
2. **Refactor `mobile/components/shared/VerticalFuseBar.tsx`** with same language, vertical orientation
3. **Refactor `RadarSpinner.tsx`**:
   - Single thin SVG line sweeping clockwise, accent color, 1500ms rotation period (deliberate)
   - Use `element.animate()` (WAAPI) not CSS `@keyframes` (memory: SVG animations → WAAPI)
   - No glow, no trail, no fade gradient
4. **Refactor `SegmentedSpinner.tsx`**:
   - Circular arrangement of NothingFuse-like segments; one segment "fills" at a time, walking clockwise
   - Pure rotation via WAAPI
5. **Refactor `frontend/components/ui/ai-loader.tsx`**:
   - Strip any decorative shimmer or AI-sparkle effect
   - Replace with a horizontal NothingFuse loading bar (indeterminate mode: 3-segment cluster moves left-to-right)
6. **Audit `UnicodeSpinners.tsx`**:
   - For any unicode glyph spinner (e.g., `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`), keep braille frames (those are clean)
   - Remove any star/sparkle/dot-cluster variants
7. **Doto on desktop frontend**:
   - Open `frontend/index.css`, add at top:
     ```css
     @font-face {
       font-family: "Doto";
       src: url("/fonts/doto.woff2") format("woff2");
       font-weight: 100 900;
       font-display: swap;
     }
     :root {
       --font-display: "Doto", monospace;
     }
     ```
   - Copy font file: `cp ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile/public/fonts/doto.woff2 ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend/public/fonts/doto.woff2`
   - Apply to numeric displays: search `frontend/components/` for `font-mono` or numeral-heavy components (KPI cards, NothingFuse labels, anything T3's MessageFooter renders for latency `1.4s` / source-count `12`); switch to `font-[var(--font-display)]` where appropriate
8. **Verify font loads**: cold-mount frontend → DevTools Network tab shows `doto.woff2` 200; computed style on a numeric element shows `font-family: Doto, monospace`

## Acceptance Criteria

- [ ] `NothingFuse` renders Nothing-design segmented bar (no glow, no gradient, deliberate fill)
- [ ] All callers of `NothingFuse` (RiskFlowMini, InstrumentFusesPanel, BlendedVIXCard, etc.) render correctly with no layout shift
- [ ] `RadarSpinner`, `SegmentedSpinner`, `ai-loader` all use Nothing language; no shimmer; no AI sparkles
- [ ] WAAPI used for any SVG animation (no CSS keyframes for `cx/cy`)
- [ ] Doto font loads on desktop frontend (Network tab 200 + computed style on numeric element)
- [ ] At least 3 numeric displays on desktop frontend now render in Doto (e.g., KPI numbers, MessageFooter latency, NothingFuse %)
- [ ] Mobile Doto wiring unchanged (already working)
- [ ] `cd frontend && npx tsc --noEmit --project tsconfig.json` clean
- [ ] `cd mobile && npx tsc --noEmit` clean
- [ ] `cd frontend && rm -rf dist && npx vite build` clean
- [ ] `cd mobile && rm -rf dist && npx vite build` clean
- [ ] Font file `frontend/public/fonts/doto.woff2` present and bundled

## Validation Commands

```bash
# Copy font (if not already shared)
cp ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile/public/fonts/doto.woff2 \
   ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend/public/fonts/doto.woff2

cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx tsc --noEmit --project tsconfig.json
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx tsc --noEmit

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx vite build

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx vite build

# Verify Doto bundled
ls ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend/dist/fonts/doto.woff2
```

## Banned Ornaments

- No gradients, no emojis, no Kanban borders, no AI sparkles (✨, shimmer, glow), no glassmorphic surfaces
- No drop-shadow on fuses or spinners
- No CSS keyframes for SVG `cx/cy` properties (use WAAPI)

## Commit Format

```
[v5.29.0] feat: T8 Nothing-design fuses + spinners + Doto display font on frontend
```
