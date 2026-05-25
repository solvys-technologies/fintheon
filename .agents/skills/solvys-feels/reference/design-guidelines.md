# Solvys Design Guidelines

## Purpose

These guidelines combine the approved S47 reference set into Solvys-native design judgment. They are not a component import list. Use them to decide what to build, how it should feel, and how to review it.

## Non-Negotiables

- No gradients, decorative sparkles, emojis, Kanban side-stripe borders, generic glow, or shadow-heavy card grids.
- Use Solvys Gold `#c79f4a`, warm near-black `#050402`, and warm off-white `#f0ead6` as the default identity.
- Frosted-glass surfaces are preferred over Kanban cards when a surface needs separation: translucent warm dark fill, subtle backdrop blur, and a thin low-opacity gold border.
- Never copy an upstream gallery's exact visual language. Extract the principle and translate it into Solvys materials.
- Functional density wins over decorative novelty. Every animation, icon, chart, loader, or empty state must explain state or reduce cognitive load.

## Approved Influence Model

- Impeccable: use shape-before-build, anti-slop critique, craft/polish/audit framing, and task-specific design briefs.
- devl.dev: use as a reference scan for layout patterns before new UI work, not as a dependency.
- Jakub details: apply text-wrap balance/pretty where supported, concentric radii, tabular numbers, optical alignment, antialiasing, interruptible transitions, and contextual icon motion.
- detail.design and MV---Design: mine critique language for micro-details and anti-slop detection.
- cult-ui: treat as component composition inspiration only; reject gradients, decorative glyphs, and any visual language that fights Solvys.
- Evil Charts: use chart composition ideas: tabbed placement, legends, tooltip contracts, and chart spacing. Re-skin every chart to Solvys materials.
- dotmatrix: use compact loading-state cadence and named motion concepts. Do not import loader packages by default.

## Layout

- Start with the user's job, not a card grid. Ask what needs to be compared, edited, monitored, or decided.
- Prefer one strong primary region, one secondary support region, and one quiet metadata lane over equal-weight panels.
- Use glass panels, rulers, type scale, and spacing to separate hierarchy. Do not solve hierarchy by adding more boxes.
- Keep responsive behavior content-driven: start narrow, stretch until the layout breaks, then add a breakpoint.
- Avoid nested cards. If a section already sits on a surface, use dividers, labels, inset rows, or typography rather than another card.

## Typography And Data

- Data values use tabular numbers and consistent numeric alignment.
- Body text should stay readable at product density. Use fixed rem scales for app UI and reserve fluid type for brand/content surfaces.
- Use at most two font families per screen unless a specific ceremonial/brand surface justifies more.
- Labels should be quieter than values. Do not color labels when the value itself can carry the signal.

## Motion

- Motion must be interruptible and stateful. Closing a surface mid-transition should not leave stale classes or stuck opacity.
- Animate opacity and transform. Avoid layout-property animation unless the component is explicitly designed for resize transitions.
- Use short, precise motion for product UI. Prefer 150-220ms for controls and 220-360ms for surfaces.
- Respect `prefers-reduced-motion`.

## Charts

- Charts belong in tabbed or expandable analytical regions, not inline clutter inside every card.
- Every chart needs a clear question, unit, time range, empty state, and tooltip contract.
- Use Solvys Gold for focus, muted bullish/bearish colors for values only, and warm neutral gridlines.
- Legends should clarify, not decorate. Hide legends when labels are already obvious.

## Loading And Empty States

- Prefer compact, local loading indicators over full-page skeleton screens.
- Use dotmatrix-style cadence only where waiting is perceptible and localized.
- Empty states should state what is missing, why it matters, and the next available action.
- Error states should preserve user work and offer retry or recovery before explanation.

## Review Checklist

- Can TP identify the primary action or readout in under three seconds?
- Are surfaces separated by material, spacing, and type rather than by more boxes?
- Are numbers aligned, stable, and formatted consistently?
- Do transitions communicate state without slowing down work?
- Would the UI still feel Solvys if all upstream references were removed from the prompt?
- Did any vetoed reference influence the design? If yes, remove it.
