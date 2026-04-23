# Sprint Brief: S32-T4 — Consul Control Pixelation Indicator

## Context

Sprint 2 (Harper 2.1). When Harper is actively driving the app via **Consul Control** (Playwright-style app control — same visual concept as Browser Operator's takeover indicator), the current UI paints a flat solid-color overlay at the screen corners. TP wants that replaced with an **animated pixelation effect** with transparency and character: think glitchy dithering ticks at the four corners that pulse while Harper is holding the wheel.

This is a pure frontend polish track. No backend changes. Ties into the existing Consul Control status signal (already emitted by whichever service starts/stops the Playwright session).

## Branch Target

`s32-harper-2-1` (runs parallel with T2 + T3 after T1 merges)

## Scope — Included

- [ ] New component `frontend/components/consul-control/ConsulControlCorners.tsx`:
  - Four absolutely-positioned elements at screen corners (top-left, top-right, bottom-left, bottom-right)
  - Each corner is an **animated pixel grid** (8×8 or 16×16 cells)
  - Cells randomly fade in/out on a 400-600ms cycle with staggered phases
  - Cell color: Solvys Gold `#c79f4a` at varying alpha (8%–40%)
  - Corner shape mask: pixels denser toward the outer corner, trailing off diagonally inward (L-shape gradient of density, not color gradient)
  - Pointer-events: none — decorative only, never blocks clicks
  - No blur, no box-shadow, no gradient fills — pure alpha + per-cell animation
  - File <200 lines

- [ ] Animation implementation:
  - CSS keyframes `@keyframes consul-pixel-flicker` with `opacity: 0.08 → 0.4 → 0.08`
  - Each cell has a randomized `animation-delay` (computed once on mount, stable for the session)
  - `will-change: opacity` on cells for GPU offload
  - Pause animation when Consul Control is inactive (CSS class toggle, not unmount)

- [ ] Mount point in `frontend/App.tsx` (or the top-level layout shell):
  - Render `<ConsulControlCorners active={isConsulControlActive} />` as a sibling of the main layout, behind any modals
  - `isConsulControlActive` source: existing Consul Control state (grep for `consul-control`, `browser-operator`, `playwright`, `browse_task`). If no single source of truth exists, add a lightweight `useConsulControlStatus()` hook that polls `GET /api/consul-control/status` every 2s or subscribes to an SSE/WebSocket if one exists

- [ ] Fade-in/fade-out transition:
  - Corners fade in over 400ms when activation flips to true
  - Fade out over 600ms when it flips to false
  - No snap/flash

- [ ] Replace old solid-color overlay:
  - Grep for the current Consul Control indicator (search terms: `consul-control`, `takeover-overlay`, `control-indicator`, `playwright-overlay`)
  - Delete the old overlay component entirely (not commented out — deleted)
  - Replace its mount with the new `<ConsulControlCorners />`

- [ ] Changelog + file headers

## Scope — Excluded (DO NOT TOUCH)

- Harper Vision (VisionPanel, VisionStatus) — T2 territory
- Provider chain / Ollama fallback — T3 territory
- Consul Control backend / Playwright service — unrelated; only consume the status signal
- Any other overlay, banner, or toast in the app

## Known Issues to Preserve

- Global UI rules: no gradients (color gradients), no glass blur, no emojis. Density gradient (cells per square) is fine — that's layout, not color.
- Solvys Gold `#c79f4a` is the only accent color allowed for the pixels. Do NOT introduce a second accent.
- Pointer-events must stay `none` — this overlay cannot interfere with any click target.
- Performance: the animation must not cause layout thrash. Per-cell `opacity` animation via CSS keyframes is cheap. Do NOT animate size, position, or box-shadow.

## Implementation Steps

1. Grep for the existing Consul Control indicator and its activation signal. Read both.
2. Sketch the four-corner pixel grid math (cell count per corner, density fall-off equation, corner size as % of viewport).
3. Build `ConsulControlCorners.tsx` with CSS keyframes + randomized per-cell delays.
4. Wire `active` prop to the existing status signal.
5. Replace the old overlay mount in `App.tsx` / top-level layout.
6. Delete the old overlay file.
7. Manually test: trigger Consul Control (ask Harper to browse somewhere), confirm corners animate; end the task, confirm corners fade out.
8. Verify at 1440×900 + 2560×1600 that corner size feels right.
9. Changelog + header.

## Acceptance Criteria

- [ ] When Consul Control activates, four corners of the app window show animated gold-pixel flicker
- [ ] When it deactivates, corners fade out cleanly (no snap)
- [ ] Pointer events pass through — clicking anywhere under the corners still works
- [ ] No gradients, no blur, no box-shadow on the new component
- [ ] Old solid-color overlay is deleted (not commented out)
- [ ] `tsc --noEmit` + `vite build` pass
- [ ] FPS doesn't drop below 60 when corners are animating (test via Chrome DevTools performance tab)
- [ ] File <200 lines
- [ ] Changelog entry added

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# Gate: no gradients or blur in the new component
grep -E "gradient|backdrop-blur|blur\(|box-shadow" frontend/components/consul-control/ConsulControlCorners.tsx \
  && echo "FAIL: banned effect present" || echo "OK"

# Confirm old overlay deleted
grep -r "takeover-overlay\|ConsulControlOverlay" frontend/ | grep -v ConsulControlCorners \
  && echo "FAIL: old overlay references remain" || echo "OK"
```

## Commit Format

```
[v5.23.0] feat: S32-T4 Consul Control pixelation corners (replace solid overlay)
```
