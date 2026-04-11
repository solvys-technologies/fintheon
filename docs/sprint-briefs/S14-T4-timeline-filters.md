# S14-T4: Timeline Filters Fix + Time Range

## Goal

Fix broken filters on Timeline (Main + popover). Add time range filter. Add box toggle above first narrative filter.

## Current State

Filters in the Timeline view do not actually filter the rendered items. No time range filtering exists. The popover timeline has the same issues.

## What to Do

1. **Fix filter state** — filters render but don't filter:
   - @frontend/components/narrative/TimelinePanel.tsx — trace filter state through to rendered items. Ensure useMemo/filter logic actually applies selected filters
   - @frontend/components/layout/TimelineOverlay.tsx — same filter fixes for the popover/browser-enabled timeline

2. **Add time range filter**:
   - Add dropdown: 1h, 4h, 1d, 1w, custom
   - Filter items by `publishedAt` relative to selected range
   - Place above or alongside existing narrative thread filters

3. **Add box toggle row**:
   - Above the first narrative filter dropdown, add a row of quick toggle boxes for enable/disable
   - Each toggle represents a filter category the user can quickly flip on/off

4. **Design**: Use `/the-feels` for all UI work

## Key Context

- @frontend/components/narrative/TimelinePanel.tsx — main timeline, 658 lines
- @frontend/components/layout/TimelineOverlay.tsx — popover timeline, 516 lines
- Timeline items come from RiskFlowContext alerts merged with narrative data
- Filters should work identically in both views

## Verify

- Open Timeline, apply a narrative thread filter — only matching items show
- Toggle time range to 1h — only last hour's items show
- Open popover timeline — same filters work identically
- Box toggles enable/disable filters smoothly
