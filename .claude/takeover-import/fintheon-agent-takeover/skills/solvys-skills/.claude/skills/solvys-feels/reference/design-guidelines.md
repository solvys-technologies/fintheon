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

## Review Checklist

- Can TP identify the primary action or readout in under three seconds?
- Are surfaces separated by material, spacing, and type rather than by more boxes?
- Are numbers aligned, stable, and formatted consistently?
- Do transitions communicate state without slowing down work?
- Would the UI still feel Solvys if all upstream references were removed from the prompt?
- Did any vetoed reference influence the design? If yes, remove it.
