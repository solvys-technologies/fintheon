# Task Brief: Consilium + Toast Smooth Transitions

**Date:** 2026-04-03
**Scope:** Add polished CSS transitions to Consilium dropdowns, tab views, side panels, and toast notifications
**Estimated files:** 3

## Context

The Consilium tab system has basic opacity fades but dropdowns snap open/closed instantly. Toast notifications slide in but with linear easing. Side panels transition width but feel mechanical. The user wants everything to feel smooth and physical — spring-like easing, staggered reveals, intentional motion.

## Files to Read First

- `frontend/components/consilium/ConsiliumHub.tsx` — Tab bar, dropdowns, side panels, tab content transitions
- `frontend/components/ui/Toast.tsx` — Toast enter/exit animations
- `frontend/index.css` — Global keyframes (check for existing animation definitions)

## What to Build/Change

### 1. `frontend/components/consilium/ConsiliumHub.tsx` — Dropdown + Panel Transitions

- **Action:** Modify

#### Dropdown animations (Sanctum, Boardroom, Apparatus)

Currently dropdowns appear instantly via conditional render (`{sanctumDropdownOpen && <div>...`). Replace with CSS transition:

For each dropdown wrapper div, keep it always mounted but control visibility:

```tsx
<div
  className="absolute top-full left-0 mt-1 z-50 min-w-[220px] rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden"
  style={{
    opacity: sanctumDropdownOpen ? 1 : 0,
    transform: sanctumDropdownOpen ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.97)',
    pointerEvents: sanctumDropdownOpen ? 'auto' : 'none',
    transition: 'opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
  }}
>
```

The easing `cubic-bezier(0.16, 1, 0.3, 1)` is a spring-like overshoot curve. The dropdown scales from 97% and slides up 4px — subtle but physical.

Apply the same pattern to all 3 dropdowns (sanctum, boardroom, apparatus).

**Important:** Remove the `{...DropdownOpen && (` conditional. The div must always be in the DOM for CSS transitions to work. Use `pointerEvents: 'none'` + `opacity: 0` to hide.

#### Dropdown item stagger

Add staggered fade-in for dropdown items using `transition-delay`:

```tsx
{SANCTUM_SUB_VIEWS.map(({ id, label, subtitle, icon: Icon }, idx) => (
  <button
    key={id}
    style={{
      opacity: sanctumDropdownOpen ? 1 : 0,
      transform: sanctumDropdownOpen ? 'translateX(0)' : 'translateX(-6px)',
      transition: `opacity 200ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 40}ms, transform 200ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 40}ms`,
    }}
    // ... rest of props
  >
```

Each item slides in from left with 40ms stagger. Total stagger for 3 items = 80ms — barely perceptible but feels alive.

#### Tab content transition

The current fade (line ~490) uses `opacity 200ms ease`. Upgrade to include a subtle vertical shift:

```tsx
style={{
  opacity: transitioning ? 0 : 1,
  transform: transitioning ? 'translateY(6px)' : 'translateY(0)',
  transition: 'opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
}}
```

#### Side panels (Debate + Proposals)

Currently uses `transition-[width] duration-[240ms] ease-in-out`. Add opacity fade so content doesn't just clip:

```tsx
className={`flex-shrink-0 overflow-hidden border-l border-[var(--fintheon-accent)]/10 ${
  showDebate ? 'w-80' : 'w-0 border-l-0'
}`}
style={{
  transition: 'width 280ms cubic-bezier(0.16, 1, 0.3, 1), border-width 280ms',
}}
```

And for the inner content div:

```tsx
<div className="w-80 h-full overflow-hidden bg-[var(--fintheon-bg)]"
  style={{
    opacity: showDebate ? 1 : 0,
    transition: 'opacity 200ms ease 80ms', // 80ms delay so width opens first
  }}
>
```

### 2. `frontend/components/ui/Toast.tsx` — Spring-Feel Enter/Exit

- **Action:** Modify

Replace the current `transition-all duration-300 ease-out` with spring-like physics:

```tsx
// Replace lines 43-48 in ToastItem
<div
  style={{
    opacity: isVisible ? 1 : 0,
    transform: isVisible
      ? 'translateX(0) scale(1)'
      : `translateX(${slideX}) scale(0.95)`,
    transition: isVisible
      ? 'opacity 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)'
      : 'opacity 200ms ease-out, transform 200ms ease-out',
    pointerEvents: 'auto',
    minWidth: '280px',
    maxWidth: '380px',
  }}
>
```

Key details:

- **Enter:** `cubic-bezier(0.34, 1.56, 0.64, 1)` — slight overshoot on transform (spring feel), 400ms for the scale bounce
- **Exit:** Faster 200ms with simple ease-out — exits should feel decisive, not bouncy
- **Scale 0.95 → 1.0:** Toasts grow slightly as they enter — feels like they're arriving from behind

Remove the `className="transition-all duration-300 ease-out group"` — we're using inline style transitions now. Keep `group` class for the hover-reveal dismiss buttons.

### 3. `frontend/index.css` — Global spring easing custom property (optional)

- **Action:** Modify (add near other CSS custom properties)

```css
:root {
  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

This lets other components reuse the same easing without hardcoding the bezier values.

## Key Rules

- **The spring easing `cubic-bezier(0.16, 1, 0.3, 1)` is the backbone.** Use it for most transitions. It's fast-in, gentle-out with no overshoot — professional, not playful.
- **The bounce easing `cubic-bezier(0.34, 1.56, 0.64, 1)` is for entrances only.** Never use it for exits or user-initiated actions (feels sluggish).
- **No framer-motion dependency.** Pure CSS transitions. The 60fps budget demands it.
- **Stagger delays must be tiny (30-50ms per item).** Anything over 50ms feels laggy, not choreographed.
- **Dropdowns must always be mounted** (use opacity + pointerEvents). This is required for CSS transitions to work — conditional rendering (`{open && ...}`) cannot animate.
- Follow Solvys design: no gradients, no colored emojis, gold palette.

## DO NOT

- Add framer-motion or any animation library
- Change toast functionality (auto-dismiss timing, DND, positions)
- Modify dropdown menu items or their content
- Touch tab routing logic or state management
- Add loading skeletons or placeholder animations
- Change side panel widths or content

## Verification

```bash
cd frontend && npx tsc --noEmit && npx vite build
```

Then visually verify:

1. Click Sanctum dropdown — items stagger in from left, container scales up smoothly
2. Switch tabs — content fades down on exit, fades up on enter
3. Toggle Proposals panel — width slides open, content fades in with slight delay
4. Trigger a toast (paste an image in Forum) — toast enters with spring bounce, exits cleanly
5. All transitions at 60fps (no jank in Chrome DevTools Performance tab)

## Changelog Entry

```typescript
{
  date: '2026-04-03T00:00:00',
  agent: 'claude-code',
  summary: 'Add spring-physics CSS transitions to Consilium dropdowns (stagger), tab content (vertical shift), side panels (width+opacity), and toast notifications (scale+bounce enter)',
  files: [
    'frontend/components/consilium/ConsiliumHub.tsx',
    'frontend/components/ui/Toast.tsx',
    'frontend/index.css'
  ]
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
