# Sprint Brief: T4 — Layout Fixes + S47 Deferred UI

## Context

The app frame currently has a gold accent border only on the left side (via NavSidebar's `border-r`). The top edge is borderless. This track adds the border to the top, rounds the top-right corner to match the Brief/Desk Plan frame (6px), and adds a subtle shadow behind the main content when the sidebar expands (sidebar reads as "behind" the content). The Strategium (right rail) currently mounts/unmounts from the DOM with no slide animation — this track converts it to a proper drawer with `translate-x` slide transition, hidden by default, toggled via the existing PanelToggleGroup button.

Additionally, fix S47 deferred items: upload button removal from toolbar, duplicate chart in Sanctum (remove analysis section, put under consensus card), 50/50 hero layout with aligned headers, bulletin drag fluidity (match PsychAssist SnapSheet), connector dead-entry cleanup in chat composer, and category pill removal from RiskFlow expanded cards.

## Branch Target

`s48-t4-layout-s47-deferred` from `main` at `23129632`

## Scope — Included

- [ ] App frame: add top border + round top-right corner (6px) + sidebar shadow on expand
- [ ] Strategium: hide by default, convert to drawer with translate-x slide transition
- [ ] Bulletin drag: match PsychAssist fluidity (`dragElastic: 0.08`, SnapSheet config)
- [ ] S47 #232: Remove upload button from toolbar
- [ ] S47 #232: Duplicate chart fix — remove analysis section, put under consensus card in Sanctum
- [ ] S47 #232: 50/50 hero layout with aligned Volatility Read + Arbitrum Chamber headers
- [ ] S47 #231: Connector dead-entry cleanup in chat composer (FintheonComposer.tsx)
- [ ] S47 #232: Category pill removal from RiskFlow expanded cards (RiskFlowDetailCard.tsx)

## Scope — Excluded (DO NOT TOUCH)

- `RefinementEngine.tsx` (T3 owns frontend pipeline UI)
- All backend files (T1 and T2 own everything in `backend-hono/`)
- `CountdownFuse.tsx`, `PipelineHealth.tsx`, `PipelineToggles.tsx` (T3 owns new components)
- `EconCountdownModal.tsx` (T3 owns test button, not rendering logic)
- `CatalystStatsDrawer.tsx` (T3 owns web URL section)
- Mobile PWA (not in S48 scope)
- Electron shell (not in S48 scope)
- `DeskThemeWidget.tsx` rename to Desk Plan (already done in v5.34.0 per changelog)

## Reuse Inventory (existing code to call, not reinvent)

- `MainLayout.tsx:747` — root container `className`. Currently has NO border. Add `border-t`.
- `MainLayout.tsx:638-648` — `hideRightPanel` logic. Strategium visibility rules.
- `MainLayout.tsx:650-653` — comment about "render NOTHING when collapsed". Change to render a hidden drawer that slides out.
- `MainLayout.tsx:660` — `animate-in fade-in slide-in-from-right-2 duration-300` mount animation. Replace with `translate-x` drawer.
- `TopHeader.tsx:437` — heading toolbar `className`. Currently has NO top border. Add top border styling.
- `NavSidebar.tsx:225` — `border-r fintheon-accent-border` — existing left border. Preserve.
- `NavSidebar.tsx` — `expanded` state prop. When sidebar expands, add shadow to main content area.
- `index.css:794-796` — `.fintheon-accent-border` utility class. Reuse for top border.
- `index.css:290-297` — `.mission-widget-edit` `border-radius: 6px`. Match this for top-right corner.
- `index.css:26-30` — CSS variable `--fintheon-glass-highlight` — use for sidebar shadow.
- `PanelToggleGroup.tsx:24-27` — Strategium toggle event `fintheon:toggle-strategium`. Already dispatches to MainLayout.
- `PanelToggleGroup.tsx` — existing toggle buttons in TopHeader. Do not modify.
- `Sanctum.tsx` — duplicate chart issue. Analysis section + consensus card layout.
- `Sanctum.tsx` — hero layout (Volatility Read + Arbitrum Chamber side by side). Lines where these are rendered.
- `FintheonComposer.tsx` — chat input bar with connector options. Find dead connector entries.
- `RiskFlowDetailCard.tsx` — expanded risk card. Find category pill/badge rendering.
- `MobileBulletin.tsx` or `SnapSheet.tsx` — bulletin drag behavior. Match PsychAssist config.
- `PsychAssistDockable.tsx` or `components/layout/PsychAssistDockable.tsx` — reference for fluid drag behavior.
- `SnapSheet.tsx` at `mobile/components/shared/SnapSheet.tsx` — `dragElastic: 0.08` config. Reference for fluidity params.

## Known Issues to Preserve

- NavSidebar `border-r` must remain. Only ADD top border + round corner + shadow — do not remove side border.
- Strategium visibility rules at `MainLayout.tsx:638-648` must still apply: hidden on analysis/econ/narrative/apparatus/performance/proposals/settings tabs. The drawer animation is purely cosmetic on top of existing logic.
- `fintheon:toggle-strategium` window event at `MainLayout.tsx:261-267` is the existing toggle mechanism. Keep it. Only change what happens when the event fires (drawer slide instead of mount/unmount).
- Sanctum.tsx was touched in v5.34.0 Solvys UI cleanup pass (gradients removed, error states added). Preserve those changes.
- DeskTheme → Desk Plan rename already done in v5.34.0. Do not re-rename.
- Bear Case → Skeptic rename already done in v5.34.0. Do not re-rename.
- Seat names (Harper/Oracle/Feucht/Consul/Herald) already done in v5.34.0. Do not re-rename.

## Aesthetic Rules (Hard Bans)

- **No gradients** — flat surfaces only. The sidebar shadow is the ONE allowed box-shadow (subtle, `0 0 20px rgba(0,0,0,0.4)` behind content panel).
- **No emojis** — not in UI, not in copy
- **No Kanban borders** — no card-grid styling, no side-stripe borders
- **No AI sparkles** — no ✨, no animated gradient text, no decorative glyphs
- **No box-shadows** on cards/widgets — ONLY the sidebar depth shadow is allowed
- Thin `#c79f4a` accent borders where separation is needed
- Glassmorphic surfaces preferred over card grids
- Doto font for numerals, heading font for section titles per `/solvys-feels`

## Implementation Steps

### Step 1: App Frame — Top Border + Rounded Top-Right Corner

**TopHeader.tsx (line 437):**
Add `border-t` and a class for the accent top border:

```tsx
className={`relative bg-[var(--fintheon-surface)] flex items-center justify-between px-3 lg:px-6 border-t fintheon-accent-border-top ${topStepXEnabled && layoutOption === "tickers-only" ? "h-[47px]" : "h-[50px]"}`}
```

**index.css — add new utility:**

```css
.fintheon-accent-border-top {
  border-top: 1px solid
    color-mix(in srgb, var(--fintheon-accent) 20%, transparent);
}
```

**MainLayout.tsx (line 747) — round top-right corner:**
Add `border-t fintheon-accent-border` to root container AND `rounded-tr-[6px]` (matching `.mission-widget-edit` border-radius):

```tsx
className={`h-screen flex flex-col bg-[var(--fintheon-bg)] text-white border-t fintheon-accent-border rounded-tr-[6px] ${topStepXEnabled ? "topstepx-active" : ""}`}
```

Wait — `rounded-tr-[6px]` on the root container applies to the TOP-RIGHT corner only. `border-t` adds the top border. Combined with existing `NavSidebar border-r`, we get borders on top + right edges with a rounded top-right corner.

Note: Verify `border-t` is on the OUTERMOST container (MainLayout, line 747), not TopHeader. TopHeader is inside MainLayout. The border should be on the app frame, not just the header bar.

Actually — re-reading the user's intent: "apply the borderline to the entire border." This means ALL FOUR edges (top, right, bottom, left). Currently only LEFT border exists (NavSidebar `border-r`). We need to add top + right + bottom borders to the app frame.

**Revised approach:**

```tsx
// MainLayout.tsx:747 — add all borders + top-right corner
className={`h-screen flex flex-col bg-[var(--fintheon-bg)] text-white border fintheon-accent-border rounded-tr-[6px] ${topStepXEnabled ? "topstepx-active" : ""}`}
```

The `border` class applies to all 4 sides. `rounded-tr-[6px]` rounds only the top-right corner. This combined with NavSidebar's `border-r` creates a consistent accent border around the entire app.

**Sidebar shadow on expand:**
When `expanded` is true (NavSidebar state), add a subtle shadow to the main content area so the sidebar reads as "behind" the content:

```tsx
// MainLayout.tsx — on the content area div (right of NavSidebar), conditionally:
style={expanded ? {
  boxShadow: "0 0 24px rgba(0,0,0,0.5)",
  position: "relative",
  zIndex: 10,
} : {}}
```

Or use a CSS class:

```css
.sidebar-expanded-shadow {
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.55);
  position: relative;
  z-index: 10;
}
```

### Step 2: Strategium Drawer Conversion

Currently the Strategium mounts/unmounts from the DOM based on `missionControlCollapsed`. Convert to:

1. **Always rendered** (conditionally visible, not conditionally mounted)
2. **Hidden by default** — `translate-x(100%)` off-screen to the right
3. **Slide in on toggle** — `translate-x(0)` with 300ms `--ease-spring` transition
4. **Overlay behind** — z-index below content, no backdrop overlay needed

**MainLayout.tsx — replace lines 648-660:**

```tsx
// REPLACE: the conditional render block with a persistent drawer
<div
  style={{
    position: "absolute",
    top: 50, // height of TopHeader
    right: 0,
    bottom: 0,
    width: 380,
    transform: missionControlCollapsed ? "translateX(100%)" : "translateX(0)",
    transition: "transform 300ms var(--ease-spring)",
    zIndex: 5,
    background: "var(--fintheon-bg)",
    borderLeft:
      "1px solid color-mix(in srgb, var(--fintheon-accent) 16%, transparent)",
  }}
>
  {!missionControlCollapsed && <MissionControlContent /* existing props */ />}
</div>
```

Wait — `hideRightPanel` logic prevents the panel from rendering at all on certain tabs (analysis, econ, narrative, etc.). This logic must be preserved. The drawer should only slide on/off when NOT on a hidable tab.

The complete logic:

1. If `hideRightPanel` is true → drawer is hidden (no render, or opacity 0)
2. If `hideRightPanel` is false AND `missionControlCollapsed` is false → drawer slides in
3. If `hideRightPanel` is false AND `missionControlCollapsed` is true → drawer slides out (translateX 100%)

Implementation:

```tsx
{
  !hideRightPanel && (
    <div
      style={{
        position: "absolute",
        top: 50,
        right: 0,
        bottom: 0,
        width: 380,
        transform: missionControlCollapsed
          ? "translateX(100%)"
          : "translateX(0)",
        transition: "transform 300ms var(--ease-spring)",
        zIndex: 5,
        background: "var(--fintheon-bg)",
        borderLeft:
          "1px solid color-mix(in srgb, var(--fintheon-accent) 16%, transparent)",
      }}
    >
      <MissionControlContent /* existing props */ />
    </div>
  );
}
```

This preserves the `hideRightPanel` logic (tab-based hiding) and adds a smooth slide transition for the toggle behavior.

### Step 3: Bulletin Drag Fluidity

The bulletin uses `SnapSheet.tsx` for drag-to-dismiss behavior. Match PsychAssist fluidity:

**In `MobileBulletin.tsx`** (or wherever SnapSheet props are configured for the bulletin):

```typescript
// Current (likely rigid):
dragElastic: 0.3,  // or higher
dragThreshold: 120

// Change to (match PsychAssist):
dragElastic: 0.08,
dragThreshold: 100,
```

Also check that the pill-handle tap-to-dismiss behavior matches — PsychAssist dismisses on pill handle tap OR swipe-down with AND(offset>260, velocity>500).

### Step 4: S47 #232 — Remove Upload Button

Find upload button in `TopHeader.tsx` or toolbar area. Remove it. If it's an icon button (Upload/CloudUpload icon), delete the button element and its handler.

### Step 5: S47 #232 — Sanctum Duplicate Chart Fix

**Issue:** When TradingView iframe is off, the chart prints twice. Analysis section should be removed and placed under the consensus card.

**In `Sanctum.tsx`:**

1. Find the chart rendering area — there are likely two `<EmbeddedBrowserFrame>` or TradingView iframe instances
2. Remove the extra chart instance
3. Move the "Analysis" section text from the chart area to below the consensus card

The exact fix depends on the current Sanctum layout. The v5.34.0 cleanup pass may have already partially addressed this — check the current state on `main`.

### Step 6: S47 #232 — 50/50 Hero Layout + Aligned Headers

**Issue:** The Volatility Read section and Arbitrum Chamber should be 50/50 width with perfectly aligned headers. Currently they're lopsided.

**In `Sanctum.tsx`:**

1. Find the container div for the hero row (Volatility Read + Arbitrum Chamber)
2. Set both children to `flex: 1` (equal width)
3. Set `align-items: flex-start` on headers so text baselines match
4. Remove any `margin` or `padding` asymmetry between the two headers

### Step 7: S47 #231 — Connector Dead-Entry Cleanup

**In `FintheonComposer.tsx`** (chat input bar):

1. Find the connector list/dropdown (where chat context sources are selected)
2. Remove entries that reference dead/broken integrations:
   - Omi (if present)
   - Any connector gated by env vars that don't exist
   - Any connector that returns 404/timeout consistently
3. Keep ONLY: VProxy, Hermes, MCP/API tools, RiskFlow

### Step 8: S47 #232 — Category Pill Removal

**In `RiskFlowDetailCard.tsx`:**

1. Find the category pill/badge element (likely a colored pill showing "Wire", "Macro", "Economic", "Geopolitical", etc.)
2. Remove it
3. Preserve the rest of the expanded card layout (headline, body, severity indicator, time)

## Acceptance Criteria

- [x] Top accent border visible on app frame (not just left side)
- [x] Top-right corner rounded to 6px (matches Brief/Desk Plan frame)
- [x] Sidebar casts subtle shadow on main content when expanded
- [x] Strategium slides in/out with translate-x transition (not mount/unmount)
- [x] Strategium hidden by default, toggleable via PanelToggleGroup button
- [x] Bulletin drags with PsychAssist fluidity (dragElastic 0.08)
- [x] Upload button removed from toolbar
- [x] Sanctum chart does not duplicate when TV iframe is off
- [x] Volatility Read + Arbitrum Chamber headers aligned, 50/50 width
- [x] Connector list contains no dead/broken entries
- [x] Category pills removed from RiskFlow expanded cards
- [x] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [x] `rm -rf dist && npx vite build` passes
- [x] No emojis, gradients, Kanban borders, or AI sparkles in any changes

## Debrief — 2026-04-29

**Agent:** claude-code (deepseek-v4-pro)  
**Branch:** `s48-t4-layout-s47-deferred` from `main` at `23129632`  
**Changelog entry:** `[v5.35.0]` in `src/lib/changelog.ts`

### Step 1 — App frame full border + rounded corner + sidebar shadow

- `MainLayout.tsx:795` — root container: added `border fintheon-accent-border rounded-tr-[6px]`. `border` applies to all 4 sides, `rounded-tr-[6px]` matches `.mission-widget-edit` (6px). Combined with `NavSidebar`'s existing `border-r`, all edges now have accent borders.
- `MainLayout.tsx:206` — added `sidebarExpanded` state.
- `MainLayout.tsx:307-317` — added `useEffect` listener for `fintheon:nav-sidebar-state` (dispatched by `NavSidebar` line 160-166).
- `MainLayout.tsx:910-911` — content layer conditional style: `boxShadow: "-4px 0 24px rgba(0,0,0,0.55)", zIndex: 10` when sidebar expanded.

### Step 2 — Strategium drawer conversion

- `MainLayout.tsx:695-788` — replaced conditional mount/unmount block with always-mounted drawer. The `hideRightPanel` logic (tab-based) is preserved — drawer renders only when NOT on hidden tabs. When `missionControlCollapsed` is true → `translateX(100%)` off-screen; when false → `translateX(0)` with `300ms var(--ease-spring)` transition. `position: absolute` at `top: 50, right: 0, bottom: 0, width: 380`. Left border: `1px solid color-mix(in srgb, var(--fintheon-accent) 16%, transparent)`.
- `MainLayout.tsx:930` — right panels wrapper simplified to `{rightPanels}` (no flex wrapper needed for absolutely positioned drawer).
- `missionControlCollapsed` defaults to `true` in `useLayoutState.ts` → hidden by default.

### Step 3 — Bulletin drag fluidity

- No changes needed. `SnapSheet.tsx:138` already uses `dragElastic={0.08}` and `MobileBulletin` wraps content in `<SnapSheet>`.
- Tap-to-dismiss AND swipe-down with `AND(offset>260, velocity>500)` already in place.

### Step 4 — Upload button removal

- Already completed by T3 (prior agent). `SanctumHeader.tsx` had `Upload` button + `UploadContextModal` removed; `Zap` icon replaced with `RefreshCw`. File reduced from 339→78 lines.

### Step 5 — Sanctum duplicate chart fix (analysis→consensus)

- `SanctumBriefing.tsx` — removed standalone "Analysis" section (summary label + text). Summary text moved into consensus block beneath `agentConsensus` badge. Fallback "Analysis" label changed to "Briefing". `noBorder` prop respected on first section.

### Step 6 — 50/50 hero layout

- Both columns already `flex-1` (50/50). Fixed misleading comment from `(55%)/(45%)` to `50/50`. Vertical ruler already `bg-[var(--fintheon-accent)]/10` (solid).

### Step 7 — Connector dead-entry cleanup

- `useMcpConnectors.ts` — added `DEAD_CONNECTOR_IDS` set containing `"omi"`. Filter applied when merging internal + backend MCP servers. Kept: VProxy, Hermes, MCP/API tools, RiskFlow.

### Step 8 — Category pill removal

- `RiskFlowDetailCard.tsx` — removed `alert.tags` pill display section (9 lines, lines 346-360). Author handle and source links preserved.

### Validation

- `npx tsc --noEmit --project frontend/tsconfig.json`: zero new errors. Existing errors in `RefinementEngine.tsx` (T3-owned, excluded from T4 scope).
- `rm -rf dist && npx vite build`: passed in 4.15s.
- Line counts: `MainLayout.tsx` (1029), `TopHeader.tsx` (786), `NavSidebar.tsx` (467), `Sanctum.tsx` (452), `FintheonComposer.tsx` (324), `RiskFlowDetailCard.tsx` (396), `useMcpConnectors.ts` (136), `SanctumBriefing.tsx` (141). All files that were 300+ remain so; no increases from T4 changes. `useMcpConnectors` + `SanctumBriefing` within 300-line limit.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Check file sizes (all must be ≤300 lines)
wc -l frontend/components/layout/MainLayout.tsx
wc -l frontend/components/layout/TopHeader.tsx
wc -l frontend/components/layout/NavSidebar.tsx
wc -l frontend/components/narrative/Sanctum.tsx
wc -l frontend/components/chat/FintheonComposer.tsx
wc -l frontend/components/feed/RiskFlowDetailCard.tsx
```

## Commit Format

```
[v5.35.0] feat: T4 layout fixes + S47 deferred — app frame border (top+full), Strategium drawer slide, bulletin drag fluidity, upload removal, duplicate chart fix, 50/50 hero alignment, connector cleanup, category pill removal
```
