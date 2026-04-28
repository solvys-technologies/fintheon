---
name: solvys-ui-cleanup
description: Systematic UI cleanup pass for Solvys surfaces. Use when a page works but needs state-of-the-art design polish: alignment, spacing, typography, responsive behavior, loading/empty/error states, focus/hover states, motion, chart/detail hygiene, and Solvys material consistency.
---

# Solvys UI Cleanup

You are a senior product design engineer. Your job is to run a practical cleanup pass that catches simple, overlooked details that make software feel finished. Do not redesign the product. Improve the existing surface with small, high-leverage corrections.

## Source Discipline

Load `/solvys-feels` and `.claude/skills/solvys-feels/reference/design-guidelines.md` before proposing changes. External references are thinking inputs only. Do not add dependencies, copy component code, import assets, or use TP-vetoed references.

TP-vetoed references: `Xquik-dev/x-twitter-scraper`, `EveryInc/compound-engineering-plugin`, `jamiepine/voicebox`, `elder-plinius/CL4R1T4S`, `Bitterbot-AI/bitterbot-desktop`.

## Cleanup Passes

### 1. State Coverage

Verify every interactive or data-driven region has the quiet basics:

- Loading state that is local, compact, and not a full-page skeleton by default.
- Empty state that says what is missing, why it matters, and what can be done next.
- Error state that preserves user work and offers retry/recovery.
- Disabled state with a visible reason when the reason is not obvious.
- Success/saved state that does not require a toast when inline status is enough.

### 2. Interaction Detail

- Hover states should confirm affordance without glow or visual shouting.
- Focus states must be keyboard-visible and Solvys-native.
- Selected/current states must differ from hover states.
- Click targets should be comfortably sized without making dense tools bloated.
- Repeated controls should use the same state grammar.

### 3. Typography And Numbers

- Use tabular numbers for prices, scores, counts, dates, and metrics.
- Align numeric columns by decimal or right edge where comparison matters.
- Apply `text-wrap: balance` or `pretty` where supported for headings and short summaries.
- Keep labels quieter than values.
- Remove repeated copy that restates the heading.

### 4. Layout And Spacing

- Check optical alignment, not just CSS alignment.
- Use one dominant focal area, one support area, and one quiet metadata lane when possible.
- Replace nested cards with dividers, rows, labels, or spacing.
- Keep radii concentric: inner radius should account for inset distance.
- Test narrow, medium, and desktop widths. Add breakpoints where content breaks, not by device guess.

### 5. Solvys Materials

- Prefer frosted-glass surfaces for meaningful panels, sheets, drawers, and grouped surfaces.
- Keep glass subtle: warm dark fill, restrained blur, low-opacity Solvys Gold border.
- Use flat rows for dense lists and tables.
- No gradients, emojis, AI sparkles, Kanban side-stripe borders, generic shadows, or copied upstream visual language.

### 6. Motion And Timing

- Motion should clarify state changes: opening, closing, expanding, swapping, counting.
- Transitions must be interruptible.
- Use short timings for controls and moderate timings for panels.
- Respect `prefers-reduced-motion`.
- Do not animate layout properties casually.

### 7. Charts, Loaders, And Dense Data

- Charts need a question, unit, time range, empty state, and tooltip contract.
- Legends should clarify, not decorate.
- Loaders should be local and proportional to the wait.
- Avoid putting a chart in every card. Prefer tabbed or expandable analytical regions.

## Implementation Rules

- Make the smallest set of changes that visibly improves the surface.
- Preserve existing component patterns unless they violate Solvys doctrine.
- Do not rename major components or restructure routing during cleanup.
- If a cleanup item needs backend/data changes, list it separately instead of sneaking it into UI polish.
- After editing UI, run frontend typecheck and clean build unless TP explicitly limits scope.

## Output Format

```markdown
## UI Cleanup Plan

Surface: ...
Goal: polish existing UI, no redesign

## Findings
- `path:line` -- overlooked detail, why it matters, exact cleanup

## Changes Applied
- ...

## Deferred
- ...

## Validation
- `npx tsc --noEmit --project frontend/tsconfig.json`
- `rm -rf dist && npx vite build`
- Browser/mobile check: ...
```
