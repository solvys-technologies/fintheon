# Sprint Brief: T3 — Pill Bar UI + Toolbar Overhaul + Drag-and-Drop + Detail Polish

## Context

The heading toolbar needs production-level polish: nametag and VIX ticker must match the IV scoring widget height, all pill bar buttons need their borders replaced with subtle vertical fading rulers (same for the icon group on the left), every toolbar item must be draggable and reorderable with @dnd-kit previews, and a collection of detail-level sizing fixes need to be applied across the app.

/solvys-feels material rules: Solvys Gold (#c79f4a), warm near-black (#050402), frosted-glass surfaces where grouping matters, no gradients, no emojis, no Kanban borders, no AI sparkles. /solvys-ui-detail hierarchy: values quiter than labels, edges align optically, transitions are interruptible, radii are concentric.

## Branch Target

`sprint/S66`

## Scope — Included

### Height Sizing
- [ ] `frontend/components/IVScoreCard.tsx:231-256` — The IVScoreCard has class `h-8` (line 253). This is the reference height (32px). All toolbar items in the pill bars must match this.
- [ ] `frontend/components/TraderNametag.tsx:27-31` — The `embedded` variant uses `h-full` (inherits from parent), `standalone` uses `h-7` (28px). Change `standalone` from `h-7` to `h-8` to match IVScoreCard.
- [ ] `frontend/components/TraderNametag.tsx:528` — The nametag container in TopHeader wraps TraderNametag in `<div className="... h-7 ...">`. Change to `h-8`.
- [ ] `frontend/components/layout/TopHeader.tsx:797` — The VIX ticker div has class `h-7` (line 797: `h-7 flex items-center`). Change to `h-8`.
- [ ] `frontend/components/layout/TopHeader.tsx:78-79` — The TOOLBAR_PILL_CLASS const is `h-8`. This is already correct as reference.
- [ ] `frontend/components/layout/TopHeader.tsx:553` and `:846` — Both pill bar wrappers use `TOOLBAR_PILL_CLASS` which is `h-8`. Verify all pill bar items are vertically centered in their containers.

### Pill Bar Borders → Vertical Fading Rulers
- [ ] `frontend/components/layout/TopHeader.tsx:78-79` — Remove `border` from `TOOLBAR_PILL_CLASS`. Current: `"flex items-center gap-0.5 h-8 rounded-md border border-[rgba(199,159,74,0.12)] bg-[rgba(5,4,2,0.55)] px-1"`. New: `"flex items-center gap-0.5 h-8 rounded-md bg-[rgba(5,4,2,0.55)] px-1"` (no border). Add `<FadingRuler orientation="vertical" />` between each button inside the pill bar. Remove any inline border styles that were previously between buttons.
- [ ] `frontend/components/layout/TopHeader.tsx:553-646` — The left-side pill bar (FluxerCall, DND, QuickClock, Lock, custom time). Between each button, insert `<FadingRuler orientation="vertical" className="mx-0.5" />` instead of the current separator.
- [ ] `frontend/components/layout/TopHeader.tsx:846-897` — The right-side pill bar (Power, Bulletin, Chat, Voice). Same treatment: remove borders, add vertical FadingRulers between buttons.
- [ ] `frontend/components/layout/NavSidebar.tsx:257-316` — The icon group sidebar items (line 270: `gap-1 rounded-md`). Remove the border from the active/inactive states (`fintheon-nav-active`, `fintheon-nav-inactive`). Add a subtle vertical `FadingRuler` between each icon item when the sidebar is expanded.
- [ ] `frontend/components/layout/NavSidebar.tsx:257` — The `space-y-1 px-1.5` section. Remove any border-related classes from `SIDEBAR_BUTTON_CLASS`. Add vertical FadingRuler between items: insert `<FadingRuler className="mx-1.5" />` between each button in the expanded state.
- [ ] `frontend/styles/fading-ruler.css:23-37` — `.fading-ruler--vertical` already supports vertical orientation. Verify it renders correctly inside pill bars (1px wide, full parent height).
- [ ] `frontend/components/shared/FadingRuler.tsx:12-28` — Verify FadingRuler accepts `className` for styling overrides. Add `orientation="vertical"` to the existing `<span>` with class `fading-ruler--vertical`.

### Toolbar Hover Fix + Pointer Cursor
- [ ] `frontend/index.css:753-776` — `.toolbar-icon-btn` and `.toolbar-icon-btn:hover` styles. Remove any `backdrop-filter`, `filter: blur()`, or similar blur effects from the hover state. The hover state should only change border opacity and text color, NOT add blur.
- [ ] `frontend/index.css:753` — Add `cursor: pointer` to `.toolbar-icon-btn`.
- [ ] `frontend/index.css:768-772` — `.toolbar-icon-btn:hover` — Keep `border-color: rgba(199,159,74,0.2)`, `color: rgba(240,234,214,0.72)`, and the scale transform. Remove any backdrop-filter or blur declarations. If none exist, verify adjacent styles aren't causing visual blur at runtime.

### Remove Footer Button from Heading Toolbar
- [ ] `frontend/components/layout/TopHeader.tsx` — Identify the footer panel toggle button. At line 657: `shouldShowFooterPanelToggle && <PanelToggleButton side="footer" label="footer panel" />`. Remove this button from the heading toolbar entirely. The footer toggle should only live in the footer toolbar (FooterToolbar.tsx).

### Drag-and-Drop with @dnd-kit
- [ ] `frontend/package.json` — Install dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Run `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` (or `bun add` equivalent).
- [ ] `frontend/components/layout/TopHeader.tsx` — **Full toolbar drag-and-drop**: All toolbar items (including pill bar groups and standalone items) must be wrapped in a single `DndContext` + `SortableContext`. Each item becomes a `SortableItem` with a `DragHandle` (GripVertical icon). Dragging an item to an empty spot in the toolbar rearranges the order. Items can be dragged between pill bar groups.
- [ ] `frontend/components/layout/TopHeader.tsx` — **Pill bar group movement**: The entire pill bar groups (TOOLBAR_PILL_CLASS wrappers) themselves should be draggable as units. Use `useSortable` on the pill bar containers. The sortable context includes both individual items AND pill-bar groups.
- [ ] `frontend/components/layout/TopHeader.tsx` — **Pill bar icon swapping**: Icons inside pill bars can be dragged between different pill bars. When an icon crosses a pill bar boundary, the placeholder appears in the target pill bar.
- [ ] `/solvys-feels` preview during drag: Use `DragOverlay` from @dnd-kit to show a translucent frosted-glass preview of the dragged item. The preview should use `backdrop-blur-sm bg-[rgba(5,4,2,0.7)] border border-[var(--fintheon-accent)]/30 rounded-md`. No bounce, no sparkle.
- [ ] **Toolbar edit mode**: Add a small "Edit" toggle in the toolbar (next to existing toolbar items) that enables drag-and-drop reordering. When edit mode is active, grip icons appear on all draggable items. When inactive, the toolbar looks as it did before (no grips visible). This mirrors the NavSidebar edit mode pattern at `NavSidebar.tsx:304-313`.
- [ ] **Persist toolbar layout**: On drop, save the new toolbar order to localStorage using existing `setToolbarOrder()` at `frontend/lib/layoutOrderStorage.ts`. The order includes which items are in which pill bar groups.
- [ ] **Intelligent mechanics**: Items snap to grid-aligned positions within the toolbar. When a pill bar is dragged, it snaps to valid drop zones between other items. When an icon is dragged between pill bars, the target pill bar visually highlights (border glow, Solvys Gold accent, 150ms transition).
- [ ] `frontend/lib/layoutOrderStorage.ts` — Update `ToolbarItemId` type and `getToolbarOrder`/`setToolbarOrder` to support the extended item set including pill bar group positions.

### Detail Sizing & Polish
- [ ] `frontend/components/chat/ProviderDropdown.tsx:57-63` — The ProviderDropdown trigger button. Match its height to PersonaDropdown trigger (which uses `px-2 py-1 rounded-lg` ≈ 28px). Change ProviderDropdown trigger to match: add `h-[28px]` or equivalent `py-1` class.
- [ ] `frontend/components/chat/PersonaDropdown.tsx:57-63` — The PersonaDropdown trigger uses `px-2 py-1 rounded-lg` which is ~28px. Verify it's exactly 28px in the rendered DOM. If different from ProviderDropdown, adjust to match.
- [ ] `frontend/components/arbitrum/ArbitrumChamber.tsx` — **"Next run" timer**: Search for any countdown/timer text in the Arbitrum header. This is likely the `phase` badge text at line 273-276 (`text-[9px] uppercase tracking-wider` showing phase). Remove any border wrapping around the timer/countdown text. Increase text size by 15% (from `text-[9px]` to `text-[10px]` or from `text-[10px]` to `text-[11.5px]`).
- [ ] `frontend/components/arbitrum/ArbitrumSettingsPanel.tsx` — Check health panel for any "next run" countdown display. If present (likely showing chamber run timing), remove border, increase text 15%.
- [ ] `frontend/components/consilium/ConsiliumHub.tsx:599-600` — The subheading toolbar container: `className="flex items-center gap-0.5 px-4 pt-3 pb-1"`. Increase bottom padding: change `pb-1` to `pb-1.5` (this adds ~2px to bottom, roughly 10% increase of the overall subheading bar height).
- [ ] **Desk Plan lock button shimmer**: In `DayCard.tsx`, the lock button added by T1 has CSS class `desk-plan-lock-btn`. Add the following CSS in `frontend/index.css` or inline:
  ```css
  .desk-plan-lock-btn {
    position: relative;
    overflow: hidden;
  }
  .desk-plan-lock-btn::after {
    content: '';
    position: absolute;
    top: 0; left: -100%; width: 100%; height: 100%;
    background: linear-gradient(
      90deg, transparent 0%, rgba(199,159,74,0.25) 50%, transparent 100%
    );
    animation: lock-shimmer 0.6s ease-in-out forwards;
  }
  @keyframes lock-shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }
  ```
  On lock toggle, trigger the shimmer animation. The word "LOCK"/"UNLOCK" fades out during shimmer, lock icon moves to center, then everything returns to original position with the word fading back in. Use a 300-400ms transition for the reset.
- [ ] **Desk Plan lock button animation state machine**: When lock is clicked: (1) word fades out (opacity 0, 150ms), (2) icon slides to center (transform, 200ms), (3) shimmer sweep passes through (600ms, the ::after animation), (4) icon returns to original position (200ms), (5) word fades back in as "LOCK" or "UNLOCK" (150ms). Total: ~1.3s. Use CSS transitions + a setTimeout chain in the onClick handler.

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/narrative/DayCard.tsx` — T1 owns data/cycling/pricing. T3 only adds CSS class and triggers shimmer on the class hook T1 provides. Do NOT modify DayCard's JSX structure or data logic.
- `backend-hono/` — No backend changes
- `mobile/` — No mobile changes in T3
- `electron/` — No Electron changes
- `frontend/components/chat/parts/ToolCallPart.tsx` — T4 owns
- `frontend/components/chat/FintheonThinkingIndicator.tsx` — T4 owns
- `frontend/components/chat/primitive/BrailleSpinner.tsx` — T4 owns
- `src/lib/changelog.ts` — T5 owns
- `frontend/contexts/SettingsContext.tsx` — T1 and T2 own additions

## Reuse Inventory

- `FadingRuler` at `frontend/components/shared/FadingRuler.tsx` — Already supports vertical orientation. T3 uses extensively between pill bar buttons.
- `useDraggable` at `frontend/hooks/useDraggable.ts` — Existing pointer-event drag. T3 REPLACES with @dnd-kit for toolbar, but preserves useDraggable for DraggablePanel (which is a different use case).
- `getToolbarOrder` / `setToolbarOrder` at `frontend/lib/layoutOrderStorage.ts` — Existing toolbar ordering. T3 extends with pill bar group positions.
- `SIDEBAR_BUTTON_CLASS` at `frontend/components/layout/NavSidebar.tsx:96-98` — Used for sidebar icon button styling.
- `TOOLBAR_PILL_CLASS` at `frontend/components/layout/TopHeader.tsx:78-79` — Pill bar container class. T3 removes border.
- `PanelToggleButton` at `frontend/components/layout/PanelToggleGroup.tsx` — Panel toggle component. T3 removes the footer variant from TopHeader.

## Known Issues to Preserve

- S65 T3 (Header and Sidebar Chrome Polish) just completed icon sizing adjustments in NavSidebar. Preserve the S65 sizing decisions (icon 16px, button 32px px-2 py-1.5).
- The `toolbar-icon-shimmer` keyframes at `frontend/index.css:783-793` is an existing subtle glow animation for active toolbar icons. Do NOT rename or remove — it's intentional.
- The NavSidebar edit mode (lines 304-313) uses a drag-and-drop implementation with HTML5 `onDragStart`/`onDrop`. T3 does NOT replace sidebar drag — it only adds vertical FadingRulers between sidebar items.
- The toolbar already has edit mode via `toolbarEditMode` prop (TopHeader line 129). T3 replaces the HTML5 drag with @dnd-kit but keeps the edit mode toggle behavior.

## Implementation Steps

1. **Install @dnd-kit**: `cd frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
2. **Height sizing**: Change IVScoreCard reference, nametag `h-7→h-8`, VIX ticker `h-7→h-8`, nametag wrapper `h-7→h-8` in TopHeader line 528.
3. **Pill bar borders → rulers**: Remove `border` from TOOLBAR_PILL_CLASS. Update both pill bar sections in TopHeader to use `<FadingRuler orientation="vertical" className="mx-0.5" />` between buttons. Remove existing inline separator spans (the gradient line at TopHeader:537-539).
4. **NavSidebar borders → rulers**: Remove border classes from sidebar buttons. Add vertical FadingRuler between items in expanded state.
5. **Toolbar hover fix**: Remove blur/backdrop-filter from `.toolbar-icon-btn:hover`. Add `cursor: pointer`.
6. **Remove footer button**: Delete the `shouldShowFooterPanelToggle` block from TopHeader (lines 657-659).
7. **ProviderDropdown height**: Set to match PersonaDropdown (~28px).
8. **Arbitrum timer**: Remove border from phase badge / next-run text. Increase text size 15%.
9. **Consilium subheading**: Change `pb-1` to `pb-1.5` in ConsiliumHub line 600.
10. **@dnd-kit integration**: Wrap toolbar in DndContext + SortableContext. Create SortableItem wrapper for each toolbar item and pill bar group. Add DragOverlay for preview. Handle cross-pill-bar icon movement.
11. **Edit mode toggle**: Add "Edit" button in toolbar that enables/disables drag handles.
12. **Persist layout**: On dragEnd, save new order via setToolbarOrder (extended to include group positions).
13. **Desk Plan lock button**: Add CSS + animation logic for the `desk-plan-lock-btn` class. Wire to lock toggle event.
14. **Build + validate**.

## Acceptance Criteria

- [ ] Nametag, VIX ticker, IVScoreCard, and pill bars all have same height (32px / h-8)
- [ ] Pill bar buttons have no borders, separated by subtle vertical FadingRulers
- [ ] NavSidebar icons have vertical FadingRulers between them in expanded state
- [ ] Toolbar hover has no blur effect, cursor shows pointer
- [ ] Footer button is removed from heading toolbar
- [ ] All toolbar items are draggable with @dnd-kit sortable previews
- [ ] Pill bar groups can be rearranged
- [ ] Icons can be swapped between pill bars
- [ ] Drag preview uses frosted-glass Solvys Gold border (no sparkle, no bounce)
- [ ] Toolbar layout persists across sessions
- [ ] ProviderDropdown and PersonaDropdown have matching heights
- [ ] Arbitrum "next run" timer has no border, text is 15% larger
- [ ] Consilium subheading bottom padding increased by ~10%
- [ ] Desk Plan lock button has one-time shimmer on toggle, word fades out/in
- [ ] `npx tsc --noEmit` passes on frontend
- [ ] `rm -rf dist && npx vite build` passes

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

```bash
# Check @dnd-kit installed
ls node_modules/@dnd-kit/core/package.json
```

## Commit Format

```
[v6.2.0] feat: T3 pill bar UI + toolbar drag-and-drop + detail polish
```
