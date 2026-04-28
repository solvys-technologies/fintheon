---
name: solvys-ui-cleanup
description: Systematic UI cleanup pass for Solvys surfaces. Use when a page works but needs state-of-the-art design polish: alignment, spacing, typography, responsive behavior, loading/empty/error states, focus/hover states, motion, chart/detail hygiene, and Solvys material consistency.
---

# Solvys UI Cleanup

Run a practical cleanup pass that catches simple, overlooked details that make software feel finished. Do not redesign the product. Improve the existing surface with small, high-leverage corrections.

## Passes

- State coverage: loading, empty, error, disabled, saved, retry.
- Interaction detail: hover, focus, selected/current, click target, repeated state grammar.
- Typography and numbers: tabular figures, numeric alignment, balanced headings, quiet labels.
- Layout and spacing: optical alignment, concentric radii, no nested cards, content-driven responsive breakpoints.
- Solvys materials: frosted-glass surfaces where useful, flat rows for density, no gradients/emojis/sparkles/Kanban/generic shadows.
- Motion: interruptible, state-clarifying, reduced-motion safe, no casual layout animation.
- Charts/loaders/data: clear question, unit, time range, tooltip, local loader, no chart clutter.

## Rules

- Smallest visible improvement set only.
- Preserve existing component patterns unless they violate Solvys doctrine.
- Do not import dependencies or copied upstream components.
- Separate backend/data needs into deferred items.

## Output

```markdown
## UI Cleanup Plan
Surface: ...

## Findings
- `path:line` -- overlooked detail, why it matters, exact cleanup

## Changes Applied
- ...

## Deferred
- ...

## Validation
- typecheck/build/browser checks
```
