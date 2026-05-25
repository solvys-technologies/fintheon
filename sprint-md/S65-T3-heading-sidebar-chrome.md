# Sprint Brief: T3 -- Header and Sidebar Chrome Polish

## Context

This track handles the visual polish in the left sidebar and heading toolbar. The user wants top sidebar icons reduced to match the smaller lower/sidebar utility icons, the nametag and billing tier merged into one pill, toolbar controls grouped into clean pills, enabled states shown by icon shimmer rather than lit backgrounds, and panel expand buttons repositioned around the history/app-title area and right-control group. This is closed-beta polish: the UI should feel intentional, not like accumulated experiments.

## Branch Target

`sprint/S65`

## Scope -- Included

- [ ] Update `frontend/components/layout/NavSidebar.tsx` so the top four icons use the same 16px icon sizing and button density as the lower sidebar controls.
- [ ] Update `frontend/components/layout/TopHeader.tsx` to merge trader nametag and billing tier into one pill with a fading vertical divider.
- [ ] Keep nametag shimmer only on the nametag side of that pill.
- [ ] Combine call, anti-lag, lockout, and time/minute input into one pill.
- [ ] Combine trading browser power, bulletin, chat interface, and mic/voice into one pill.
- [ ] Change active/enabled toolbar states so the icon itself shimmers/lights in the appropriate color; the button background should not light up.
- [ ] Move the left panel expand button to the left of the back/forward history chevrons, to the right of the app title button.
- [ ] Move the right panel expand button to the right of the newly grouped toolbar button pill, outside the pill.
- [ ] Refactor `frontend/components/layout/PanelToggleGroup.tsx` if needed to support rendering individual left/right/footer toggle buttons.

## Scope -- Excluded (DO NOT TOUCH)

- `frontend/components/layout/FooterToolbar.tsx` -> owned by T4 for terminal and footer drawer placement.
- Settings, lockout policy, and Desk Plan widget files -> owned by T1.
- Peer Chat removal -> owned by T2.
- Risk signal cards -> owned by T5.
- Do not change toolbar ordering persistence semantics unless required for the new fixed grouping.

## Reuse Inventory

- Sidebar top icon size currently `w-5 h-5` at `frontend/components/layout/NavSidebar.tsx:282`; lower icons use `w-4 h-4` around `frontend/components/layout/NavSidebar.tsx:326`, `405`, and `430`.
- `PanelToggleGroup` currently renders grouped left/footer/right controls from `frontend/components/layout/PanelToggleGroup.tsx:157`.
- TopHeader imports `PanelToggleGroup` at `frontend/components/layout/TopHeader.tsx:23`.
- TopHeader currently renders `PanelToggleGroup` before platform/VIX at `frontend/components/layout/TopHeader.tsx:635`.
- Billing tier and `TraderNametag` render near `frontend/components/layout/TopHeader.tsx:520`.
- Call widget, DND/notification, anti-lag, lockout, custom minutes, and voice widget render around `frontend/components/layout/TopHeader.tsx:540`.
- Browser platform/power/chat/bulletin/IV toolbar loop starts around `frontend/components/layout/TopHeader.tsx:632`.

## Known Issues to Preserve

- Use lucide icons where available.
- No gradients, no emojis, no Kanban borders, no AI sparkles.
- Cards should stay at 8px radius or less unless existing local style uses a smaller token.
- Text must fit at compact levels. Preserve existing `compactLevel` behavior.
- Keep app title/history navigation behavior intact.
- Do not start a Vite dev server.

## Implementation Steps

1. In `NavSidebar.tsx`, introduce shared constants/classes for collapsed nav button and icon size so top and bottom controls use the same footprint. Reduce top icons from `w-5 h-5` to `w-4 h-4` and adjust top button vertical padding from `py-2` to match lower controls unless the expanded text alignment needs a minimal compensating tweak.
2. In `PanelToggleGroup.tsx`, extract/export a small `PanelToggleButton` or add props that let `TopHeader` render left/right/footer independently. Keep the existing full group API working if other code still uses it.
3. In `TopHeader.tsx`, place the left panel toggle immediately after the app title/branding cluster and before the history chevrons. If history chevrons are currently embedded in the title area, keep their order as: app title button -> left panel toggle -> back -> forward.
4. Build a `IdentityTierPill` local helper or inline group that contains `TraderNametag` on the left, a fading vertical divider, and tier text/button on the right. The nametag side keeps shimmer; tier side does not.
5. Build a compact control pill for call, anti-lag, lockout, and the time/minute field. Keep lock/unlock behavior and current custom minute Enter/Go behavior.
6. Build a second compact control pill for browser power, bulletin, chat, and voice/mic. Keep tooltips and existing callbacks.
7. Replace active background styles such as `toolbar-active`, `!bg-...`, or active background overrides with icon-targeted classes. The active state should color/shimmer the SVG/icon only; the button shell should remain restrained.
8. Place the right panel toggle just to the right of the second control pill, outside the pill.
9. Verify the toolbar still behaves at `compactLevel` 0, 1, and 2. Hide copy before icons when space is tight.

## Acceptance Criteria

- [ ] Top sidebar icons visually match the lower sidebar icon/button size.
- [ ] Nametag and tier are one pill with a vertical fading divider; shimmer is confined to the nametag side.
- [ ] Call, anti-lag, lockout, and time/minute input are one pill.
- [ ] Browser power, bulletin, chat, and mic/voice are one pill.
- [ ] Enabled buttons shimmer/color the icon only, not the background.
- [ ] Left panel toggle sits between app title and history chevrons.
- [ ] Right panel toggle sits to the right of the grouped action pill.
- [ ] No toolbar text overlaps at compact widths.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf dist && npx vite build
```

## Commit Format

```text
[v6.1.0] style: S65-T3 polish header and sidebar chrome
```
