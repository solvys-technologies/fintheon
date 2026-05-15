# Sprint Brief: S62-T22 — Micro-Interactions Pass

- **Linear**: SOL-68
- **Parent ORCH**: @sprint-md/S62-ORCH-platform-qa-hygiene.md
- **Branch**: `sprint/S62`
- **Assignee**: Shashank
- **Wave**: 2 (after Wave 1 — chat slots must be stable)

## Context

Micro-interactions define the feel of the platform — smooth drawer animations, clean formatting transitions, responsive hover states, and deliberate motion timing. This task audits key interactive surfaces for animation quality, verifies Solvys timing tokens are used (not arbitrary durations), and checks `prefers-reduced-motion` compliance. All motion must feel industrial-luxe: crisp, deliberate, no bounce or squish.

## Branch Target

`sprint/S62`

## Scope — Included

- [ ] **Chat drawer open/close** — `frontend/components/chat/CognitionPanel.tsx` — smooth slide, no flicker, no layout shift
- [ ] **Chat slots** — `frontend/components/chat/slots/` — message render transitions, no jump on content load
- [ ] **Rich text formatting transitions** — render path in chat messages — no layout shift when formatting resolves
- [ ] **Econ countdown widget** — `frontend/components/layout/EconCountdownWidget.tsx` — state transitions: loading → data → empty
- [ ] **Econ countdown modal** — `frontend/components/feed/EconCountdownModal.tsx` — modal reveal/dismiss
- [ ] **Button hover states** — Solvys Gold accent (`#c79f4a`) on hover across all key surfaces
- [ ] **Solvys timing tokens** — verify `var(--fintheon-transition-*)` tokens used, no arbitrary `300ms` or `0.3s`
- [ ] **prefers-reduced-motion** — check `@media (prefers-reduced-motion: reduce)` paths disable animations

## Scope — Excluded (DO NOT TOUCH)

- Page-level transitions (Sanctum page snap, route changes) — separate track if needed
- Electron window animations — native OS chrome
- Mobile PWA transitions — separate/mobile track
- New animation features — audit only, do not add new animations unless broken
- Chart animation (Recharts) — handled in S50 track

## Reuse Inventory (existing code to call, not reinvent)

- Solvys transition tokens in `frontend/styles/` (timing, easing, duration vars) — reference, don't redefine
- `useReducedMotion` or equivalent hook if it exists in the codebase — check before creating new

## Solvys Feels — Aesthetic Rules

- **Timing**: Solvys tokens only — `var(--fintheon-transition-*)` — no arbitrary durations
- **Easing**: industrial-luxe = crisp ease-out, no bounce, no overshoot, no spring physics
- **Chat drawer**: 200–250ms slide, subtle backdrop blur reveal (frosted-glass)
- **Hover states**: instant color shift to Solvys Gold, no scale transform
- **Widget transitions**: minimal — opacity fade only, no layout shift
- **No**: gradients, emojis, AI sparkles, Kanban borders, bouncy springs
- **prefers-reduced-motion**: all animations disabled; instant state changes only

## Acceptance Criteria

- [ ] Chat drawer opens/closes smoothly with no flicker
- [ ] Chat message render has no layout shift
- [ ] Econ countdown widget transitions cleanly between loading/data/empty states
- [ ] Econ countdown modal reveal/dismiss is smooth
- [ ] Button hover states show Solvys Gold accent on hover
- [ ] All animations use Solvys timing tokens (not arbitrary `ms` values)
- [ ] `prefers-reduced-motion` disables all animations (instant transitions)
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `npx vite build` passes
- [ ] No console errors during interactions

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Frontend build
rm -rf dist && npx vite build

# Search for arbitrary animation durations (should return empty or only legitimate cases)
rg "transition.*[0-9]+ms|animation.*[0-9]+ms" frontend/ --type tsx --type ts
```

## Commit Format

```
[v.6.0.27-s62-t22] style: micro-interactions pass — chat drawer, rich text, econ countdown, hover states
```
